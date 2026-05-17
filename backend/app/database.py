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

    def _init_pool():
        """Create the connection pool (called once at import time)."""
        global _pg_pool
        if _pg_pool is None:
            _pg_pool = ThreadedConnectionPool(
                DB_POOL_MIN,
                DB_POOL_MAX,
                DATABASE_URL,
            )
            logger.info(f"[Lectly] PostgreSQL pool created (min={DB_POOL_MIN}, max={DB_POOL_MAX})")

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
    """Get a database connection (from pool for PostgreSQL, new for SQLite)."""
    if USE_POSTGRES:
        return _pg_pool.getconn()
    else:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
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
    return lecture


ALLOWED_LECTURE_UPDATE_COLUMNS = frozenset({
    "status", "subject", "quality_score", "duration_seconds",
    "error", "updated_at",
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


def get_lecture(lecture_id: str) -> Optional[dict]:
    """Get a lecture with its transcript and notes."""
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

        return lecture


def delete_lecture(lecture_id: str) -> bool:
    """Delete a lecture and its associated transcript and notes (cascading)."""
    with _get_conn() as conn:
        cursor = _execute(conn, f"DELETE FROM lectures WHERE id = {P}", (lecture_id,))
        deleted = cursor.rowcount > 0
        conn.commit()
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
    """List lectures with their notes (for dashboard). Optionally filter by user."""
    with _get_conn() as conn:
        if user_id:
            rows = _fetchall(
                conn,
                f"SELECT * FROM lectures WHERE user_id = {P} ORDER BY created_at DESC",
                (user_id,),
            )
        else:
            rows = _fetchall(conn, "SELECT * FROM lectures ORDER BY created_at DESC")

        lectures = []
        for lecture in rows:
            # Get notes for each lecture
            n_row = _fetchone(
                conn,
                f"SELECT title, summary, sections, generated_at FROM notes WHERE lecture_id = {P}",
                (lecture["id"],),
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

            # Check if transcript exists
            t_row = _fetchone(
                conn,
                f"SELECT transcript_text FROM transcripts WHERE lecture_id = {P}",
                (lecture["id"],),
            )
            lecture["transcript_text"] = t_row["transcript_text"] if t_row else None
            lecture["transcript"] = None  # Don't load full segments for list view

            lectures.append(lecture)

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
    with _get_conn() as conn:
        row = _fetchone(
            conn,
            f"SELECT response_json FROM learn_mode_cache WHERE lecture_id = {P} AND section_index = {P} AND level = {P} AND card_style = {P}",
            (lecture_id, section_index, level, card_style),
        )
    return row["response_json"] if row else None


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
