"""
Lectly Dependencies — FastAPI dependency injection for auth and common needs.

Usage in routes:
    from app.deps import get_current_user

    @router.get("/something")
    async def something(user_id: str = Depends(get_current_user)):
        ...  # user_id is guaranteed to be a valid Clerk user ID
"""

import time
from typing import Optional

from fastapi import Depends, HTTPException, Request

from app.config import get_settings


# ──────────────────────────────────────────────
# Clerk JWKS client (cached, thread-safe)
# ──────────────────────────────────────────────

_jwks_client = None
_jwks_client_init_time: float = 0


def _get_jwks_client():
    """Get or create a cached JWKS client for Clerk token verification."""
    global _jwks_client, _jwks_client_init_time
    settings = get_settings()
    if not settings.clerk_issuer:
        return None
    # Refresh the client every 6 hours to pick up key rotations
    if _jwks_client is None or (time.time() - _jwks_client_init_time) > 21600:
        from jwt import PyJWKClient
        jwks_url = f"{settings.clerk_issuer.rstrip('/')}/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url, cache_keys=True)
        _jwks_client_init_time = time.time()
    return _jwks_client


def _extract_user_id(request: Request) -> Optional[str]:
    """
    Extract user ID from Clerk session token in the Authorization header.
    Verifies the JWT signature against Clerk's JWKS public keys.
    Falls back to unverified decode only if CLERK_ISSUER is not configured (local dev).
    """
    import jwt

    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header[7:]

    settings = get_settings()
    jwks_client = _get_jwks_client()

    # ── Production: Verify JWT signature with Clerk's JWKS ──
    if jwks_client and settings.clerk_issuer:
        try:
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                options={
                    "verify_aud": False,
                    "verify_iss": False,
                },
            )
            return payload.get("sub")
        except jwt.ExpiredSignatureError:
            print("[Lectly] JWT expired")
            return None
        except jwt.InvalidTokenError as e:
            print(f"[Lectly] JWT verification failed: {e}")
            return None
        except Exception as e:
            print(f"[Lectly] JWKS verification error: {e}")
            return None

    # ── Local dev fallback: decode without verification ──
    if not settings.clerk_issuer:
        try:
            import json, base64
            payload_b64 = token.split(".")[1]
            payload_b64 += "=" * (4 - len(payload_b64) % 4)
            payload = json.loads(base64.urlsafe_b64decode(payload_b64))
            return payload.get("sub")
        except Exception:
            return None

    return None


# ──────────────────────────────────────────────
# FastAPI Dependencies
# ──────────────────────────────────────────────

async def get_current_user(request: Request) -> str:
    """
    FastAPI dependency that extracts and validates the Clerk user ID.

    Raises 401 if no valid token is present. Use this on every
    protected endpoint — it's the front door security guard.

    Usage:
        @router.get("/protected")
        async def my_endpoint(user_id: str = Depends(get_current_user)):
            ...
    """
    user_id = _extract_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user_id


async def get_optional_user(request: Request) -> Optional[str]:
    """
    FastAPI dependency that extracts the user ID but doesn't require it.

    Returns None if no valid token is present (instead of raising 401).
    Use this for endpoints that work for both logged-in and anonymous users.

    Usage:
        @router.get("/public-but-personalized")
        async def my_endpoint(user_id: Optional[str] = Depends(get_optional_user)):
            ...
    """
    return _extract_user_id(request)
