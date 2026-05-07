"""
Lectly Database — SQLite storage for lectures, transcripts, and notes.

Replaces the in-memory dict so data persists across server restarts.
Uses Python's built-in sqlite3 — no extra dependencies needed.
"""

import json
import sqlite3
import os
from datetime import datetime
from typing import Optional


# Database file path — stored in the backend directory
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "lectly.db")


def get_connection() -> sqlite3.Connection:
    """Get a database connection with row factory for dict-like access."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Access columns by name
    conn.execute("PRAGMA journal_mode=WAL")  # Better concurrent read performance
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Create tables if they don't exist. Safe to call multiple times."""
    conn = get_connection()
    cursor = conn.cursor()

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
    print(f"[Lectly] Database initialized at {DB_PATH}")


# ──────────────────────────────────────────────
# User CRUD
# ──────────────────────────────────────────────

def create_user(user_id: str, email: str, name: str, password_hash: str) -> dict:
    """Insert a new user record."""
    conn = get_connection()
    now = datetime.utcnow().isoformat()
    conn.execute(
        "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
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
    conn.execute(
        "INSERT OR IGNORE INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
        (user_id, f"{user_id}@clerk.user", "Clerk User", "clerk-managed", now),
    )
    conn.commit()
    conn.close()
    return {"id": user_id, "email": f"{user_id}@clerk.user", "name": "Clerk User", "created_at": now}


def get_user_by_email(email: str) -> Optional[dict]:
    """Get a user by email address."""
    conn = get_connection()
    row = conn.execute("SELECT * FROM users WHERE email = ?", (email.lower().strip(),)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_user_by_id(user_id: str) -> Optional[dict]:
    """Get a user by ID."""
    conn = get_connection()
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


# ──────────────────────────────────────────────
# Lecture CRUD
# ──────────────────────────────────────────────

def create_lecture(lecture: dict) -> dict:
    """Insert a new lecture record."""
    conn = get_connection()
    conn.execute(
        """INSERT INTO lectures (id, user_id, filename, saved_filename, filepath, subject,
           size_bytes, status, quality_score, duration_seconds, error, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
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
        set_parts.append(f"{key} = ?")
        if isinstance(val, datetime):
            values.append(val.isoformat())
        else:
            values.append(val)

    values.append(lecture_id)

    conn = get_connection()
    conn.execute(
        f"UPDATE lectures SET {', '.join(set_parts)} WHERE id = ?",
        values,
    )
    conn.commit()
    conn.close()


def get_lecture(lecture_id: str) -> Optional[dict]:
    """Get a lecture with its transcript and notes."""
    conn = get_connection()

    # Get lecture
    row = conn.execute("SELECT * FROM lectures WHERE id = ?", (lecture_id,)).fetchone()
    if not row:
        conn.close()
        return None

    lecture = dict(row)

    # Get transcript
    t_row = conn.execute(
        "SELECT transcript_text, segments FROM transcripts WHERE lecture_id = ?",
        (lecture_id,),
    ).fetchone()
    if t_row:
        lecture["transcript_text"] = t_row["transcript_text"]
        lecture["transcript"] = json.loads(t_row["segments"])
    else:
        lecture["transcript_text"] = None
        lecture["transcript"] = None

    # Get notes
    n_row = conn.execute(
        "SELECT title, summary, sections, generated_at FROM notes WHERE lecture_id = ?",
        (lecture_id,),
    ).fetchone()
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
    cursor = conn.execute("DELETE FROM lectures WHERE id = ?", (lecture_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted


def list_lectures(user_id: Optional[str] = None) -> list[dict]:
    """List lectures with their notes (for dashboard). Optionally filter by user."""
    conn = get_connection()

    if user_id:
        rows = conn.execute(
            "SELECT * FROM lectures WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM lectures ORDER BY created_at DESC"
        ).fetchall()

    lectures = []
    for row in rows:
        lecture = dict(row)

        # Get notes for each lecture
        n_row = conn.execute(
            "SELECT title, summary, sections, generated_at FROM notes WHERE lecture_id = ?",
            (lecture["id"],),
        ).fetchone()
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
        t_row = conn.execute(
            "SELECT transcript_text FROM transcripts WHERE lecture_id = ?",
            (lecture["id"],),
        ).fetchone()
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
    conn.execute(
        """INSERT INTO transcripts (lecture_id, transcript_text, segments, created_at)
           VALUES (?, ?, ?, ?)
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
    conn.execute(
        """INSERT INTO notes (lecture_id, title, summary, sections, generated_at)
           VALUES (?, ?, ?, ?, ?)
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
    conn.execute(
        """INSERT INTO progress (user_id, lecture_id, section_index, total_cards,
           completed_cards, quiz_correct, quiz_total, last_card_index, mastery_pct,
           last_studied_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    row = conn.execute(
        "SELECT * FROM progress WHERE user_id = ? AND lecture_id = ? AND section_index = ?",
        (user_id, lecture_id, section_index),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def get_lecture_progress(user_id: str, lecture_id: str) -> list[dict]:
    """Get all progress records for a lecture (across all sections)."""
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM progress WHERE user_id = ? AND lecture_id = ? ORDER BY section_index",
        (user_id, lecture_id),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_all_progress(user_id: str) -> list[dict]:
    """Get all progress for a user, ordered by most recently studied."""
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM progress WHERE user_id = ? ORDER BY last_studied_at DESC",
        (user_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_last_studied(user_id: str) -> Optional[dict]:
    """Get the most recently studied lecture progress record."""
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM progress WHERE user_id = ? ORDER BY last_studied_at DESC LIMIT 1",
        (user_id,),
    ).fetchone()
    conn.close()
    return dict(row) if row else None
