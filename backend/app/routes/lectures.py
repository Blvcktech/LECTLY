"""
Lecture routes — upload, process, retrieve, explain, learn.
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import Response
from typing import Optional

from app.config import get_settings
from app.models.lecture import (
    LectureUploadResponse,
    LectureResponse,
    ExplainRequest,
    ExplainResponse,
    LearnModeRequest,
    LearnModeResponse,
)
import os
from app.services.audio import save_upload, transcribe_audio, get_lecture, list_lectures
from app.services.notes import generate_notes, explain_text, learn_mode
from app.services.pdf_export import generate_notes_pdf
from app.database import delete_lecture as db_delete_lecture, ensure_clerk_user


router = APIRouter(prefix="/api", tags=["lectures"])


def _get_user_id_from_header(request: Request) -> Optional[str]:
    """
    Extract user ID from Clerk session token in the Authorization header.
    For now, we decode the JWT subject (sub) without full verification.
    Full Clerk JWT verification will be added at deployment.
    """
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header[7:]
    try:
        import json, base64
        # Decode JWT payload (middle part) without verification for now
        payload_b64 = token.split(".")[1]
        # Add padding
        payload_b64 += "=" * (4 - len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        return payload.get("sub")
    except Exception:
        return None


@router.post("/upload", response_model=LectureUploadResponse)
async def upload_lecture(
    request: Request,
    file: UploadFile = File(...),
    subject: Optional[str] = Form(None),
):
    """Upload a lecture audio file for processing."""
    settings = get_settings()

    # Extract user_id from Clerk JWT (passed as Bearer token from frontend)
    user_id = _get_user_id_from_header(request)

    # Ensure user exists in our database (Clerk handles real auth,
    # but we need a users row so the foreign key on lectures works)
    if user_id:
        ensure_clerk_user(user_id)

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
async def process_lecture(lecture_id: str):
    """Trigger full processing pipeline: transcribe → generate notes."""
    lecture = await get_lecture(lecture_id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

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
    user_id = _get_user_id_from_header(request)
    lectures = await list_lectures(user_id=user_id)
    return {"lectures": lectures, "count": len(lectures)}


@router.get("/lectures/{lecture_id}")
async def get_lecture_detail(lecture_id: str):
    """Get full lecture details including notes."""
    lecture = await get_lecture(lecture_id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")
    return lecture


@router.post("/explain", response_model=ExplainResponse)
async def explain_section(request: ExplainRequest):
    """Explain a highlighted section of notes in simpler terms."""
    return await explain_text(request)


@router.post("/learn", response_model=LearnModeResponse)
async def activate_learn_mode(request: LearnModeRequest):
    """Activate Learn Mode for a lecture section."""
    return await learn_mode(request)


@router.get("/lectures/{lecture_id}/pdf")
async def download_notes_pdf(lecture_id: str):
    """Download lecture notes as a formatted PDF."""
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
async def delete_lecture(lecture_id: str):
    """Delete a lecture and all associated data."""
    lecture = await get_lecture(lecture_id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

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
