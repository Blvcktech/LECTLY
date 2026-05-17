"""
Lectly Cache — Simple in-memory TTL cache.

No dependencies (no Redis needed). Stores lecture data that rarely
changes after processing, so repeat page loads skip the database.

Cache is automatically invalidated when lectures are updated or deleted.
On server restart the cache is empty — that's fine, it just means the
first request hits the database and subsequent ones are instant.

Configurable via environment variables:
    CACHE_TTL=300          seconds before entries expire (default: 5 minutes)
    CACHE_MAX_ENTRIES=500  max items stored (default: 500, LRU eviction)
"""

import logging
import os
import threading
import time
from typing import Any, Optional

logger = logging.getLogger("lectly.cache")

CACHE_TTL = int(os.environ.get("CACHE_TTL", "300"))  # 5 minutes default
CACHE_MAX_ENTRIES = int(os.environ.get("CACHE_MAX_ENTRIES", "500"))


class TTLCache:
    """Thread-safe in-memory cache with TTL expiration and LRU eviction."""

    def __init__(self, ttl: int = CACHE_TTL, max_entries: int = CACHE_MAX_ENTRIES):
        self._store: dict[str, tuple[float, Any]] = {}  # key -> (expires_at, value)
        self._lock = threading.Lock()
        self._ttl = ttl
        self._max_entries = max_entries

    def get(self, key: str) -> Optional[Any]:
        """Get a value from cache. Returns None if missing or expired."""
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            expires_at, value = entry
            if time.time() > expires_at:
                # Expired — remove and return None
                del self._store[key]
                return None
            return value

    def set(self, key: str, value: Any, ttl: Optional[int] = None):
        """Store a value in cache with TTL."""
        with self._lock:
            # LRU eviction: if at capacity, remove oldest entries
            if len(self._store) >= self._max_entries and key not in self._store:
                # Remove the entry that expires soonest (approximate LRU)
                oldest_key = min(self._store, key=lambda k: self._store[k][0])
                del self._store[oldest_key]

            expires_at = time.time() + (ttl if ttl is not None else self._ttl)
            self._store[key] = (expires_at, value)

    def delete(self, key: str):
        """Remove a specific key from cache."""
        with self._lock:
            self._store.pop(key, None)

    def delete_pattern(self, prefix: str):
        """Remove all keys that start with the given prefix."""
        with self._lock:
            keys_to_delete = [k for k in self._store if k.startswith(prefix)]
            for k in keys_to_delete:
                del self._store[k]

    def clear(self):
        """Remove all entries."""
        with self._lock:
            self._store.clear()

    def stats(self) -> dict:
        """Return cache statistics."""
        with self._lock:
            now = time.time()
            total = len(self._store)
            expired = sum(1 for _, (exp, _) in self._store.items() if now > exp)
            return {"total_entries": total, "expired": expired, "active": total - expired}


# ──────────────────────────────────────────────
# Global cache instance
# ──────────────────────────────────────────────

cache = TTLCache()


# ──────────────────────────────────────────────
# Cache key helpers
# ──────────────────────────────────────────────

def lecture_key(lecture_id: str) -> str:
    return f"lecture:{lecture_id}"


def lecture_list_key(user_id: str) -> str:
    return f"lectures:{user_id}"


def learn_cache_key(lecture_id: str, section_index: int, level: str, card_style: str) -> str:
    return f"learn:{lecture_id}:{section_index}:{level}:{card_style}"


# ──────────────────────────────────────────────
# Cache invalidation helpers
# ──────────────────────────────────────────────

def invalidate_lecture(lecture_id: str):
    """Invalidate all cached data for a specific lecture."""
    cache.delete(lecture_key(lecture_id))
    cache.delete_pattern(f"learn:{lecture_id}:")
    # Also clear all user lecture lists since they might contain this lecture
    cache.delete_pattern("lectures:")
    logger.debug(f"Cache invalidated for lecture {lecture_id}")


def invalidate_user_lectures(user_id: str):
    """Invalidate the cached lecture list for a user."""
    cache.delete(lecture_list_key(user_id))
