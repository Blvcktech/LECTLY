"""
Lectly API — FastAPI Backend

The AI-powered lecture companion that doesn't just take notes — it teaches.
"""

import os
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse

from slowapi.errors import RateLimitExceeded

from contextlib import asynccontextmanager

from app.config import get_settings
from app.database import init_db, close_pool, run_migrations, recover_stuck_lectures
from app.routes.lectures import router as lectures_router
from app.routes.push import router as push_router
from app.routes.payments import router as payments_router
from app.rate_limit import limiter, rate_limit_exceeded_handler


settings = get_settings()

# Initialize database on startup
init_db()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup — run migrations and recover any stuck lectures
    run_migrations()
    recover_stuck_lectures()
    yield
    # Shutdown — close all pooled connections gracefully
    close_pool()

# Ensure upload/processed directories exist
os.makedirs(settings.upload_dir, exist_ok=True)
os.makedirs(settings.processed_dir, exist_ok=True)

app = FastAPI(
    title="Lectly API",
    description="AI-powered lecture processing: audio cleanup, transcription, structured notes, and Learn Mode.",
    version="0.3.0",
    lifespan=lifespan,
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)


# Parse allowed origins from settings
_allowed_origins = [
    origin.strip()
    for origin in settings.allowed_origins.split(",")
    if origin.strip()
]

# Use FastAPI's built-in CORSMiddleware — more reliable than custom BaseHTTPMiddleware
# (BaseHTTPMiddleware has known issues with streaming/upload requests in Starlette)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins if not settings.debug else ["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    max_age=3600,
)

# Routes
app.include_router(lectures_router)
app.include_router(push_router)
app.include_router(payments_router)


@app.get("/")
async def root():
    return {
        "app": "Lectly API",
        "version": "0.3.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health/auth")
async def health_auth(request: Request):
    """
    Debug endpoint — test if your auth token is valid.
    Send a request with Authorization: Bearer <token> and see what happens.
    Also works from browser console: fetch('/health/auth', {headers: {'Authorization': 'Bearer ...'}})
    """
    auth_header = request.headers.get("authorization", "")
    if not auth_header:
        return {
            "auth_present": False,
            "error": "No Authorization header found",
            "hint": "Make sure the frontend is sending the Bearer token",
        }

    from app.deps import _extract_user_id
    user_id = _extract_user_id(request)
    clerk_issuer = settings.clerk_issuer

    return {
        "auth_present": True,
        "token_prefix": auth_header[:30] + "..." if len(auth_header) > 30 else auth_header,
        "clerk_issuer_configured": bool(clerk_issuer),
        "clerk_issuer_value": clerk_issuer[:30] + "..." if clerk_issuer else "(empty)",
        "user_id": user_id,
        "auth_valid": bool(user_id),
        "error": None if user_id else "Token verification failed — check CLERK_ISSUER and token validity",
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "version": "0.3.0",
        "openai_configured": bool(settings.openai_api_key),
        "anthropic_configured": bool(settings.anthropic_api_key),
        "gemini_configured": bool(settings.gemini_api_key),
        "groq_configured": bool(settings.groq_api_key),
        "assemblyai_configured": bool(settings.assemblyai_api_key),
    }


@app.get("/health/llm")
async def health_llm():
    """
    Test each LLM provider with a tiny request.
    Returns the exact error for any that fail — use this to diagnose
    why Gemini/Groq/Claude might not be working on Railway.
    """
    import requests as http_requests

    results = {}

    # ── Test Gemini ──
    gemini_key = settings.gemini_api_key
    if not gemini_key:
        results["gemini"] = {"status": "not_configured", "error": "GEMINI_API_KEY is empty"}
    else:
        try:
            api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
            payload = {
                "contents": [{"role": "user", "parts": [{"text": "Reply with exactly: OK"}]}],
                "generationConfig": {"temperature": 0, "maxOutputTokens": 10},
            }
            resp = http_requests.post(api_url, json=payload, headers={"Content-Type": "application/json"}, timeout=30)
            if resp.status_code == 200:
                text = resp.json().get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                results["gemini"] = {"status": "ok", "response": text.strip(), "model": "gemini-2.5-flash"}
            else:
                results["gemini"] = {
                    "status": "error",
                    "http_code": resp.status_code,
                    "error": resp.text[:500],
                    "key_prefix": gemini_key[:10] + "...",
                }
        except Exception as e:
            results["gemini"] = {"status": "error", "error": str(e)}

    # ── Test Groq ──
    groq_key = settings.groq_api_key
    if not groq_key:
        results["groq"] = {"status": "not_configured", "error": "GROQ_API_KEY is empty"}
    else:
        try:
            resp = http_requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                json={"model": "llama-3.1-8b-instant", "messages": [{"role": "user", "content": "Reply with exactly: OK"}], "max_tokens": 10},
                timeout=30,
            )
            if resp.status_code == 200:
                text = resp.json()["choices"][0]["message"]["content"]
                results["groq"] = {"status": "ok", "response": text.strip(), "model": "llama-3.1-8b-instant"}
            else:
                results["groq"] = {"status": "error", "http_code": resp.status_code, "error": resp.text[:500]}
        except Exception as e:
            results["groq"] = {"status": "error", "error": str(e)}

    # ── Test Claude ──
    claude_key = settings.anthropic_api_key
    if not claude_key:
        results["claude"] = {"status": "not_configured", "error": "ANTHROPIC_API_KEY is empty"}
    else:
        try:
            resp = http_requests.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key": claude_key, "anthropic-version": "2023-06-01", "Content-Type": "application/json"},
                json={"model": "claude-haiku-4-5-20251001", "max_tokens": 10, "messages": [{"role": "user", "content": "Reply with exactly: OK"}]},
                timeout=30,
            )
            if resp.status_code == 200:
                text = resp.json()["content"][0]["text"]
                results["claude"] = {"status": "ok", "response": text.strip(), "model": "claude-haiku-4-5-20251001"}
            else:
                results["claude"] = {"status": "error", "http_code": resp.status_code, "error": resp.text[:500]}
        except Exception as e:
            results["claude"] = {"status": "error", "error": str(e)}

    # Summary
    all_ok = all(r.get("status") == "ok" for r in results.values())
    return {
        "overall": "healthy" if all_ok else "degraded",
        "providers": results,
    }
