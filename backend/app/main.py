"""
Lectly API — FastAPI Backend

The AI-powered lecture companion that doesn't just take notes — it teaches.
"""

import os
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse

from slowapi.errors import RateLimitExceeded

from contextlib import asynccontextmanager

from app.config import get_settings
from app.database import init_db, close_pool, run_migrations, recover_stuck_lectures
from app.routes.lectures import router as lectures_router
from app.routes.push import router as push_router
from app.routes.payments import router as payments_router
from app.routes.metrics import router as metrics_router
from app.rate_limit import limiter, rate_limit_exceeded_handler
from app.middleware import RequestLoggingMiddleware, CacheHeaderMiddleware
from app.logging_config import setup_logging


settings = get_settings()

# Set up structured logging before anything else
setup_logging(debug=settings.debug)

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
    # Disable Swagger/ReDoc in production — no need to expose API docs publicly
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
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

# Middleware stack (outermost runs first):
# 1. Logging wraps everything — sees final status + duration
# 2. Cache headers added to responses
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(CacheHeaderMiddleware)

# Routes
app.include_router(lectures_router)
app.include_router(push_router)
app.include_router(payments_router)
app.include_router(metrics_router)


@app.get("/")
async def root():
    return {
        "app": "Lectly API",
        "version": "0.3.0",
        "status": "running",
    }


@app.get("/health")
async def health():
    """Public health check — only reveals the service is running. No internals."""
    return {
        "status": "healthy",
        "version": "0.3.0",
    }
