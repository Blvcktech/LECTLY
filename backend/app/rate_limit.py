"""
Rate limiting for Lectly API.

Protects expensive LLM endpoints from abuse and controls API credit burn.
Uses slowapi (built on top of limits library) with per-user tracking.
"""

from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from starlette.requests import Request
from starlette.responses import JSONResponse


def _get_user_id_or_ip(request: Request) -> str:
    """
    Rate limit key function.
    Uses authenticated user ID if available, otherwise falls back to IP.
    This ensures:
    - Logged-in users get per-user limits (fair across accounts)
    - Unauthenticated requests get per-IP limits (prevents anonymous abuse)
    """
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        try:
            # Quick decode without verification just to extract sub (user ID)
            # Full verification happens in the route handler
            import json
            import base64
            parts = token.split(".")
            if len(parts) >= 2:
                payload = parts[1]
                # Add padding
                payload += "=" * (4 - len(payload) % 4)
                decoded = json.loads(base64.urlsafe_b64decode(payload))
                user_id = decoded.get("sub")
                if user_id:
                    return f"user:{user_id}"
        except Exception:
            pass

    # Fallback to IP
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return f"ip:{forwarded.split(',')[0].strip()}"
    client = request.client
    return f"ip:{client.host if client else 'unknown'}"


# Create the limiter instance
limiter = Limiter(key_func=_get_user_id_or_ip)


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """Custom handler that returns a clean JSON error instead of plain text."""
    return JSONResponse(
        status_code=429,
        content={
            "detail": "You're making requests too quickly. Please wait a moment and try again.",
            "retry_after": str(exc.detail).split("per")[-1].strip() if "per" in str(exc.detail) else "a moment",
        },
    )
