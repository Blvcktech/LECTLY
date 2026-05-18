"""
Lecture routes — upload, process, retrieve, explain, learn, tutor, solve.

All endpoints use Depends(get_current_user) for authentication.
This means auth is enforced automatically — you can't accidentally
add an unprotected endpoint.
"""

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Request, BackgroundTasks
from fastapi.responses import Response
from typing import Optional

from app.config import get_settings
from app.deps import get_current_user, get_current_user_upload
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
    get_user_tier,
    get_user_lecture_limit,
)
from app.services.push import send_push_to_user


router = APIRouter(prefix="/api", tags=["lectures"])


@router.post("/upload", response_model=LectureUploadResponse)
@limiter.limit("10/hour")
async def upload_lecture(
    request: Request,
    file: UploadFile = File(...),
    subject: Optional[str] = Form(None),
    user_id: str = Depends(get_current_user_upload),
):
    """Upload a lecture audio file for processing."""
    settings = get_settings()

    # Ensure user exists in our database (Clerk handles real auth,
    # but we need a users row so the foreign key on lectures works)
    ensure_clerk_user(user_id)

    # Enforce lecture limit based on subscription tier
    lecture_limit = get_user_lecture_limit(user_id)
    current_count = count_user_lectures(user_id)
    tier = get_user_tier(user_id)
    if current_count >= lecture_limit:
        raise HTTPException(
            status_code=403,
            detail=f"{'Free tier' if tier == 'free' else tier.title() + ' plan'} limit reached ({lecture_limit} lectures). Upgrade to upload more.",
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


async def _process_lecture_pipeline(lecture_id: str):
    """
    Background processing pipeline: transcribe → generate notes.

    Runs outside the request/response cycle so the student gets an
    immediate response and can poll /lectures/{id} for status updates.
    Errors are written to the lecture record so the frontend can display them.
    """
    try:
        print(f"[Lectly] Background processing started for {lecture_id}")
        update_lecture_db(lecture_id, {"status": "processing"})

        # Step 1: Transcribe
        await transcribe_audio(lecture_id)

        # Step 2: Generate structured notes
        await generate_notes(lecture_id)

        print(f"[Lectly] Background processing complete for {lecture_id}")

        # Step 3: Send push notification — lecture is ready
        try:
            lecture = await get_lecture(lecture_id)
            if lecture and lecture.get("user_id"):
                title = lecture.get("subject") or lecture.get("filename") or "Your lecture"
                send_push_to_user(
                    user_id=lecture["user_id"],
                    title="Your notes are ready!",
                    body=f'"{title}" has been processed. Tap to view your notes.',
                    url=f"/lecture/{lecture_id}",
                    tag=f"lecture-ready-{lecture_id}",
                )
        except Exception as push_err:
            # Push is non-critical — don't fail the pipeline
            print(f"[Lectly] Push notification error (non-fatal): {push_err}")

    except Exception as e:
        print(f"[Lectly] Background processing FAILED for {lecture_id}: {e}")
        update_lecture_db(lecture_id, {"status": "failed", "error": str(e)})

        # Send push notification for failures too
        try:
            lecture = await get_lecture(lecture_id)
            if lecture and lecture.get("user_id"):
                title = lecture.get("subject") or lecture.get("filename") or "Your lecture"
                send_push_to_user(
                    user_id=lecture["user_id"],
                    title="Processing failed",
                    body=f'"{title}" couldn\'t be processed. Tap to retry.',
                    url=f"/lecture/{lecture_id}",
                    tag=f"lecture-failed-{lecture_id}",
                )
        except Exception:
            pass


@router.post("/lectures/{lecture_id}/process")
@limiter.limit("10/hour")
async def process_lecture(
    lecture_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user),
):
    """
    Trigger full processing pipeline: transcribe → generate notes.

    Returns immediately with status 202 (accepted). The processing
    runs in the background — poll GET /lectures/{lecture_id} to
    track progress. The lecture status field will transition through:
    uploaded → processing → transcribing → generating_notes → ready
    (or → failed if something goes wrong).
    """

    lecture = await get_lecture(lecture_id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    # Verify ownership
    if lecture.get("user_id") and lecture["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to process this lecture")

    # Don't allow re-processing if already in progress
    if lecture.get("status") in ("processing", "transcribing", "cleaning", "generating_notes"):
        return {
            "lecture_id": lecture_id,
            "status": lecture["status"],
            "message": "Lecture is already being processed. Poll GET /lectures/{lecture_id} for updates.",
        }

    # Kick off the pipeline in the background
    background_tasks.add_task(_process_lecture_pipeline, lecture_id)

    return {
        "lecture_id": lecture_id,
        "status": "processing",
        "message": "Processing started. Poll GET /lectures/{lecture_id} for status updates.",
    }


@router.get("/lectures")
async def get_lectures(user_id: str = Depends(get_current_user)):
    """List all lectures for the current user."""
    lectures = await list_lectures(user_id=user_id)
    return {"lectures": lectures, "count": len(lectures)}


@router.get("/lectures/{lecture_id}")
async def get_lecture_detail(lecture_id: str, user_id: str = Depends(get_current_user)):
    """Get full lecture details including notes."""

    lecture = await get_lecture(lecture_id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    # Verify ownership
    if lecture.get("user_id") and lecture["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this lecture")

    return lecture


@router.post("/explain", response_model=ExplainResponse)
@limiter.limit("30/hour")
async def explain_section(body: ExplainRequest, request: Request, user_id: str = Depends(get_current_user)):
    """Explain a highlighted section of notes in simpler terms."""
    return await explain_text(body)


@router.post("/learn", response_model=LearnModeResponse)
@limiter.limit("20/hour")
async def activate_learn_mode(body: LearnModeRequest, request: Request, user_id: str = Depends(get_current_user)):
    """Activate Learn Mode for a lecture section."""

    # Verify the user owns this lecture
    lecture = await get_lecture(body.lecture_id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")
    if lecture.get("user_id") and lecture["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    return await learn_mode(body)


@router.post("/tutor/ask", response_model=TutorAskResponse)
@limiter.limit("60/hour")
async def tutor_ask(body: TutorAskRequest, request: Request, user_id: str = Depends(get_current_user)):
    """Ask the AI Tutor a question about a lecture. Context-aware, conversational."""

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
async def solve_mode(body: SolveModeRequest, request: Request, user_id: str = Depends(get_current_user)):
    """Solve Mode — walk through a problem step by step."""

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
async def download_notes_pdf(lecture_id: str, user_id: str = Depends(get_current_user)):
    """Download lecture notes as a formatted PDF."""

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
async def delete_lecture(lecture_id: str, user_id: str = Depends(get_current_user)):
    """Delete a lecture and all associated data."""

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
async def update_lecture_details(lecture_id: str, request: Request, user_id: str = Depends(get_current_user)):
    """Update lecture details (title, subject)."""
    from datetime import datetime
    from app.database import save_notes

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
async def save_progress(request_body: ProgressSaveRequest, user_id: str = Depends(get_current_user)):
    """Save study progress for a lecture section."""
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
async def get_all_progress(user_id: str = Depends(get_current_user)):
    """Get all progress for the current user."""
    progress = db_get_all_progress(user_id)
    last_studied = db_get_last_studied(user_id)
    return {"progress": progress, "last_studied": last_studied}


@router.get("/progress/{lecture_id}")
async def get_lecture_progress(lecture_id: str, user_id: str = Depends(get_current_user)):
    """Get progress for a specific lecture."""
    progress = db_get_lecture_progress(user_id, lecture_id)
    return {"progress": progress}


# ──────────────────────────────────────────────
# User Limits
# ──────────────────────────────────────────────

@router.get("/user/limits")
async def get_user_limits(user_id: str = Depends(get_current_user)):
    """Get current usage limits for the authenticated user."""

    tier = get_user_tier(user_id)
    lecture_limit = get_user_lecture_limit(user_id)
    current_count = count_user_lectures(user_id)

    return {
        "tier": tier,
        "lectures_used": current_count,
        "lectures_limit": lecture_limit,
        "lectures_remaining": max(0, lecture_limit - current_count),
        "can_upload": current_count < lecture_limit,
    }
