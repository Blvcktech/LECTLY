"""
Lectly — Metrics Endpoint

Admin-only endpoint that returns key application metrics.
Protected by a shared secret (METRICS_SECRET env var).

GET /api/metrics?key=<secret>
"""

import os
import logging
from fastapi import APIRouter, HTTPException, Query

from app.database import get_connection, _return_connection, USE_POSTGRES

logger = logging.getLogger("lectly.metrics")
router = APIRouter(prefix="/api/metrics", tags=["metrics"])

METRICS_SECRET = os.environ.get("METRICS_SECRET", "")


def _require_metrics_key(key: str):
    """Validate the metrics access key."""
    if not METRICS_SECRET:
        raise HTTPException(status_code=404, detail="Not found")
    if key != METRICS_SECRET:
        raise HTTPException(status_code=403, detail="Invalid key")


def _query_scalar(conn, sql, params=None):
    """Run a query and return a single scalar value."""
    cursor = conn.cursor()
    cursor.execute(sql, params or ())
    row = cursor.fetchone()
    return row[0] if row else 0


@router.get("")
async def get_metrics(key: str = Query(..., description="Metrics access key")):
    """Return application metrics. Requires METRICS_SECRET."""
    _require_metrics_key(key)

    conn = get_connection()
    try:
        # ── User metrics ──
        total_users = _query_scalar(conn, "SELECT COUNT(*) FROM users")

        # Users by tier
        if USE_POSTGRES:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT COALESCE(tier, 'free'), COUNT(*) FROM users GROUP BY tier"
            )
            tier_rows = cursor.fetchall()
        else:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT COALESCE(tier, 'free'), COUNT(*) FROM users GROUP BY tier"
            )
            tier_rows = cursor.fetchall()
        users_by_tier = {row[0]: row[1] for row in tier_rows}

        # ── Lecture metrics ──
        total_lectures = _query_scalar(conn, "SELECT COUNT(*) FROM lectures")

        # Lectures by status
        cursor = conn.cursor()
        cursor.execute(
            "SELECT status, COUNT(*) FROM lectures GROUP BY status"
        )
        status_rows = cursor.fetchall()
        lectures_by_status = {row[0]: row[1] for row in status_rows}

        # Lectures created in last 24h
        if USE_POSTGRES:
            recent_lectures = _query_scalar(
                conn,
                "SELECT COUNT(*) FROM lectures WHERE created_at > NOW() - INTERVAL '24 hours'"
            )
        else:
            recent_lectures = _query_scalar(
                conn,
                "SELECT COUNT(*) FROM lectures WHERE created_at > datetime('now', '-24 hours')"
            )

        # ── Processing metrics ──
        if USE_POSTGRES:
            avg_processing = _query_scalar(
                conn,
                """SELECT ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at))))
                   FROM lectures WHERE status = 'ready'"""
            )
        else:
            avg_processing = _query_scalar(
                conn,
                """SELECT ROUND(AVG(
                     CAST((julianday(updated_at) - julianday(created_at)) * 86400 AS REAL)
                   )) FROM lectures WHERE status = 'ready'"""
            )

        # Error rate (failed / total)
        failed = lectures_by_status.get("failed", 0)
        error_rate = round(failed / total_lectures * 100, 1) if total_lectures > 0 else 0

        # ── Subscription metrics ──
        active_subs = _query_scalar(
            conn,
            "SELECT COUNT(*) FROM subscriptions WHERE status = 'active'"
        ) if _table_exists(conn, "subscriptions") else 0

        return {
            "users": {
                "total": total_users,
                "by_tier": users_by_tier,
            },
            "lectures": {
                "total": total_lectures,
                "by_status": lectures_by_status,
                "last_24h": recent_lectures,
                "avg_processing_seconds": int(avg_processing or 0),
                "error_rate_pct": error_rate,
            },
            "subscriptions": {
                "active": active_subs,
            },
        }
    finally:
        _return_connection(conn)


def _table_exists(conn, table_name: str) -> bool:
    """Check if a table exists in the database."""
    try:
        if USE_POSTGRES:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = %s)",
                (table_name,),
            )
            return cursor.fetchone()[0]
        else:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?",
                (table_name,),
            )
            return cursor.fetchone()[0] > 0
    except Exception:
        return False
