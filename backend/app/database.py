"""
Lectly Database — PostgreSQL (production) / SQLite (local dev).

Uses DATABASE_URL env var to connect to PostgreSQL on Railway.
Falls back to SQLite if DATABASE_URL is not set (local development).
"""

import json
import os
from datetime import datetime
from typing import Optional


# ──────────────────────────────────────────────
# Connection setup — PostgreSQL or SQLite
# ──────────────────────────────────────────────

DATABASE_URL = os.environ.get("DATABASE_URL")
USE_POSTGRES = DATABASE_URL is not None

if USE_POSTGRES:
    import psycopg2
    import psycopg2.extras
else:
    import sqlite3
    DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "lectly.db")


def get_connection():
    """Get a database connection."""
    if USE_POSTGRES:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    else:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        return conn


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
        """)
        conn.commit()

        # Migration: add user_id column to lectures if it doesn't exist
        try:
            cursor.execute("SELECT user_id FROM lectures LIMIT 1")
        except sqlite3.OperationalError:
            cursor.execute("ALTER TABLE lectures ADD COLUMN user_id TEXT")
            conn.commit()
            print("[Lectly] Migration: added user_id column to lectures")

    conn.close()
    db_name = "PostgreSQL" if USE_POSTGRES else f"SQLite at {DB_PATH}"
    print(f"[Lectly] Database initialized — {db_name}")


# ──────────────────────────────────────────────
# User CRUD
# ──────────────────────────────────────────────

def create_user(user_id: str, email: str, name: str, password_hash: str) -> dict:
    """Insert a new user record."""
    conn = get_connection()
    now = datetime.utcnow().isoformat()
    _execute(
        conn,
        f"INSERT INTO users (id, email, name, password_hash, created_at) VALUES ({P}, {P}, {P}, {P}, {P})",
        (user_id, email.lower().strip(), name.strip(), password_hash, now),
    )
    conn.commit()
    conn.close()
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

    conn = get_connection()
    now = datetime.utcnow().isoformat()
    _execute(
        conn,
        f"""INSERT INTO users (id, email, name, password_hash, created_at)
            VALUES ({P}, {P}, {P}, {P}, {P})
            ON CONFLICT (id) DO NOTHING""",
        (user_id, f"{user_id}@clerk.user", "Clerk User", "clerk-managed", now),
    )
    conn.commit()
    conn.close()
    return {"id": user_id, "email": f"{user_id}@clerk.user", "name": "Clerk User", "created_at": now}


def get_user_by_email(email: str) -> Optional[dict]:
    """Get a user by email address."""
    conn = get_connection()
    row = _fetchone(conn, f"SELECT * FROM users WHERE email = {P}", (email.lower().strip(),))
    conn.close()
    return row


def get_user_by_id(user_id: str) -> Optional[dict]:
    """Get a user by ID."""
    conn = get_connection()
    row = _fetchone(conn, f"SELECT * FROM users WHERE id = {P}", (user_id,))
    conn.close()
    return row


# ──────────────────────────────────────────────
# Lecture CRUD
# ──────────────────────────────────────────────

def create_lecture(lecture: dict) -> dict:
    """Insert a new lecture record."""
    conn = get_connection()
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
    conn.close()
    return lecture


def update_lecture(lecture_id: str, updates: dict):
    """Update specific fields on a lecture."""
    updates["updated_at"] = datetime.utcnow().isoformat()

    set_parts = []
    values = []
    for key, val in updates.items():
        set_parts.append(f"{key} = {P}")
        if isinstance(val, datetime):
            values.append(val.isoformat())
        else:
            values.append(val)

    values.append(lecture_id)

    conn = get_connection()
    _execute(
        conn,
        f"UPDATE lectures SET {', '.join(set_parts)} WHERE id = {P}",
        values,
    )
    conn.commit()
    conn.close()


def get_lecture(lecture_id: str) -> Optional[dict]:
    """Get a lecture with its transcript and notes."""
    conn = get_connection()

    lecture = _fetchone(conn, f"SELECT * FROM lectures WHERE id = {P}", (lecture_id,))
    if not lecture:
        conn.close()
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

    conn.close()
    return lecture


def delete_lecture(lecture_id: str) -> bool:
    """Delete a lecture and its associated transcript and notes (cascading)."""
    conn = get_connection()
    cursor = _execute(conn, f"DELETE FROM lectures WHERE id = {P}", (lecture_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted


def count_user_lectures(user_id: str) -> int:
    """Count how many lectures a user has."""
    conn = get_connection()
    row = _fetchone(
        conn,
        f"SELECT COUNT(*) as cnt FROM lectures WHERE user_id = {P}",
        (user_id,),
    )
    conn.close()
    return row["cnt"] if row else 0


def list_lectures(user_id: Optional[str] = None) -> list[dict]:
    """List lectures with their notes (for dashboard). Optionally filter by user."""
    conn = get_connection()

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

    conn.close()
    return lectures


# ──────────────────────────────────────────────
# Transcript CRUD
# ──────────────────────────────────────────────

def save_transcript(lecture_id: str, transcript_text: str, segments: list):
    """Save or update a lecture transcript."""
    conn = get_connection()
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
    conn.close()


# ──────────────────────────────────────────────
# Notes CRUD
# ──────────────────────────────────────────────

def save_notes(lecture_id: str, title: str, summary: str, sections: list, generated_at: datetime):
    """Save or update lecture notes."""
    conn = get_connection()
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
    conn.close()


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
    conn = get_connection()
    now = datetime.utcnow().isoformat()
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
    conn.close()
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
    conn = get_connection()
    row = _fetchone(
        conn,
        f"SELECT * FROM progress WHERE user_id = {P} AND lecture_id = {P} AND section_index = {P}",
        (user_id, lecture_id, section_index),
    )
    conn.close()
    return row


def get_lecture_progress(user_id: str, lecture_id: str) -> list[dict]:
    """Get all progress records for a lecture (across all sections)."""
    conn = get_connection()
    rows = _fetchall(
        conn,
        f"SELECT * FROM progress WHERE user_id = {P} AND lecture_id = {P} ORDER BY section_index",
        (user_id, lecture_id),
    )
    conn.close()
    return rows


def get_all_progress(user_id: str) -> list[dict]:
    """Get all progress for a user, ordered by most recently studied."""
    conn = get_connection()
    rows = _fetchall(
        conn,
        f"SELECT * FROM progress WHERE user_id = {P} ORDER BY last_studied_at DESC",
        (user_id,),
    )
    conn.close()
    return rows


def get_last_studied(user_id: str) -> Optional[dict]:
    """Get the most recently studied lecture progress record."""
    conn = get_connection()
    row = _fetchone(
        conn,
        f"SELECT * FROM progress WHERE user_id = {P} ORDER BY last_studied_at DESC LIMIT 1",
        (user_id,),
    )
    conn.close()
    return row
