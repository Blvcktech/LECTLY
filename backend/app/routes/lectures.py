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
from datetime import datetime
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
from app.services.audio import save_upload, save_upload_from_file, transcribe_audio, get_lecture, list_lectures
from app.services.notes import generate_notes, explain_text, learn_mode, ask_tutor, solve_problem
from app.services.pdf_export import generate_notes_pdf
from app.database import (
    delete_lecture as db_delete_lecture,
    update_lecture as update_lecture_db,
    ensure_clerk_user,
    count_user_lectures,
    get_user_lecture_usage,
    save_progress as db_save_progress,
    get_progress as db_get_progress,
    get_lecture_progress as db_get_lecture_progress,
    get_all_progress as db_get_all_progress,
    get_last_studied as db_get_last_studied,
    get_user_tier,
    get_user_lecture_limit,
    get_lectures_for_retry,
)
from app.services.push import send_push_to_user


router = APIRouter(prefix="/api", tags=["lectures"])


# ──────────────────────────────────────────────
# Upload endpoint (server-side R2)
# ──────────────────────────────────────────────

@router.post("/upload", response_model=LectureUploadResponse)
@limiter.limit("10/hour")
async def upload_lecture(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    subject: Optional[str] = Form(None),
    user_id: str = Depends(get_current_user_upload),
):
    """
    Upload a lecture audio file for processing.

    The file is streamed to disk in 1MB chunks (no OOM), then uploaded
    to Cloudflare R2 server-side. AssemblyAI fetches from R2 via
    presigned URL, so the file never needs to be re-uploaded.

    Lecture record is only created AFTER the file is safely stored,
    so failed uploads don't consume the user's lecture quota.
    """
    settings = get_settings()

    # Ensure user exists in our database (Clerk handles real auth,
    # but we need a users row so the foreign key on lectures works)
    ensure_clerk_user(user_id)

    # Enforce lecture limit based on subscription tier
    # For paid users, this counts only lectures in the current billing period
    lecture_limit = get_user_lecture_limit(user_id)
    current_count = get_user_lecture_usage(user_id)
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

    # Stream file to disk in chunks to avoid loading entire file into memory.
    # This prevents OOM on Railway's limited containers for large files (50-500MB).
    import uuid as _uuid

    max_bytes = settings.max_file_size_mb * 1024 * 1024
    os.makedirs(settings.upload_dir, exist_ok=True)

    temp_id = str(_uuid.uuid4())[:8]
    ext = os.path.splitext(file.filename or "audio.mp3")[1].lower()
    temp_path = os.path.join(settings.upload_dir, f"tmp_{temp_id}{ext}")

    total_size = 0
    header = b""
    chunk_size = 1024 * 1024  # 1MB chunks

    try:
        with open(temp_path, "wb") as f:
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > max_bytes:
                    # Clean up temp file before raising
                    f.close()
                    os.remove(temp_path)
                    raise HTTPException(
                        status_code=400,
                        detail=f"File too large. Maximum size: {settings.max_file_size_mb}MB",
                    )
                # Capture header bytes for magic byte validation
                if len(header) < 12:
                    header += chunk[:12 - len(header)]
                f.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(status_code=500, detail=f"Upload error: {str(e)}")

    # Validate file content — check magic bytes to prevent disguised uploads
    _AUDIO_MAGIC = {
        b"ID3": "mp3",             # MP3 with ID3 tag
        b"\xff\xfb": "mp3",       # MP3 frame sync
        b"\xff\xf3": "mp3",       # MP3 frame sync (MPEG2)
        b"\xff\xf2": "mp3",       # MP3 frame sync
        b"RIFF": "wav",           # WAV/AVI
        b"fLaC": "flac",          # FLAC
        b"OggS": "ogg",           # OGG/Opus
        b"\x1aE\xdf\xa3": "webm", # WebM/MKV
    }
    is_valid_audio = False
    for magic in _AUDIO_MAGIC:
        if header.startswith(magic):
            is_valid_audio = True
            break
    if not is_valid_audio and len(header) >= 8 and header[4:8] == b"ftyp":
        is_valid_audio = True
    if not is_valid_audio and header.startswith(b"caff"):
        is_valid_audio = True

    if not is_valid_audio:
        os.remove(temp_path)
        raise HTTPException(
            status_code=400,
            detail="File does not appear to be a valid audio/video file. Please upload an actual recording.",
        )

    # ── Upload to R2 (server-side, no CORS needed) ──
    # This runs server-to-server so there are no browser CORS restrictions.
    # After upload, delete temp file to free disk space on Railway.
    lecture_id = temp_id  # Reuse the UUID we already generated
    file_key = f"uploads/{lecture_id}{ext}"
    r2_uploaded = False

    try:
        from app.services.storage import _get_r2_client
        r2_client = _get_r2_client()

        print(f"[Lectly] Uploading {temp_path} to R2 as {file_key} ({total_size / (1024*1024):.1f}MB)...")
        r2_client.upload_file(
            temp_path,
            settings.r2_bucket_name,
            file_key,
            ExtraArgs={"ContentType": file.content_type or "audio/mpeg"},
        )
        r2_uploaded = True
        print(f"[Lectly] R2 upload complete: {file_key}")

        # Delete temp file — it's safely in R2 now
        os.remove(temp_path)
        filepath = f"r2://{file_key}"
    except Exception as r2_err:
        print(f"[Lectly] R2 upload failed, keeping local file: {r2_err}")
        # Fallback: keep the file locally and process from disk
        # This means it still works even if R2 is misconfigured
        filepath = temp_path
        # Rename temp file to permanent name
        perm_path = os.path.join(settings.upload_dir, f"{lecture_id}{ext}")
        try:
            os.rename(temp_path, perm_path)
            filepath = perm_path
        except Exception:
            filepath = temp_path  # Keep temp path if rename fails

    # ── Create lecture record ONLY after file is safely stored ──
    # This fixes the quota deduction bug — failed uploads no longer
    # consume the user's lecture count.
    from app.database import create_lecture
    from app.models.lecture import LectureStatus
    from datetime import datetime as _dt

    now = _dt.utcnow()
    filename = file.filename or "audio.mp3"
    lecture = {
        "id": lecture_id,
        "user_id": user_id,
        "filename": filename,
        "saved_filename": f"{lecture_id}{ext}",
        "filepath": filepath,
        "subject": subject,
        "size_bytes": total_size,
        "status": LectureStatus.UPLOADED,
        "quality_score": None,
        "duration_seconds": None,
        "error": None,
        "created_at": now,
        "updated_at": now,
    }
    create_lecture(lecture)

    print(f"[Lectly] Lecture {lecture_id} created ({'R2' if r2_uploaded else 'local'}): {filename} ({total_size} bytes)")

    result = LectureUploadResponse(
        id=lecture_id,
        filename=filename,
        size_bytes=total_size,
        status=LectureStatus.UPLOADED,
        message="File uploaded successfully. Processing will begin shortly.",
        created_at=now,
    )
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
        update_lecture_db(lecture_id, {
            "status": "processing",
            "started_at": datetime.utcnow().isoformat(),
            "processing_step": "transcribing",
        })

        # Step 1: Transcribe
        await transcribe_audio(lecture_id)

        # Step 2: Generate structured notes
        update_lecture_db(lecture_id, {"processing_step": "generating_notes"})
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


async def _retry_lecture_pipeline(lecture_id: str, skip_transcription: bool = False):
    """
    Retry pipeline that can skip transcription if a transcript already exists.
    This saves users from re-uploading and re-transcribing when only note
    generation failed.
    """
    try:
        print(f"[Lectly] Retry processing started for {lecture_id} (skip_transcription={skip_transcription})")
        update_lecture_db(lecture_id, {
            "status": "processing",
            "error": None,
            "started_at": datetime.utcnow().isoformat(),
            "processing_step": "generating_notes" if skip_transcription else "transcribing",
        })

        if not skip_transcription:
            await transcribe_audio(lecture_id)
            update_lecture_db(lecture_id, {"processing_step": "generating_notes"})

        await generate_notes(lecture_id)
        print(f"[Lectly] Retry processing complete for {lecture_id}")

        # Send push notification
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
        except Exception:
            pass

    except Exception as e:
        print(f"[Lectly] Retry processing FAILED for {lecture_id}: {e}")
        update_lecture_db(lecture_id, {"status": "failed", "error": str(e)})


@router.post("/lectures/{lecture_id}/retry")
@limiter.limit("5/hour")
async def retry_lecture(
    lecture_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user),
):
    """
    Retry processing a failed lecture. Smart retry: if a transcript
    already exists, skips transcription and only re-runs note generation.
    """
    lecture = get_lectures_for_retry(lecture_id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    if lecture.get("user_id") and lecture["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if lecture.get("status") not in ("failed",):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot retry a lecture with status '{lecture.get('status')}'. Only failed lectures can be retried.",
        )

    skip_transcription = lecture.get("has_transcript", False)
    background_tasks.add_task(_retry_lecture_pipeline, lecture_id, skip_transcription)

    return {
        "lecture_id": lecture_id,
        "status": "processing",
        "skip_transcription": skip_transcription,
        "message": (
            "Retrying note generation (transcript already exists)."
            if skip_transcription
            else "Retrying full processing (transcription + notes)."
        ),
    }


@router.get("/lectures")
@limiter.limit("60/minute")
async def get_lectures(request: Request, user_id: str = Depends(get_current_user)):
    """List all lectures for the current user."""
    lectures = await list_lectures(user_id=user_id)
    return {"lectures": lectures, "count": len(lectures)}


@router.get("/lectures/{lecture_id}")
@limiter.limit("120/minute")
async def get_lecture_detail(request: Request, lecture_id: str, user_id: str = Depends(get_current_user)):
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

    try:
        return await learn_mode(body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[Lectly] Learn Mode route error: {e}")
        raise HTTPException(status_code=502, detail="AI service temporarily unavailable. Please try again.")


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
@limiter.limit("10/hour")
async def download_notes_pdf(request: Request, lecture_id: str, user_id: str = Depends(get_current_user)):
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
@limiter.limit("10/hour")
async def delete_lecture(request: Request, lecture_id: str, user_id: str = Depends(get_current_user)):
    """Delete a lecture and all associated data."""

    lecture = await get_lecture(lecture_id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    # Verify ownership
    if lecture.get("user_id") and lecture["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this lecture")

    # Delete audio files from disk or R2
    filepath = lecture.get("filepath", "")
    if filepath and filepath.startswith("r2://"):
        # Delete from R2
        try:
            from app.services.storage import delete_file
            file_key = filepath.replace("r2://", "")
            delete_file(file_key)
        except Exception as r2_err:
            print(f"[Lectly] R2 delete failed (non-critical): {r2_err}")
    elif filepath and os.path.exists(filepath):
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
        title = str(body["title"]).strip()[:200]  # Max 200 chars for title
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
@limiter.limit("60/minute")
async def get_all_progress(request: Request, user_id: str = Depends(get_current_user)):
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
@limiter.limit("30/minute")
async def get_user_limits(request: Request, user_id: str = Depends(get_current_user)):
    """Get current usage limits for the authenticated user."""

    tier = get_user_tier(user_id)
    lecture_limit = get_user_lecture_limit(user_id)
    current_count = get_user_lecture_usage(user_id)

    return {
        "tier": tier,
        "lectures_used": current_count,
        "lectures_limit": lecture_limit,
        "lectures_remaining": max(0, lecture_limit - current_count),
        "can_upload": current_count < lecture_limit,
    }
