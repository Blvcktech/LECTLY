"""
Lectly Database — PostgreSQL (production) / SQLite (local dev).

Uses DATABASE_URL env var to connect to PostgreSQL on Railway.
Falls back to SQLite if DATABASE_URL is not set (local development).

PostgreSQL connections use a ThreadedConnectionPool so we reuse TCP
connections instead of opening a new one per request. The pool is
sized via DB_POOL_MIN / DB_POOL_MAX env vars (defaults: 2 / 20).
"""

import atexit
import json
import logging
import os
from contextlib import contextmanager
from datetime import datetime
from typing import Optional

from app.cache import (
    cache,
    lecture_key,
    lecture_list_key,
    learn_cache_key,
    invalidate_lecture,
    invalidate_user_lectures,
)

logger = logging.getLogger("lectly.db")

# ──────────────────────────────────────────────
# Connection setup — PostgreSQL (pooled) or SQLite
# ──────────────────────────────────────────────

DATABASE_URL = os.environ.get("DATABASE_URL")
USE_POSTGRES = DATABASE_URL is not None

_pg_pool = None  # module-level pool reference

if USE_POSTGRES:
    import psycopg2
    import psycopg2.extras
    from psycopg2.pool import ThreadedConnectionPool

    DB_POOL_MIN = int(os.environ.get("DB_POOL_MIN", "2"))
    DB_POOL_MAX = int(os.environ.get("DB_POOL_MAX", "20"))

    # Query timeout: kill queries running longer than 30s (prevents runaway queries)
    DB_QUERY_TIMEOUT_MS = int(os.environ.get("DB_QUERY_TIMEOUT_MS", "30000"))

    def _init_pool():
        """Create the connection pool (called once at import time)."""
        global _pg_pool
        if _pg_pool is None:
            # Set statement_timeout on all connections from the pool
            _pg_pool = ThreadedConnectionPool(
                DB_POOL_MIN,
                DB_POOL_MAX,
                DATABASE_URL,
                options=f"-c statement_timeout={DB_QUERY_TIMEOUT_MS}",
            )
            logger.info(f"[Lectly] PostgreSQL pool created (min={DB_POOL_MIN}, max={DB_POOL_MAX}, timeout={DB_QUERY_TIMEOUT_MS}ms)")

    def _close_pool():
        """Gracefully close all pooled connections on shutdown."""
        global _pg_pool
        if _pg_pool is not None:
            _pg_pool.closeall()
            _pg_pool = None
            logger.info("[Lectly] PostgreSQL pool closed")

    _init_pool()
    atexit.register(_close_pool)
else:
    import sqlite3
    DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "lectly.db")


def get_connection():
    """Get a database connection (from pool for PostgreSQL, new for SQLite).

    For PostgreSQL: validates the connection is alive before returning it.
    If a pooled connection is stale (server restarted, network blip), it's
    discarded and a fresh one is obtained.
    """
    if USE_POSTGRES:
        conn = _pg_pool.getconn()
        try:
            # Lightweight health check — catches stale/broken connections
            conn.cursor().execute("SELECT 1")
        except Exception:
            # Connection is dead — discard it and get a fresh one
            try:
                _pg_pool.putconn(conn, close=True)
            except Exception:
                pass
            conn = _pg_pool.getconn()
        return conn
    else:
        conn = sqlite3.connect(DB_PATH, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA busy_timeout=5000")  # Wait up to 5s for locks
        return conn


def _return_connection(conn):
    """Return a PostgreSQL connection to the pool, or close a SQLite connection."""
    if USE_POSTGRES:
        _pg_pool.putconn(conn)
    else:
        conn.close()


@contextmanager
def _get_conn():
    """Context manager that always returns the connection to the pool.

    Usage:
        with _get_conn() as conn:
            row = _fetchone(conn, ...)
            conn.commit()
    """
    conn = get_connection()
    try:
        yield conn
    except Exception:
        conn.rollback()
        raise
    finally:
        _return_connection(conn)


def _execute(conn, sql, params=None):
    """Execute SQL with the right placeholder style."""
    if params is None:
        params = ()
    cursor = conn.cursor()
    cursor.execute(sql, params)
    return cursor


def _fetchone(conn, sql, params=None):
    """Fetch one row as a dict."""
    if params is None:
        params = ()
    if USE_POSTGRES:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute(sql, params)
        row = cursor.fetchone()
        cursor.close()
        return dict(row) if row else None
    else:
        cursor = conn.execute(sql, params)
        row = cursor.fetchone()
        return dict(row) if row else None


def _fetchall(conn, sql, params=None):
    """Fetch all rows as dicts."""
    if params is None:
        params = ()
    if USE_POSTGRES:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        cursor.close()
        return [dict(r) for r in rows]
    else:
        cursor = conn.execute(sql, params)
        rows = cursor.fetchall()
        return [dict(r) for r in rows]


# Placeholder helper — %s for Postgres, ? for SQLite
P = "%s" if USE_POSTGRES else "?"


def close_pool():
    """Public shutdown hook — call from FastAPI lifespan or atexit."""
    if USE_POSTGRES:
        _close_pool()


def init_db():
    """Create tables if they don't exist. Safe to call multiple times."""
    conn = get_connection()
    cursor = conn.cursor()

    if USE_POSTGRES:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS lectures (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                filename TEXT NOT NULL,
                saved_filename TEXT NOT NULL,
                filepath TEXT NOT NULL,
                subject TEXT,
                size_bytes INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'uploaded',
                quality_score INTEGER,
                duration_seconds REAL,
                error TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS transcripts (
                id SERIAL PRIMARY KEY,
                lecture_id TEXT NOT NULL UNIQUE,
                transcript_text TEXT NOT NULL,
                segments TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notes (
                id SERIAL PRIMARY KEY,
                lecture_id TEXT NOT NULL UNIQUE,
                title TEXT NOT NULL,
                summary TEXT NOT NULL,
                sections TEXT NOT NULL,
                generated_at TEXT NOT NULL,
                FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS progress (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                lecture_id TEXT NOT NULL,
                section_index INTEGER NOT NULL DEFAULT -1,
                total_cards INTEGER NOT NULL DEFAULT 0,
                completed_cards INTEGER NOT NULL DEFAULT 0,
                quiz_correct INTEGER NOT NULL DEFAULT 0,
                quiz_total INTEGER NOT NULL DEFAULT 0,
                last_card_index INTEGER NOT NULL DEFAULT 0,
                mastery_pct INTEGER NOT NULL DEFAULT 0,
                last_studied_at TEXT NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(user_id, lecture_id, section_index),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS learn_mode_cache (
                id SERIAL PRIMARY KEY,
                lecture_id TEXT NOT NULL,
                section_index INTEGER NOT NULL,
                level TEXT NOT NULL DEFAULT 'intermediate',
                card_style TEXT NOT NULL DEFAULT 'mixed',
                response_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(lecture_id, section_index, level, card_style),
                FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                endpoint TEXT NOT NULL UNIQUE,
                subscription_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS subscriptions (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL UNIQUE,
                tier TEXT NOT NULL DEFAULT 'free',
                paystack_customer_code TEXT,
                paystack_subscription_code TEXT,
                paystack_authorization_code TEXT,
                paystack_email TEXT,
                lectures_limit INTEGER NOT NULL DEFAULT 3,
                current_period_start TEXT,
                current_period_end TEXT,
                status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        conn.commit()
    else:
        cursor.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS lectures (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                filename TEXT NOT NULL,
                saved_filename TEXT NOT NULL,
                filepath TEXT NOT NULL,
                subject TEXT,
                size_bytes INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'uploaded',
                quality_score INTEGER,
                duration_seconds REAL,
                error TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS transcripts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lecture_id TEXT NOT NULL UNIQUE,
                transcript_text TEXT NOT NULL,
                segments TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lecture_id TEXT NOT NULL UNIQUE,
                title TEXT NOT NULL,
                summary TEXT NOT NULL,
                sections TEXT NOT NULL,
                generated_at TEXT NOT NULL,
                FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS progress (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                lecture_id TEXT NOT NULL,
                section_index INTEGER NOT NULL DEFAULT -1,
                total_cards INTEGER NOT NULL DEFAULT 0,
                completed_cards INTEGER NOT NULL DEFAULT 0,
                quiz_correct INTEGER NOT NULL DEFAULT 0,
                quiz_total INTEGER NOT NULL DEFAULT 0,
                last_card_index INTEGER NOT NULL DEFAULT 0,
                mastery_pct INTEGER NOT NULL DEFAULT 0,
                last_studied_at TEXT NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(user_id, lecture_id, section_index),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS learn_mode_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lecture_id TEXT NOT NULL,
                section_index INTEGER NOT NULL,
                level TEXT NOT NULL DEFAULT 'intermediate',
                card_style TEXT NOT NULL DEFAULT 'mixed',
                response_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(lecture_id, section_index, level, card_style),
                FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                endpoint TEXT NOT NULL UNIQUE,
                subscription_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS subscriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL UNIQUE,
                tier TEXT NOT NULL DEFAULT 'free',
                paystack_customer_code TEXT,
                paystack_subscription_code TEXT,
                paystack_authorization_code TEXT,
                paystack_email TEXT,
                lectures_limit INTEGER NOT NULL DEFAULT 3,
                current_period_start TEXT,
                current_period_end TEXT,
                status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)
        conn.commit()

        # Migration: add user_id column to lectures if it doesn't exist
        try:
            cursor.execute("SELECT user_id FROM lectures LIMIT 1")
        except sqlite3.OperationalError:
            cursor.execute("ALTER TABLE lectures ADD COLUMN user_id TEXT")
            conn.commit()
            print("[Lectly] Migration: added user_id column to lectures")

    _return_connection(conn)
    db_name = "PostgreSQL" if USE_POSTGRES else f"SQLite at {DB_PATH}"
    print(f"[Lectly] Database initialized — {db_name}")


# ──────────────────────────────────────────────
# User CRUD
# ──────────────────────────────────────────────

def create_user(user_id: str, email: str, name: str, password_hash: str) -> dict:
    """Insert a new user record."""
    now = datetime.utcnow().isoformat()
    with _get_conn() as conn:
        _execute(
            conn,
            f"INSERT INTO users (id, email, name, password_hash, created_at) VALUES ({P}, {P}, {P}, {P}, {P})",
            (user_id, email.lower().strip(), name.strip(), password_hash, now),
        )
        conn.commit()
    return {"id": user_id, "email": email.lower().strip(), "name": name.strip(), "created_at": now}


def ensure_clerk_user(user_id: str) -> dict:
    """
    Make sure a Clerk user exists in our local users table.
    Creates a placeholder record if missing — Clerk handles real auth,
    we just need the row so the foreign key on lectures works.
    """
    existing = get_user_by_id(user_id)
    if existing:
        return existing

    now = datetime.utcnow().isoformat()
    with _get_conn() as conn:
        _execute(
            conn,
            f"""INSERT INTO users (id, email, name, password_hash, created_at)
                VALUES ({P}, {P}, {P}, {P}, {P})
                ON CONFLICT (id) DO NOTHING""",
            (user_id, f"{user_id}@clerk.user", "Clerk User", "clerk-managed", now),
        )
        conn.commit()
    return {"id": user_id, "email": f"{user_id}@clerk.user", "name": "Clerk User", "created_at": now}


def get_user_by_email(email: str) -> Optional[dict]:
    """Get a user by email address."""
    with _get_conn() as conn:
        return _fetchone(conn, f"SELECT * FROM users WHERE email = {P}", (email.lower().strip(),))


def get_user_by_id(user_id: str) -> Optional[dict]:
    """Get a user by ID."""
    with _get_conn() as conn:
        return _fetchone(conn, f"SELECT * FROM users WHERE id = {P}", (user_id,))


# ──────────────────────────────────────────────
# Lecture CRUD
# ──────────────────────────────────────────────

def create_lecture(lecture: dict) -> dict:
    """Insert a new lecture record."""
    with _get_conn() as conn:
        _execute(
            conn,
            f"""INSERT INTO lectures (id, user_id, filename, saved_filename, filepath, subject,
               size_bytes, status, quality_score, duration_seconds, error, created_at, updated_at)
               VALUES ({P}, {P}, {P}, {P}, {P}, {P}, {P}, {P}, {P}, {P}, {P}, {P}, {P})""",
            (
                lecture["id"],
                lecture.get("user_id"),
                lecture["filename"],
                lecture["saved_filename"],
                lecture["filepath"],
                lecture.get("subject"),
                lecture["size_bytes"],
                lecture["status"],
                lecture.get("quality_score"),
                lecture.get("duration_seconds"),
                lecture.get("error"),
                lecture["created_at"].isoformat() if isinstance(lecture["created_at"], datetime) else lecture["created_at"],
                lecture["updated_at"].isoformat() if isinstance(lecture["updated_at"], datetime) else lecture["updated_at"],
            ),
        )
        conn.commit()
    # Invalidate the user's lecture list cache
    if lecture.get("user_id"):
        invalidate_user_lectures(lecture["user_id"])
    return lecture


ALLOWED_LECTURE_UPDATE_COLUMNS = frozenset({
    "status", "subject", "quality_score", "duration_seconds",
    "error", "updated_at", "started_at", "processing_step",
})


def update_lecture(lecture_id: str, updates: dict):
    """Update specific fields on a lecture. Only whitelisted columns are accepted."""
    updates["updated_at"] = datetime.utcnow().isoformat()

    set_parts = []
    values = []
    for key, val in updates.items():
        if key not in ALLOWED_LECTURE_UPDATE_COLUMNS:
            raise ValueError(f"Cannot update disallowed column: {key}")
        set_parts.append(f"{key} = {P}")
        if isinstance(val, datetime):
            values.append(val.isoformat())
        else:
            values.append(val)

    values.append(lecture_id)

    with _get_conn() as conn:
        _execute(
            conn,
            f"UPDATE lectures SET {', '.join(set_parts)} WHERE id = {P}",
            values,
        )
        conn.commit()
    invalidate_lecture(lecture_id)


def get_lecture(lecture_id: str) -> Optional[dict]:
    """Get a lecture with its transcript and notes. Cached for repeat reads."""
    # Check cache first
    cached = cache.get(lecture_key(lecture_id))
    if cached is not None:
        return cached

    with _get_conn() as conn:
        lecture = _fetchone(conn, f"SELECT * FROM lectures WHERE id = {P}", (lecture_id,))
        if not lecture:
            return None

        # Get transcript
        t_row = _fetchone(
            conn,
            f"SELECT transcript_text, segments FROM transcripts WHERE lecture_id = {P}",
            (lecture_id,),
        )
        if t_row:
            lecture["transcript_text"] = t_row["transcript_text"]
            lecture["transcript"] = json.loads(t_row["segments"])
        else:
            lecture["transcript_text"] = None
            lecture["transcript"] = None

        # Get notes
        n_row = _fetchone(
            conn,
            f"SELECT title, summary, sections, generated_at FROM notes WHERE lecture_id = {P}",
            (lecture_id,),
        )
        if n_row:
            lecture["notes"] = {
                "title": n_row["title"],
                "summary": n_row["summary"],
                "sections": json.loads(n_row["sections"]),
                "generated_at": n_row["generated_at"],
            }
        else:
            lecture["notes"] = None

        # Only cache if lecture is in a stable state (ready or failed)
        # Don't cache mid-processing lectures since their status changes rapidly
        if lecture.get("status") in ("ready", "failed"):
            cache.set(lecture_key(lecture_id), lecture)

        return lecture


def delete_lecture(lecture_id: str) -> bool:
    """Delete a lecture and its associated transcript and notes (cascading)."""
    with _get_conn() as conn:
        cursor = _execute(conn, f"DELETE FROM lectures WHERE id = {P}", (lecture_id,))
        deleted = cursor.rowcount > 0
        conn.commit()
    invalidate_lecture(lecture_id)
    return deleted


def count_user_lectures(user_id: str) -> int:
    """Count how many lectures a user has."""
    with _get_conn() as conn:
        row = _fetchone(
            conn,
            f"SELECT COUNT(*) as cnt FROM lectures WHERE user_id = {P}",
            (user_id,),
        )
    return row["cnt"] if row else 0


def list_lectures(user_id: Optional[str] = None) -> list[dict]:
    """
    List lectures with their notes (for dashboard). Optionally filter by user.
    Uses a single LEFT JOIN query instead of N+1 queries — fetches lectures,
    notes, and transcript existence in one round trip to the database.
    """
    # Check cache for user-specific lists
    if user_id:
        cached = cache.get(lecture_list_key(user_id))
        if cached is not None:
            return cached

    with _get_conn() as conn:
        # Single query: lectures LEFT JOIN notes LEFT JOIN transcripts
        # This replaces the old N+1 pattern (1 + 2N queries → 1 query)
        base_sql = f"""
            SELECT
                l.*,
                n.title       AS notes_title,
                n.summary     AS notes_summary,
                n.sections    AS notes_sections,
                n.generated_at AS notes_generated_at,
                t.transcript_text
            FROM lectures l
            LEFT JOIN notes n ON n.lecture_id = l.id
            LEFT JOIN transcripts t ON t.lecture_id = l.id
        """
        if user_id:
            rows = _fetchall(
                conn,
                base_sql + f" WHERE l.user_id = {P} ORDER BY l.created_at DESC",
                (user_id,),
            )
        else:
            rows = _fetchall(conn, base_sql + " ORDER BY l.created_at DESC")

        lectures = []
        for row in rows:
            lecture = dict(row)

            # Build notes dict from the joined columns
            if lecture.pop("notes_title", None) is not None:
                lecture["notes"] = {
                    "title": row["notes_title"],
                    "summary": row["notes_summary"],
                    "sections": json.loads(row["notes_sections"]),
                    "generated_at": row["notes_generated_at"],
                }
            else:
                lecture["notes"] = None

            # Clean up the joined notes columns from the lecture dict
            lecture.pop("notes_summary", None)
            lecture.pop("notes_sections", None)
            lecture.pop("notes_generated_at", None)

            # transcript_text is already in the dict from the JOIN
            # Don't load full segments for list view
            lecture["transcript"] = None

            lectures.append(lecture)

    # Cache the result for this user
    if user_id:
        cache.set(lecture_list_key(user_id), lectures, ttl=120)  # 2 min TTL for lists

    return lectures


# ──────────────────────────────────────────────
# Transcript CRUD
# ──────────────────────────────────────────────

def save_transcript(lecture_id: str, transcript_text: str, segments: list):
    """Save or update a lecture transcript."""
    with _get_conn() as conn:
        if USE_POSTGRES:
            _execute(
                conn,
                f"""INSERT INTO transcripts (lecture_id, transcript_text, segments, created_at)
                   VALUES ({P}, {P}, {P}, {P})
                   ON CONFLICT(lecture_id) DO UPDATE SET
                   transcript_text = EXCLUDED.transcript_text,
                   segments = EXCLUDED.segments""",
                (lecture_id, transcript_text, json.dumps(segments), datetime.utcnow().isoformat()),
            )
        else:
            _execute(
                conn,
                f"""INSERT INTO transcripts (lecture_id, transcript_text, segments, created_at)
                   VALUES ({P}, {P}, {P}, {P})
                   ON CONFLICT(lecture_id) DO UPDATE SET
                   transcript_text = excluded.transcript_text,
                   segments = excluded.segments""",
                (lecture_id, transcript_text, json.dumps(segments), datetime.utcnow().isoformat()),
            )
        conn.commit()
    invalidate_lecture(lecture_id)


# ──────────────────────────────────────────────
# Notes CRUD
# ──────────────────────────────────────────────

def save_notes(lecture_id: str, title: str, summary: str, sections: list, generated_at: datetime):
    """Save or update lecture notes."""
    with _get_conn() as conn:
        if USE_POSTGRES:
            _execute(
                conn,
                f"""INSERT INTO notes (lecture_id, title, summary, sections, generated_at)
                   VALUES ({P}, {P}, {P}, {P}, {P})
                   ON CONFLICT(lecture_id) DO UPDATE SET
                   title = EXCLUDED.title,
                   summary = EXCLUDED.summary,
                   sections = EXCLUDED.sections,
                   generated_at = EXCLUDED.generated_at""",
                (lecture_id, title, summary, json.dumps(sections), generated_at.isoformat()),
            )
        else:
            _execute(
                conn,
                f"""INSERT INTO notes (lecture_id, title, summary, sections, generated_at)
                   VALUES ({P}, {P}, {P}, {P}, {P})
                   ON CONFLICT(lecture_id) DO UPDATE SET
                   title = excluded.title,
                   summary = excluded.summary,
                   sections = excluded.sections,
                   generated_at = excluded.generated_at""",
                (lecture_id, title, summary, json.dumps(sections), generated_at.isoformat()),
            )
        conn.commit()
    invalidate_lecture(lecture_id)


# ──────────────────────────────────────────────
# Learn Mode Cache
# ──────────────────────────────────────────────

def save_learn_mode_cache(lecture_id: str, section_index: int, level: str, card_style: str, response_json: str):
    """Cache a Learn Mode response for instant retrieval."""
    with _get_conn() as conn:
        if USE_POSTGRES:
            _execute(
                conn,
                f"""INSERT INTO learn_mode_cache (lecture_id, section_index, level, card_style, response_json, created_at)
                   VALUES ({P}, {P}, {P}, {P}, {P}, {P})
                   ON CONFLICT(lecture_id, section_index, level, card_style) DO UPDATE SET
                   response_json = EXCLUDED.response_json,
                   created_at = EXCLUDED.created_at""",
                (lecture_id, section_index, level, card_style, response_json, datetime.utcnow().isoformat()),
            )
        else:
            _execute(
                conn,
                f"""INSERT INTO learn_mode_cache (lecture_id, section_index, level, card_style, response_json, created_at)
                   VALUES ({P}, {P}, {P}, {P}, {P}, {P})
                   ON CONFLICT(lecture_id, section_index, level, card_style) DO UPDATE SET
                   response_json = excluded.response_json,
                   created_at = excluded.created_at""",
                (lecture_id, section_index, level, card_style, response_json, datetime.utcnow().isoformat()),
            )
        conn.commit()


def get_learn_mode_cache(lecture_id: str, section_index: int, level: str, card_style: str) -> Optional[str]:
    """Retrieve cached Learn Mode response. Returns JSON string or None."""
    # Check in-memory cache first
    mem_key = learn_cache_key(lecture_id, section_index, level, card_style)
    cached = cache.get(mem_key)
    if cached is not None:
        return cached

    with _get_conn() as conn:
        row = _fetchone(
            conn,
            f"SELECT response_json FROM learn_mode_cache WHERE lecture_id = {P} AND section_index = {P} AND level = {P} AND card_style = {P}",
            (lecture_id, section_index, level, card_style),
        )
    if row:
        # Store in memory for next time
        cache.set(mem_key, row["response_json"])
        return row["response_json"]
    return None


# ──────────────────────────────────────────────
# Progress Tracking
# ──────────────────────────────────────────────

def save_progress(
    user_id: str,
    lecture_id: str,
    section_index: int,
    total_cards: int,
    completed_cards: int,
    quiz_correct: int,
    quiz_total: int,
    last_card_index: int,
    mastery_pct: int,
) -> dict:
    """Save or update study progress for a lecture section."""
    now = datetime.utcnow().isoformat()
    with _get_conn() as conn:
        if USE_POSTGRES:
            _execute(
                conn,
                f"""INSERT INTO progress (user_id, lecture_id, section_index, total_cards,
                   completed_cards, quiz_correct, quiz_total, last_card_index, mastery_pct,
                   last_studied_at, created_at)
                   VALUES ({P}, {P}, {P}, {P}, {P}, {P}, {P}, {P}, {P}, {P}, {P})
                   ON CONFLICT(user_id, lecture_id, section_index) DO UPDATE SET
                   total_cards = EXCLUDED.total_cards,
                   completed_cards = EXCLUDED.completed_cards,
                   quiz_correct = EXCLUDED.quiz_correct,
                   quiz_total = EXCLUDED.quiz_total,
                   last_card_index = EXCLUDED.last_card_index,
                   mastery_pct = EXCLUDED.mastery_pct,
                   last_studied_at = EXCLUDED.last_studied_at""",
                (user_id, lecture_id, section_index, total_cards, completed_cards,
                 quiz_correct, quiz_total, last_card_index, mastery_pct, now, now),
            )
        else:
            _execute(
                conn,
                f"""INSERT INTO progress (user_id, lecture_id, section_index, total_cards,
                   completed_cards, quiz_correct, quiz_total, last_card_index, mastery_pct,
                   last_studied_at, created_at)
                   VALUES ({P}, {P}, {P}, {P}, {P}, {P}, {P}, {P}, {P}, {P}, {P})
                   ON CONFLICT(user_id, lecture_id, section_index) DO UPDATE SET
                   total_cards = excluded.total_cards,
                   completed_cards = excluded.completed_cards,
                   quiz_correct = excluded.quiz_correct,
                   quiz_total = excluded.quiz_total,
                   last_card_index = excluded.last_card_index,
                   mastery_pct = excluded.mastery_pct,
                   last_studied_at = excluded.last_studied_at""",
                (user_id, lecture_id, section_index, total_cards, completed_cards,
                 quiz_correct, quiz_total, last_card_index, mastery_pct, now, now),
            )
        conn.commit()
    return {
        "user_id": user_id,
        "lecture_id": lecture_id,
        "section_index": section_index,
        "total_cards": total_cards,
        "completed_cards": completed_cards,
        "quiz_correct": quiz_correct,
        "quiz_total": quiz_total,
        "last_card_index": last_card_index,
        "mastery_pct": mastery_pct,
        "last_studied_at": now,
    }


def get_progress(user_id: str, lecture_id: str, section_index: int = -1) -> Optional[dict]:
    """Get progress for a specific lecture section."""
    with _get_conn() as conn:
        return _fetchone(
            conn,
            f"SELECT * FROM progress WHERE user_id = {P} AND lecture_id = {P} AND section_index = {P}",
            (user_id, lecture_id, section_index),
        )


def get_lecture_progress(user_id: str, lecture_id: str) -> list[dict]:
    """Get all progress records for a lecture (across all sections)."""
    with _get_conn() as conn:
        return _fetchall(
            conn,
            f"SELECT * FROM progress WHERE user_id = {P} AND lecture_id = {P} ORDER BY section_index",
            (user_id, lecture_id),
        )


def get_all_progress(user_id: str) -> list[dict]:
    """Get all progress for a user, ordered by most recently studied."""
    with _get_conn() as conn:
        return _fetchall(
            conn,
            f"SELECT * FROM progress WHERE user_id = {P} ORDER BY last_studied_at DESC",
            (user_id,),
        )


def get_last_studied(user_id: str) -> Optional[dict]:
    """Get the most recently studied lecture progress record."""
    with _get_conn() as conn:
        return _fetchone(
            conn,
            f"SELECT * FROM progress WHERE user_id = {P} ORDER BY last_studied_at DESC LIMIT 1",
            (user_id,),
        )


# ──────────────────────────────────────────────
# Push Subscriptions
# ──────────────────────────────────────────────

def save_push_subscription(user_id: str, subscription: dict) -> dict:
    """
    Save a push subscription for a user.
    Uses the endpoint as a unique key — if the same browser re-subscribes,
    we update the record instead of creating a duplicate.
    """
    endpoint = subscription.get("endpoint", "")
    sub_json = json.dumps(subscription)
    now = datetime.utcnow().isoformat()

    with _get_conn() as conn:
        # Upsert: update if endpoint already exists, insert otherwise
        if USE_POSTGRES:
            _execute(
                conn,
                f"""INSERT INTO push_subscriptions (user_id, endpoint, subscription_json, created_at)
                    VALUES ({P}, {P}, {P}, {P})
                    ON CONFLICT (endpoint) DO UPDATE
                    SET user_id = EXCLUDED.user_id,
                        subscription_json = EXCLUDED.subscription_json""",
                (user_id, endpoint, sub_json, now),
            )
        else:
            _execute(
                conn,
                f"""INSERT OR REPLACE INTO push_subscriptions (user_id, endpoint, subscription_json, created_at)
                    VALUES ({P}, {P}, {P}, {P})""",
                (user_id, endpoint, sub_json, now),
            )
        conn.commit()

    return {"user_id": user_id, "endpoint": endpoint, "created_at": now}


def get_user_push_subscriptions(user_id: str) -> list[dict]:
    """Get all push subscriptions for a user (one per device/browser)."""
    with _get_conn() as conn:
        return _fetchall(
            conn,
            f"SELECT * FROM push_subscriptions WHERE user_id = {P}",
            (user_id,),
        )


def delete_push_subscription(endpoint: str):
    """Remove a push subscription by endpoint (e.g. when user unsubscribes)."""
    with _get_conn() as conn:
        _execute(
            conn,
            f"DELETE FROM push_subscriptions WHERE endpoint = {P}",
            (endpoint,),
        )
        conn.commit()


# ──────────────────────────────────────────────
# Subscriptions (Paystack)
# ──────────────────────────────────────────────

# Tier definitions: tier_name → lectures_limit
TIER_LIMITS = {
    "free": 3,
    "basic": 8,
    "pro": 20,
}


def get_subscription(user_id: str) -> Optional[dict]:
    """Get the subscription record for a user. Returns None if no subscription exists."""
    with _get_conn() as conn:
        return _fetchone(
            conn,
            f"SELECT * FROM subscriptions WHERE user_id = {P}",
            (user_id,),
        )


def get_user_tier(user_id: str) -> str:
    """Get the current tier for a user. Defaults to 'free' if no subscription."""
    sub = get_subscription(user_id)
    if not sub:
        return "free"
    # If subscription has expired or is inactive, treat as free
    if sub.get("status") != "active":
        return "free"
    return sub.get("tier", "free")


def get_user_lecture_limit(user_id: str) -> int:
    """Get the lecture limit based on user's subscription tier."""
    tier = get_user_tier(user_id)
    return TIER_LIMITS.get(tier, 3)


def upsert_subscription(user_id: str, data: dict) -> dict:
    """
    Create or update a subscription for a user.

    data can include: tier, paystack_customer_code, paystack_subscription_code,
    paystack_authorization_code, paystack_email, lectures_limit,
    current_period_start, current_period_end, status
    """
    now = datetime.utcnow().isoformat()
    existing = get_subscription(user_id)

    tier = data.get("tier", "basic")
    lectures_limit = data.get("lectures_limit", TIER_LIMITS.get(tier, 3))

    if existing:
        # Update existing subscription
        with _get_conn() as conn:
            _execute(
                conn,
                f"""UPDATE subscriptions SET
                    tier = {P},
                    paystack_customer_code = COALESCE({P}, paystack_customer_code),
                    paystack_subscription_code = COALESCE({P}, paystack_subscription_code),
                    paystack_authorization_code = COALESCE({P}, paystack_authorization_code),
                    paystack_email = COALESCE({P}, paystack_email),
                    paystack_reference = COALESCE({P}, paystack_reference),
                    lectures_limit = {P},
                    current_period_start = COALESCE({P}, current_period_start),
                    current_period_end = COALESCE({P}, current_period_end),
                    status = {P},
                    updated_at = {P}
                WHERE user_id = {P}""",
                (
                    tier,
                    data.get("paystack_customer_code"),
                    data.get("paystack_subscription_code"),
                    data.get("paystack_authorization_code"),
                    data.get("paystack_email"),
                    data.get("paystack_reference"),
                    lectures_limit,
                    data.get("current_period_start"),
                    data.get("current_period_end"),
                    data.get("status", "active"),
                    now,
                    user_id,
                ),
            )
            conn.commit()
    else:
        # Create new subscription
        with _get_conn() as conn:
            _execute(
                conn,
                f"""INSERT INTO subscriptions
                    (user_id, tier, paystack_customer_code, paystack_subscription_code,
                     paystack_authorization_code, paystack_email, paystack_reference,
                     lectures_limit, current_period_start, current_period_end,
                     status, created_at, updated_at)
                    VALUES ({P}, {P}, {P}, {P}, {P}, {P}, {P}, {P}, {P}, {P}, {P}, {P}, {P})""",
                (
                    user_id,
                    tier,
                    data.get("paystack_customer_code"),
                    data.get("paystack_subscription_code"),
                    data.get("paystack_authorization_code"),
                    data.get("paystack_email"),
                    data.get("paystack_reference"),
                    lectures_limit,
                    data.get("current_period_start"),
                    data.get("current_period_end"),
                    data.get("status", "active"),
                    now,
                    now,
                ),
            )
            conn.commit()

    return get_subscription(user_id)


def get_subscription_by_customer_code(customer_code: str) -> Optional[dict]:
    """Look up a subscription by Paystack customer code (used by webhooks)."""
    with _get_conn() as conn:
        return _fetchone(
            conn,
            f"SELECT * FROM subscriptions WHERE paystack_customer_code = {P}",
            (customer_code,),
        )


def get_subscription_by_reference(reference: str) -> Optional[dict]:
    """Look up a subscription by Paystack transaction reference (duplicate protection)."""
    with _get_conn() as conn:
        return _fetchone(
            conn,
            f"SELECT * FROM subscriptions WHERE paystack_reference = {P}",
            (reference,),
        )


def cancel_subscription(user_id: str):
    """Mark a subscription as cancelled (revert to free tier)."""
    now = datetime.utcnow().isoformat()
    with _get_conn() as conn:
        _execute(
            conn,
            f"""UPDATE subscriptions SET
                tier = 'free', status = 'cancelled', lectures_limit = 3, updated_at = {P}
            WHERE user_id = {P}""",
            (now, user_id),
        )
        conn.commit()


# ──────────────────────────────────────────────
# Migrations — version-based schema updates
# ──────────────────────────────────────────────

# Each migration is (version_number, description, sql_for_postgres, sql_for_sqlite).
# They run in order, once, on every server boot.
MIGRATIONS = [
    (
        1,
        "Add started_at and processing_step to lectures",
        "ALTER TABLE lectures ADD COLUMN IF NOT EXISTS started_at TEXT; "
        "ALTER TABLE lectures ADD COLUMN IF NOT EXISTS processing_step TEXT;",
        # SQLite doesn't support IF NOT EXISTS on ALTER TABLE, so we check in code
        None,
    ),
    (
        2,
        "Add indexes on lectures.user_id and progress columns",
        "CREATE INDEX IF NOT EXISTS idx_lectures_user_id ON lectures(user_id); "
        "CREATE INDEX IF NOT EXISTS idx_progress_user_id ON progress(user_id); "
        "CREATE INDEX IF NOT EXISTS idx_progress_lecture_id ON progress(lecture_id); "
        "CREATE INDEX IF NOT EXISTS idx_progress_user_lecture ON progress(user_id, lecture_id);",
        "CREATE INDEX IF NOT EXISTS idx_lectures_user_id ON lectures(user_id); "
        "CREATE INDEX IF NOT EXISTS idx_progress_user_id ON progress(user_id); "
        "CREATE INDEX IF NOT EXISTS idx_progress_lecture_id ON progress(lecture_id); "
        "CREATE INDEX IF NOT EXISTS idx_progress_user_lecture ON progress(user_id, lecture_id);",
    ),
    (
        3,
        "Add paystack_reference to subscriptions + index on customer_code",
        "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paystack_reference TEXT; "
        "CREATE INDEX IF NOT EXISTS idx_subs_customer_code ON subscriptions(paystack_customer_code); "
        "CREATE INDEX IF NOT EXISTS idx_subs_reference ON subscriptions(paystack_reference);",
        None,  # SQLite handled in code below
    ),
    (
        4,
        "Add indexes for status queries, subscriptions, push_subscriptions, learn_mode_cache",
        "CREATE INDEX IF NOT EXISTS idx_lectures_status ON lectures(status); "
        "CREATE INDEX IF NOT EXISTS idx_lectures_user_status ON lectures(user_id, status); "
        "CREATE INDEX IF NOT EXISTS idx_lectures_created ON lectures(created_at); "
        "CREATE INDEX IF NOT EXISTS idx_subs_user_id ON subscriptions(user_id); "
        "CREATE INDEX IF NOT EXISTS idx_subs_status ON subscriptions(status); "
        "CREATE INDEX IF NOT EXISTS idx_push_user_id ON push_subscriptions(user_id); "
        "CREATE INDEX IF NOT EXISTS idx_learn_cache_lookup ON learn_mode_cache(lecture_id, section_index, level, card_style); "
        "CREATE INDEX IF NOT EXISTS idx_progress_last_studied ON progress(user_id, last_studied_at);",
        "CREATE INDEX IF NOT EXISTS idx_lectures_status ON lectures(status); "
        "CREATE INDEX IF NOT EXISTS idx_lectures_user_status ON lectures(user_id, status); "
        "CREATE INDEX IF NOT EXISTS idx_lectures_created ON lectures(created_at); "
        "CREATE INDEX IF NOT EXISTS idx_subs_user_id ON subscriptions(user_id); "
        "CREATE INDEX IF NOT EXISTS idx_subs_status ON subscriptions(status); "
        "CREATE INDEX IF NOT EXISTS idx_push_user_id ON push_subscriptions(user_id); "
        "CREATE INDEX IF NOT EXISTS idx_learn_cache_lookup ON learn_mode_cache(lecture_id, section_index, level, card_style); "
        "CREATE INDEX IF NOT EXISTS idx_progress_last_studied ON progress(user_id, last_studied_at);",
    ),
]


def run_migrations():
    """Run any pending schema migrations. Safe to call on every startup."""
    with _get_conn() as conn:
        # Create migrations table if it doesn't exist
        if USE_POSTGRES:
            _execute(conn, """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version INTEGER PRIMARY KEY,
                    description TEXT,
                    applied_at TEXT NOT NULL
                )
            """)
        else:
            _execute(conn, """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version INTEGER PRIMARY KEY,
                    description TEXT,
                    applied_at TEXT NOT NULL
                )
            """)
        conn.commit()

        # Get current version
        row = _fetchone(conn, "SELECT MAX(version) as v FROM schema_migrations")
        current_version = (row["v"] or 0) if row else 0

        for version, description, pg_sql, sqlite_sql in MIGRATIONS:
            if version <= current_version:
                continue

            print(f"[Lectly] Running migration {version}: {description}")
            try:
                if USE_POSTGRES and pg_sql:
                    for stmt in pg_sql.split(";"):
                        stmt = stmt.strip()
                        if stmt:
                            _execute(conn, stmt)
                elif not USE_POSTGRES and sqlite_sql:
                    for stmt in sqlite_sql.split(";"):
                        stmt = stmt.strip()
                        if stmt:
                            _execute(conn, stmt)
                elif not USE_POSTGRES and sqlite_sql is None:
                    # SQLite-specific: add columns with try/except
                    if version == 1:
                        for col in ["started_at TEXT", "processing_step TEXT"]:
                            try:
                                _execute(conn, f"ALTER TABLE lectures ADD COLUMN {col}")
                            except Exception:
                                pass  # Column already exists
                    elif version == 3:
                        try:
                            _execute(conn, "ALTER TABLE subscriptions ADD COLUMN paystack_reference TEXT")
                        except Exception:
                            pass  # Column already exists
                        _execute(conn, "CREATE INDEX IF NOT EXISTS idx_subs_customer_code ON subscriptions(paystack_customer_code)")
                        _execute(conn, "CREATE INDEX IF NOT EXISTS idx_subs_reference ON subscriptions(paystack_reference)")

                _execute(
                    conn,
                    f"INSERT INTO schema_migrations (version, description, applied_at) VALUES ({P}, {P}, {P})",
                    (version, description, datetime.utcnow().isoformat()),
                )
                conn.commit()
                print(f"[Lectly] Migration {version} applied successfully")
            except Exception as e:
                conn.rollback()
                print(f"[Lectly] Migration {version} FAILED: {e}")
                raise


# ──────────────────────────────────────────────
# Stuck Lecture Recovery
# ──────────────────────────────────────────────

STUCK_TIMEOUT_MINUTES = 20


def recover_stuck_lectures():
    """
    Find lectures stuck in processing states and mark them as failed.

    This runs on every server boot to recover from crashes/restarts
    during processing. A lecture is "stuck" if it has been in a
    transitional status (processing, cleaning, transcribing, generating_notes)
    for longer than STUCK_TIMEOUT_MINUTES.
    """
    transitional_statuses = ("processing", "cleaning", "transcribing", "generating_notes")
    now = datetime.utcnow().isoformat()

    with _get_conn() as conn:
        # Find all lectures in transitional states
        placeholders = ", ".join([P] * len(transitional_statuses))
        stuck = _fetchall(
            conn,
            f"SELECT id, status, started_at, updated_at FROM lectures WHERE status IN ({placeholders})",
            transitional_statuses,
        )

        recovered = 0
        for lecture in stuck:
            # Determine how long it's been stuck
            ref_time = lecture.get("started_at") or lecture.get("updated_at")
            if not ref_time:
                # No timestamp at all — mark as failed
                _execute(
                    conn,
                    f"UPDATE lectures SET status = 'failed', error = {P}, updated_at = {P} WHERE id = {P}",
                    ("Processing interrupted by server restart. You can retry this lecture.", now, lecture["id"]),
                )
                recovered += 1
                invalidate_lecture(lecture["id"])
                continue

            try:
                ref_dt = datetime.fromisoformat(ref_time.replace("Z", "+00:00")) if "Z" in ref_time else datetime.fromisoformat(ref_time)
                now_dt = datetime.utcnow()
                elapsed_minutes = (now_dt - ref_dt).total_seconds() / 60
            except (ValueError, TypeError):
                elapsed_minutes = STUCK_TIMEOUT_MINUTES + 1  # Can't parse — assume stuck

            if elapsed_minutes >= STUCK_TIMEOUT_MINUTES:
                step = lecture.get("status", "unknown")
                _execute(
                    conn,
                    f"UPDATE lectures SET status = 'failed', error = {P}, updated_at = {P} WHERE id = {P}",
                    (
                        f"Processing timed out during '{step}' step (stuck for {int(elapsed_minutes)} minutes). You can retry this lecture.",
                        now,
                        lecture["id"],
                    ),
                )
                recovered += 1
                invalidate_lecture(lecture["id"])

        if recovered > 0:
            conn.commit()
            print(f"[Lectly] Recovered {recovered} stuck lecture(s) on startup")
        else:
            print(f"[Lectly] No stuck lectures found (checked {len(stuck)} in transitional states)")


def get_lectures_for_retry(lecture_id: str) -> Optional[dict]:
    """Get a lecture with info about whether it has a transcript (for smart retry)."""
    with _get_conn() as conn:
        lecture = _fetchone(conn, f"SELECT * FROM lectures WHERE id = {P}", (lecture_id,))
        if not lecture:
            return None

        # Check if transcript exists
        t_row = _fetchone(
            conn,
            f"SELECT lecture_id FROM transcripts WHERE lecture_id = {P}",
            (lecture_id,),
        )
        lecture["has_transcript"] = t_row is not None
        return lecture
