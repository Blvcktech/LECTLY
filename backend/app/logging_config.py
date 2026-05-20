"""
Lectly — Logging Configuration

Sets up structured logging for the application.
Railway captures stdout, so we log to stdout with a clean format.
"""

import logging
import sys


def setup_logging(debug: bool = False) -> None:
    """Configure application-wide logging."""

    level = logging.DEBUG if debug else logging.INFO

    # Format: timestamp level logger message
    formatter = logging.Formatter(
        fmt="%(asctime)s %(levelname)-7s [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Single handler: stdout (Railway captures this)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    # Configure root logger
    root = logging.getLogger()
    root.setLevel(level)
    root.handlers.clear()
    root.addHandler(handler)

    # Quiet noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("openai").setLevel(logging.WARNING)
    logging.getLogger("anthropic").setLevel(logging.WARNING)

    logging.getLogger("lectly").info(
        f"Logging initialized level={logging.getLevelName(level)}"
    )
