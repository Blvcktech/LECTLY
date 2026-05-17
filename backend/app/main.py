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
from app.database import init_db, close_pool
from app.routes.lectures import router as lectures_router
from app.routes.push import router as push_router
from app.routes.payments import router as payments_router
from app.rate_limit import limiter, rate_limit_exceeded_handler


settings = get_settings()

# Initialize database on startup
init_db()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup — pool already initialized by database.py import
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


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "version": "0.2.0",
        "openai_configured": bool(settings.openai_api_key),
        "anthropic_configured": bool(settings.anthropic_api_key),
    }
