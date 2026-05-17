"""
Lecture routes — upload, process, retrieve, explain, learn, tutor, solve.
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import Response
from typing import Optional

from app.config import get_settings
from app.rate_limit import limiter
from app.models.lecture import (
    LectureUploadResponse,
    LectureResponse,
    ExplainRequest,
    ExplainResponse,
    LearnModeRequest,
    LearnModeResponse,
    TutorAskRequest,
    TutorAskResponse,
    SolveModeRequest,
    SolveModeResponse,
    ProgressSaveRequest,
    ProgressResponse,
)
import os
from app.services.audio import save_upload, transcribe_audio, get_lecture, list_lectures
from app.services.notes import generate_notes, explain_text, learn_mode, ask_tutor, solve_problem
from app.services.pdf_export import generate_notes_pdf
from app.database import (
    delete_lecture as db_delete_lecture,
    update_lecture as update_lecture_db,
    ensure_clerk_user,
    count_user_lectures,
    save_progress as db_save_progress,
    get_progress as db_get_progress,
    get_lecture_progress as db_get_lecture_progress,
    get_all_progress as db_get_all_progress,
    get_last_studied as db_get_last_studied,
)


router = APIRouter(prefix="/api", tags=["lectures"])


import jwt
from jwt import PyJWKClient
import time

# Cache the JWKS client so we don't re-fetch keys on every request
_jwks_client: Optional[PyJWKClient] = None
_jwks_client_init_time: float = 0


def _get_jwks_client() -> Optional[PyJWKClient]:
    """Get or create a cached JWKS client for Clerk token verification."""
    global _jwks_client, _jwks_client_init_time
    settings = get_settings()
    if not settings.clerk_issuer:
        return None
    # Refresh the client every 6 hours to pick up key rotations
    if _jwks_client is None or (time.time() - _jwks_client_init_time) > 21600:
        jwks_url = f"{settings.clerk_issuer.rstrip('/')}/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url, cache_keys=True)
        _jwks_client_init_time = time.time()
    return _jwks_client


def _get_user_id_from_header(request: Request) -> Optional[str]:
    """
    Extract user ID from Clerk session token in the Authorization header.
    Verifies the JWT signature against Clerk's JWKS public keys.
    Falls back to unverified decode only if CLERK_ISSUER is not configured (local dev).
    """
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header[7:]

    settings = get_settings()
    jwks_client = _get_jwks_client()

    # ── Production: Verify JWT signature with Clerk's JWKS ──
    if jwks_client and settings.clerk_issuer:
        try:
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                options={
                    "verify_aud": False,    # Clerk tokens don't always have aud
                    "verify_iss": False,    # Issuer already trusted via JWKS endpoint
                },
            )
            return payload.get("sub")
        except jwt.ExpiredSignatureError:
            print("[Lectly] JWT expired")
            return None
        except jwt.InvalidTokenError as e:
            print(f"[Lectly] JWT verification failed: {e}")
            return None
        except Exception as e:
            # JWKS fetch failed, key not found, network error, etc.
            # Do NOT fall through to unverified decode — that would be a security hole.
            print(f"[Lectly] JWKS verification error: {e}")
            return None

    # ── Local dev fallback: decode without verification ──
    # ONLY when CLERK_ISSUER is not configured (i.e. local development).
    # This block is unreachable when clerk_issuer is set because the
    # production branch above always returns.
    if not settings.clerk_issuer:
        try:
            import json, base64
            payload_b64 = token.split(".")[1]
            payload_b64 += "=" * (4 - len(payload_b64) % 4)
            payload = json.loads(base64.urlsafe_b64decode(payload_b64))
            return payload.get("sub")
        except Exception:
            return None

    return None


def _require_user_id(request: Request) -> str:
    """Extract user ID from request, raising 401 if missing."""
    user_id = _get_user_id_from_header(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user_id


@router.post("/upload", response_model=LectureUploadResponse)
@limiter.limit("10/hour")
async def upload_lecture(
    request: Request,
    file: UploadFile = File(...),
    subject: Optional[str] = Form(None),
):
    """Upload a lecture audio file for processing."""
    settings = get_settings()

    # Require authentication
    user_id = _require_user_id(request)

    # Ensure user exists in our database (Clerk handles real auth,
    # but we need a users row so the foreign key on lectures works)
    ensure_clerk_user(user_id)

    # Enforce free tier lecture limit (3 lectures for free users)
    # TODO: Check user's subscription tier once payment is integrated
    FREE_TIER_LIMIT = 3
    current_count = count_user_lectures(user_id)
    if current_count >= FREE_TIER_LIMIT:
        raise HTTPException(
            status_code=403,
            detail=f"Free tier limit reached ({FREE_TIER_LIMIT} lectures). Upgrade to upload more.",
        )

    # Validate file extension
    allowed_exts = settings.allowed_audio_extensions.split(",")
    file_ext = "." + (file.filename or "").rsplit(".", 1)[-1].lower()

    if file_ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {', '.join(allowed_exts)}",
        )

    # Read file content
    content = await file.read()

    # Check file size
    max_bytes = settings.max_file_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: {settings.max_file_size_mb}MB",
        )

    # Save and create record
    result = await save_upload(content, file.filename or "audio.mp3", subject, user_id=user_id)
    return result


@router.post("/lectures/{lecture_id}/process")
@limiter.limit("10/hour")
async def process_lecture(lecture_id: str, request: Request):
    """Trigger full processing pipeline: transcribe → generate notes."""
    user_id = _require_user_id(request)

    lecture = await get_lecture(lecture_id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    # Verify ownership
    if lecture.get("user_id") and lecture["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to process this lecture")

    # Step 1: Transcribe
    await transcribe_audio(lecture_id)

    # Step 2: Generate structured notes
    notes = await generate_notes(lecture_id)

    return {
        "lecture_id": lecture_id,
        "status": "ready",
        "message": "Lecture processed successfully",
        "notes_title": notes.title,
        "sections_count": len(notes.sections),
    }


@router.get("/lectures")
async def get_lectures(request: Request):
    """List all lectures for the current user."""
    user_id = _require_user_id(request)
    lectures = await list_lectures(user_id=user_id)
    return {"lectures": lectures, "count": len(lectures)}


@router.get("/lectures/{lecture_id}")
async def get_lecture_detail(lecture_id: str, request: Request):
    """Get full lecture details including notes."""
    user_id = _require_user_id(request)

    lecture = await get_lecture(lecture_id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    # Verify ownership
    if lecture.get("user_id") and lecture["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this lecture")

    return lecture


@router.post("/explain", response_model=ExplainResponse)
@limiter.limit("30/hour")
async def explain_section(body: ExplainRequest, request: Request):
    """Explain a highlighted section of notes in simpler terms."""
    _require_user_id(request)
    return await explain_text(body)


@router.post("/learn", response_model=LearnModeResponse)
@limiter.limit("20/hour")
async def activate_learn_mode(body: LearnModeRequest, request: Request):
    """Activate Learn Mode for a lecture section."""
    user_id = _require_user_id(request)

    # Verify the user owns this lecture
    lecture = await get_lecture(body.lecture_id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")
    if lecture.get("user_id") and lecture["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    return await learn_mode(body)


@router.post("/tutor/ask", response_model=TutorAskResponse)
@limiter.limit("60/hour")
async def tutor_ask(body: TutorAskRequest, request: Request):
    """Ask the AI Tutor a question about a lecture. Context-aware, conversational."""
    user_id = _require_user_id(request)

    # Verify ownership
    lecture_check = await get_lecture(body.lecture_id)
    if not lecture_check:
        raise HTTPException(status_code=404, detail="Lecture not found")
    if lecture_check.get("user_id") and lecture_check["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        # Convert conversation history to dicts for the service
        history = [{"role": msg.role, "content": msg.content} for msg in body.conversation_history]

        # Convert card context to dict if present
        card_ctx = None
        if body.card_context:
            card_ctx = {
                "card_type": body.card_context.card_type,
                "card_content": body.card_context.card_content,
                "card_title": body.card_context.card_title,
                "quiz_question": body.card_context.quiz_question,
                "quiz_options": body.card_context.quiz_options,
                "student_answer": body.card_context.student_answer,
                "correct_answer": body.card_context.correct_answer,
            }

        answer = await ask_tutor(
            lecture_id=body.lecture_id,
            question=body.question,
            conversation_history=history,
            current_section_index=body.current_section_index,
            card_context=card_ctx,
        )

        # Try to detect which section was referenced in the answer
        section_referenced = None
        if body.current_section_index is not None:
            from app.database import get_lecture as db_get
            lecture = db_get(body.lecture_id)
            if lecture and lecture.get("notes"):
                sections = lecture["notes"].get("sections", [])
                if body.current_section_index < len(sections):
                    section_referenced = sections[body.current_section_index].get("heading")

        return TutorAskResponse(
            answer=answer,
            lecture_id=body.lecture_id,
            section_referenced=section_referenced,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"[Lectly] Tutor ask failed: {e}")
        raise HTTPException(status_code=500, detail=f"Tutor error: {str(e)}")


@router.post("/solve", response_model=SolveModeResponse)
@limiter.limit("20/hour")
async def solve_mode(body: SolveModeRequest, request: Request):
    """Solve Mode — walk through a problem step by step."""
    user_id = _require_user_id(request)

    # Verify the user owns this lecture
    lecture = await get_lecture(body.lecture_id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")
    if lecture.get("user_id") and lecture["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        return await solve_problem(body)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"[Lectly] Solve Mode failed: {e}")
        raise HTTPException(status_code=500, detail=f"Solve Mode error: {str(e)}")


@router.get("/lectures/{lecture_id}/pdf")
async def download_notes_pdf(lecture_id: str, request: Request):
    """Download lecture notes as a formatted PDF."""
    user_id = _require_user_id(request)

    # Verify ownership before generating
    lecture_check = await get_lecture(lecture_id)
    if not lecture_check:
        raise HTTPException(status_code=404, detail="Lecture not found")
    if lecture_check.get("user_id") and lecture_check["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to export this lecture")

    try:
        pdf_bytes = generate_notes_pdf(lecture_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Get lecture for filename
    lecture = await get_lecture(lecture_id)
    title = "Lectly-Notes"
    if lecture and lecture.get("notes"):
        title = lecture["notes"].get("title", "Lectly-Notes")
    # Clean filename
    safe_title = "".join(c if c.isalnum() or c in " -_" else "" for c in title)[:60].strip()
    filename = f"{safe_title}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.delete("/lectures/{lecture_id}")
async def delete_lecture(lecture_id: str, request: Request):
    """Delete a lecture and all associated data."""
    user_id = _require_user_id(request)

    lecture = await get_lecture(lecture_id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    # Verify ownership
    if lecture.get("user_id") and lecture["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this lecture")

    # Delete audio files from disk
    filepath = lecture.get("filepath", "")
    if filepath and os.path.exists(filepath):
        os.remove(filepath)
        # Also remove cleaned version if it exists
        clean_path = filepath.rsplit(".", 1)[0] + "_clean.mp3"
        if os.path.exists(clean_path):
            os.remove(clean_path)

    # Delete from database (cascades to transcripts and notes)
    db_delete_lecture(lecture_id)

    return {"message": "Lecture deleted successfully", "lecture_id": lecture_id}


@router.patch("/lectures/{lecture_id}")
async def update_lecture_details(lecture_id: str, request: Request):
    """Update lecture details (title, subject)."""
    from datetime import datetime
    from app.database import save_notes

    user_id = _require_user_id(request)

    lecture = await get_lecture(lecture_id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    # Verify ownership
    if lecture.get("user_id") and lecture["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this lecture")

    body = await request.json()
    updates = {}

    if "title" in body and body["title"]:
        title = body["title"].strip()
        if lecture.get("notes"):
            notes = lecture["notes"]
            save_notes(
                lecture_id,
                title,
                notes.get("summary", ""),
                notes.get("sections", []),
                datetime.utcnow(),
            )

    if "subject" in body:
        updates["subject"] = body["subject"]

    if updates:
        update_lecture_db(lecture_id, updates)

    return {"message": "Lecture updated", "lecture_id": lecture_id}


# ──────────────────────────────────────────────
# Progress Tracking
# ──────────────────────────────────────────────

@router.post("/progress", response_model=ProgressResponse)
async def save_progress(request_body: ProgressSaveRequest, request: Request):
    """Save study progress for a lecture section."""
    user_id = _get_user_id_from_header(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    result = db_save_progress(
        user_id=user_id,
        lecture_id=request_body.lecture_id,
        section_index=request_body.section_index,
        total_cards=request_body.total_cards,
        completed_cards=request_body.completed_cards,
        quiz_correct=request_body.quiz_correct,
        quiz_total=request_body.quiz_total,
        last_card_index=request_body.last_card_index,
        mastery_pct=request_body.mastery_pct,
    )
    return result


@router.get("/progress")
async def get_all_progress(request: Request):
    """Get all progress for the current user."""
    user_id = _get_user_id_from_header(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    progress = db_get_all_progress(user_id)
    last_studied = db_get_last_studied(user_id)
    return {"progress": progress, "last_studied": last_studied}


@router.get("/progress/{lecture_id}")
async def get_lecture_progress(lecture_id: str, request: Request):
    """Get progress for a specific lecture."""
    user_id = _get_user_id_from_header(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    progress = db_get_lecture_progress(user_id, lecture_id)
    return {"progress": progress}


# ──────────────────────────────────────────────
# User Limits
# ──────────────────────────────────────────────

@router.get("/user/limits")
async def get_user_limits(request: Request):
    """Get current usage limits for the authenticated user."""
    user_id = _require_user_id(request)

    # TODO: Check subscription tier once payment is integrated
    FREE_TIER_LIMIT = 3
    current_count = count_user_lectures(user_id)

    return {
        "tier": "free",
        "lectures_used": current_count,
        "lectures_limit": FREE_TIER_LIMIT,
        "lectures_remaining": max(0, FREE_TIER_LIMIT - current_count),
        "can_upload": current_count < FREE_TIER_LIMIT,
    }
