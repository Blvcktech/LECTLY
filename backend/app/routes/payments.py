"""
Payment routes — Paystack integration for subscriptions.

Flow:
1. Student clicks "Upgrade" → frontend calls POST /api/payments/initialize
2. Backend creates a Paystack transaction → returns checkout URL
3. Student pays on Paystack's hosted page
4. Paystack redirects back to frontend with ?reference=xxx
5. Frontend calls POST /api/payments/verify with the reference
6. Backend verifies with Paystack → upgrades the user's tier
7. (Backup) Paystack also sends a webhook to POST /api/payments/webhook
"""

import hashlib
import hmac
import json
import logging
from datetime import datetime, timedelta

import requests
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.config import get_settings
from app.deps import get_current_user
from app.database import (
    get_subscription,
    get_subscription_by_customer_code,
    get_subscription_by_reference,
    upsert_subscription,
    cancel_subscription,
    TIER_LIMITS,
    ensure_clerk_user,
)

logger = logging.getLogger("lectly.payments")
router = APIRouter(prefix="/api/payments", tags=["payments"])

PAYSTACK_API = "https://api.paystack.co"

# Plan prices in kobo (Paystack uses smallest currency unit)
# ₦3,500 = 350000 kobo, ₦8,500 = 850000 kobo
PLAN_PRICES = {
    "basic": 350000,
    "pro": 850000,
}


def _paystack_headers():
    settings = get_settings()
    return {
        "Authorization": f"Bearer {settings.paystack_secret_key}",
        "Content-Type": "application/json",
    }


# ──────────────────────────────────────────────
# Initialize Transaction
# ──────────────────────────────────────────────

class InitializeRequest(BaseModel):
    plan: str  # "basic" or "pro"
    email: str  # Student's email for Paystack


@router.post("/initialize")
async def initialize_payment(
    body: InitializeRequest,
    user_id: str = Depends(get_current_user),
):
    """
    Create a Paystack checkout session.

    Returns the authorization_url where the student should be
    redirected to complete payment.
    """
    settings = get_settings()
    if not settings.paystack_secret_key:
        raise HTTPException(status_code=500, detail="Payment not configured")

    if body.plan not in PLAN_PRICES:
        raise HTTPException(status_code=400, detail=f"Invalid plan. Choose: {', '.join(PLAN_PRICES.keys())}")

    ensure_clerk_user(user_id)

    amount = PLAN_PRICES[body.plan]

    # metadata tells us which user and plan this is for when we verify later
    payload = {
        "email": body.email,
        "amount": amount,
        "currency": "NGN",
        "metadata": {
            "user_id": user_id,
            "plan": body.plan,
            "custom_fields": [
                {"display_name": "Plan", "variable_name": "plan", "value": body.plan.title()},
            ],
        },
        "callback_url": f"{settings.allowed_origins.split(',')[0]}/profile/subscription/callback",
    }

    try:
        resp = requests.post(
            f"{PAYSTACK_API}/transaction/initialize",
            json=payload,
            headers=_paystack_headers(),
            timeout=15,
        )
        data = resp.json()

        if not data.get("status"):
            logger.error(f"[Lectly] Paystack init failed: {data}")
            raise HTTPException(status_code=502, detail="Payment initialization failed")

        return {
            "authorization_url": data["data"]["authorization_url"],
            "reference": data["data"]["reference"],
            "access_code": data["data"]["access_code"],
        }
    except requests.RequestException as e:
        logger.error(f"[Lectly] Paystack request error: {e}")
        raise HTTPException(status_code=502, detail="Could not reach payment service")


# ──────────────────────────────────────────────
# Verify Transaction
# ──────────────────────────────────────────────

class VerifyRequest(BaseModel):
    reference: str


@router.post("/verify")
async def verify_payment(
    body: VerifyRequest,
    user_id: str = Depends(get_current_user),
):
    """
    Verify a Paystack transaction after the student completes payment.

    Called by the frontend callback page with the reference from the URL.
    If payment was successful, upgrade the user's subscription tier.
    """
    settings = get_settings()
    if not settings.paystack_secret_key:
        raise HTTPException(status_code=500, detail="Payment not configured")

    # Duplicate protection: if this reference was already processed, return success
    existing = get_subscription_by_reference(body.reference)
    if existing and existing.get("status") == "active":
        logger.info(f"[Lectly] Duplicate verify for reference {body.reference} — already processed")
        return {
            "verified": True,
            "plan": existing.get("tier", "basic"),
            "message": f"Already upgraded to {existing.get('tier', 'basic').title()} plan!",
        }

    try:
        resp = requests.get(
            f"{PAYSTACK_API}/transaction/verify/{body.reference}",
            headers=_paystack_headers(),
            timeout=15,
        )
        data = resp.json()

        if not data.get("status") or data.get("data", {}).get("status") != "success":
            return {"verified": False, "message": "Payment not successful"}

        tx = data["data"]
        metadata = tx.get("metadata", {})
        plan = metadata.get("plan", "basic")
        tx_user_id = metadata.get("user_id")

        # Security: make sure this transaction belongs to the requesting user
        if tx_user_id and tx_user_id != user_id:
            raise HTTPException(status_code=403, detail="Transaction does not belong to this user")

        # Calculate subscription period (30 days from now)
        now = datetime.utcnow()
        period_end = now + timedelta(days=30)

        # Upgrade the subscription
        upsert_subscription(user_id, {
            "tier": plan,
            "lectures_limit": TIER_LIMITS.get(plan, 8),
            "paystack_email": tx.get("customer", {}).get("email"),
            "paystack_customer_code": tx.get("customer", {}).get("customer_code"),
            "paystack_authorization_code": tx.get("authorization", {}).get("authorization_code"),
            "paystack_reference": body.reference,
            "current_period_start": now.isoformat(),
            "current_period_end": period_end.isoformat(),
            "status": "active",
        })

        logger.info(f"[Lectly] User {user_id} upgraded to {plan} (ref: {body.reference}, expires: {period_end.isoformat()})")

        return {
            "verified": True,
            "plan": plan,
            "message": f"Successfully upgraded to {plan.title()} plan!",
        }

    except requests.RequestException as e:
        logger.error(f"[Lectly] Paystack verify error: {e}")
        raise HTTPException(status_code=502, detail="Could not verify payment")


# ──────────────────────────────────────────────
# Webhook (backup verification from Paystack)
# ──────────────────────────────────────────────

@router.post("/webhook")
async def paystack_webhook(request: Request):
    """
    Paystack webhook handler.

    Paystack sends events here (e.g. charge.success, subscription.create).
    We verify the signature to make sure it's really from Paystack,
    then process the event.

    This is a backup — the verify endpoint handles most cases, but
    webhooks ensure we don't miss anything (e.g. if the student closes
    the browser before the callback loads).
    """
    settings = get_settings()
    if not settings.paystack_secret_key:
        return {"ok": True}  # Silently accept if not configured

    # Verify webhook signature
    body_bytes = await request.body()
    signature = request.headers.get("x-paystack-signature", "")
    expected = hmac.new(
        settings.paystack_secret_key.encode(),
        body_bytes,
        hashlib.sha512,
    ).hexdigest()

    if signature != expected:
        logger.warning("[Lectly] Webhook signature mismatch — ignoring")
        raise HTTPException(status_code=400, detail="Invalid signature")

    try:
        event = json.loads(body_bytes)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event_type = event.get("event")
    data = event.get("data", {})

    logger.info(f"[Lectly] Webhook received: {event_type}")

    if event_type == "charge.success":
        metadata = data.get("metadata", {})
        user_id = metadata.get("user_id")
        plan = metadata.get("plan", "basic")
        reference = data.get("reference", "")

        if user_id:
            # Duplicate protection
            existing = get_subscription_by_reference(reference) if reference else None
            if existing and existing.get("status") == "active":
                logger.info(f"[Lectly] Webhook: Reference {reference} already processed — skipping")
            else:
                now = datetime.utcnow()
                period_end = now + timedelta(days=30)
                upsert_subscription(user_id, {
                    "tier": plan,
                    "lectures_limit": TIER_LIMITS.get(plan, 8),
                    "paystack_email": data.get("customer", {}).get("email"),
                    "paystack_customer_code": data.get("customer", {}).get("customer_code"),
                    "paystack_authorization_code": data.get("authorization", {}).get("authorization_code"),
                    "paystack_reference": reference,
                    "current_period_start": now.isoformat(),
                    "current_period_end": period_end.isoformat(),
                    "status": "active",
                })
                logger.info(f"[Lectly] Webhook: User {user_id} upgraded to {plan}")

    elif event_type in ("subscription.disable", "subscription.not_renew"):
        # Handle subscription cancellation — look up user by customer code
        customer_code = data.get("customer", {}).get("customer_code")
        if customer_code:
            sub = get_subscription_by_customer_code(customer_code)
            if sub:
                cancel_subscription(sub["user_id"])
                logger.info(f"[Lectly] Webhook: User {sub['user_id']} downgraded to free (customer: {customer_code})")
            else:
                logger.warning(f"[Lectly] Webhook: No subscription found for customer {customer_code}")

    return {"ok": True}


# ──────────────────────────────────────────────
# Subscription Status
# ──────────────────────────────────────────────

@router.get("/subscription")
async def get_subscription_status(user_id: str = Depends(get_current_user)):
    """Get the current user's subscription details."""
    sub = get_subscription(user_id)
    if not sub:
        return {
            "tier": "free",
            "lectures_limit": TIER_LIMITS["free"],
            "status": "active",
        }

    return {
        "tier": sub["tier"],
        "lectures_limit": sub["lectures_limit"],
        "status": sub["status"],
        "current_period_end": sub.get("current_period_end"),
    }
