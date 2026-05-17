"""
Push notification sender — sends browser push notifications via pywebpush.

Uses VAPID (Voluntary Application Server Identification) keys to
authenticate with the browser's push service. The public key is shared
with the frontend; the private key stays on the server.

Environment variables:
  VAPID_PRIVATE_KEY  — base64url-encoded private key
  VAPID_PUBLIC_KEY   — base64url-encoded public key (same as frontend)
  VAPID_CLAIMS_EMAIL — contact email for the push service (mailto:you@example.com)
"""

import json
import logging
import os

from pywebpush import webpush, WebPushException

from app.database import get_user_push_subscriptions, delete_push_subscription

logger = logging.getLogger("lectly.push")

VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_CLAIMS_EMAIL = os.environ.get("VAPID_CLAIMS_EMAIL", "mailto:davidgates605@gmail.com")


def send_push_to_user(user_id: str, title: str, body: str, url: str = "/dashboard", tag: str = "lectly-notification"):
    """
    Send a push notification to ALL of a user's subscribed devices.

    If a subscription is expired or invalid (HTTP 410 Gone), it gets
    automatically cleaned up from the database.
    """
    if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
        logger.warning("[Lectly] Push skipped — VAPID keys not configured")
        return

    subscriptions = get_user_push_subscriptions(user_id)
    if not subscriptions:
        return

    payload = json.dumps({
        "title": title,
        "body": body,
        "url": url,
        "tag": tag,
    })

    for sub_record in subscriptions:
        try:
            subscription_info = json.loads(sub_record["subscription_json"])
            webpush(
                subscription_info=subscription_info,
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_CLAIMS_EMAIL},
            )
            logger.info(f"[Lectly] Push sent to {sub_record['endpoint'][:60]}...")
        except WebPushException as e:
            # 410 Gone = subscription expired, clean it up
            if "410" in str(e) or "404" in str(e):
                logger.info(f"[Lectly] Removing expired push subscription: {sub_record['endpoint'][:60]}...")
                delete_push_subscription(sub_record["endpoint"])
            else:
                logger.warning(f"[Lectly] Push failed: {e}")
        except Exception as e:
            logger.warning(f"[Lectly] Push error: {e}")
