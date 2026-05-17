"""
Push notification routes — subscribe and unsubscribe from browser push.

The subscribe endpoint receives the PushSubscription object from the
browser's PushManager API and stores it in the database so we can
send notifications later (e.g. when a lecture finishes processing).
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.deps import get_current_user
from app.database import save_push_subscription, delete_push_subscription

router = APIRouter(prefix="/api/push", tags=["push"])


class PushSubscribeRequest(BaseModel):
    """The browser's PushSubscription.toJSON() object."""
    subscription: dict


class PushUnsubscribeRequest(BaseModel):
    endpoint: str


@router.post("/subscribe")
async def subscribe(
    body: PushSubscribeRequest,
    user_id: str = Depends(get_current_user),
):
    """
    Save a push subscription for the current user.

    Called by the frontend PushNotifications component after the
    student grants notification permission and the browser creates
    a push subscription with the VAPID public key.
    """
    sub = body.subscription
    if not sub.get("endpoint"):
        raise HTTPException(status_code=400, detail="Missing endpoint in subscription")

    result = save_push_subscription(user_id, sub)
    return {"ok": True, "endpoint": result["endpoint"]}


@router.post("/unsubscribe")
async def unsubscribe(
    body: PushUnsubscribeRequest,
    user_id: str = Depends(get_current_user),
):
    """Remove a push subscription (e.g. student disables notifications)."""
    delete_push_subscription(body.endpoint)
    return {"ok": True}
