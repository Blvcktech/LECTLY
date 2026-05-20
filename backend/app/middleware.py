"""
Lectly — Middleware

1. RequestLoggingMiddleware — structured logging for every request
2. CacheHeaderMiddleware — adds Cache-Control headers to API responses
"""

import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("lectly.requests")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log every HTTP request with method, path, status, and duration."""

    SLOW_THRESHOLD_MS = 2000  # Warn if request takes longer than 2s
    # Paths to skip logging (noisy health checks)
    SKIP_PATHS = {"/", "/health"}

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path

        # Skip noisy health check spam from load balancers
        if path in self.SKIP_PATHS:
            return await call_next(request)

        method = request.method
        start = time.perf_counter()

        try:
            response = await call_next(request)
            duration_ms = (time.perf_counter() - start) * 1000
            status = response.status_code

            # Build log line
            log_line = (
                f'method={method} path={path} status={status} '
                f'duration={duration_ms:.0f}ms'
            )

            if status >= 500:
                logger.error(log_line)
            elif status >= 400:
                logger.warning(log_line)
            elif duration_ms > self.SLOW_THRESHOLD_MS:
                logger.warning(f'{log_line} SLOW_REQUEST')
            else:
                logger.info(log_line)

            return response

        except Exception as exc:
            duration_ms = (time.perf_counter() - start) * 1000
            logger.error(
                f'method={method} path={path} status=500 '
                f'duration={duration_ms:.0f}ms error="{exc}"'
            )
            raise


class CacheHeaderMiddleware(BaseHTTPMiddleware):
    """Add Cache-Control headers to API responses.

    - GET /api/lectures (list): short cache (60s) — changes on upload/delete
    - GET /api/lectures/{id}: medium cache (5min) — rarely changes after processing
    - GET /health: short cache (30s)
    - POST/PUT/DELETE: no-store
    """

    # path prefix -> max-age in seconds
    CACHE_RULES = {
        "/health": 30,
        "/api/lectures": 60,        # lecture list
        "/api/progress": 30,        # progress data
        "/api/user/limits": 60,     # user limits
    }

    # Longer cache for individual lecture detail (regex-like check)
    LECTURE_DETAIL_CACHE = 300  # 5 minutes

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        path = request.url.path
        method = request.method

        # Only cache successful GET responses
        if method != "GET" or response.status_code >= 400:
            response.headers.setdefault("Cache-Control", "no-store")
            return response

        # Check specific rules
        for prefix, max_age in self.CACHE_RULES.items():
            if path == prefix or path.startswith(prefix + "/"):
                # Individual lecture detail gets longer cache
                parts = path.strip("/").split("/")
                if len(parts) == 3 and parts[0] == "api" and parts[1] == "lectures":
                    max_age = self.LECTURE_DETAIL_CACHE

                response.headers.setdefault(
                    "Cache-Control",
                    f"private, max-age={max_age}, stale-while-revalidate={max_age * 2}"
                )
                return response

        # Default: no caching for unmatched routes
        response.headers.setdefault("Cache-Control", "no-store")
        return response
