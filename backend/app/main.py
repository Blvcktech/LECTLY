"""
Lectly API — FastAPI Backend

The AI-powered lecture companion that doesn't just take notes — it teaches.
"""

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import get_settings
from app.database import init_db
from app.routes.lectures import router as lectures_router


settings = get_settings()

# Initialize database on startup
init_db()

app = FastAPI(
    title="Lectly API",
    description="AI-powered lecture processing: audio cleanup, transcription, structured notes, and Learn Mode.",
    version="0.2.0",
)


# Manual CORS middleware to guarantee headers are always set
class CORSAlwaysMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Handle preflight OPTIONS requests
        if request.method == "OPTIONS":
            response = Response()
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "*"
            response.headers["Access-Control-Max-Age"] = "3600"
            return response

        response = await call_next(request)
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
        return response


app.add_middleware(CORSAlwaysMiddleware)

# Routes
app.include_router(lectures_router)


@app.get("/")
async def root():
    return {
        "app": "Lectly API",
        "version": "0.2.0",
        "status": "running",
        "cors": "open",
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
