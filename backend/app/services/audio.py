"""
Audio processing service.

Handles audio upload, noise reduction, transcription, and enhancement.
Uses noisereduce + pydub for audio cleaning.
Uses AssemblyAI for transcription — handles long files (up to 5GB),
no chunking needed, built-in speaker detection.
"""

import asyncio
import os
import time
import uuid
import json
import subprocess
from datetime import datetime
from typing import Optional

import numpy as np
import httpx
from pydub import AudioSegment
import noisereduce as nr

from app.config import get_settings
from app.models.lecture import (
    LectureStatus,
    LectureUploadResponse,
    TranscriptSegment,
)
from app.database import (
    create_lecture,
    update_lecture,
    get_lecture as db_get_lecture,
    list_lectures as db_list_lectures,
    save_transcript,
)


# ──────────────────────────────────────────────
# Audio noise reduction
# ──────────────────────────────────────────────

def clean_audio(filepath: str) -> str:
    """
    Reduce background noise from an audio file.

    Takes the uploaded file, applies noise reduction, and saves
    a cleaned version. Returns the path to the cleaned file.

    Uses noisereduce library which works by:
    1. Estimating the noise profile from a quiet section
    2. Subtracting that noise pattern from the full audio
    """
    print(f"[Lectly] Starting noise reduction for: {filepath}")

    try:
        # Load audio file using pydub (handles mp3, m4a, wav, etc.)
        audio = AudioSegment.from_file(filepath)
        original_channels = audio.channels
        original_frame_rate = audio.frame_rate

        print(f"[Lectly] Audio loaded: {len(audio)/1000:.1f}s, {original_frame_rate}Hz, {original_channels}ch")

        # Convert to mono for noise reduction (works better)
        audio_mono = audio.set_channels(1)

        # Convert to numpy array for noisereduce
        samples = np.array(audio_mono.get_array_of_samples(), dtype=np.float32)

        # Normalize to [-1, 1] range
        max_val = np.max(np.abs(samples))
        if max_val > 0:
            samples = samples / max_val

        # Apply noise reduction
        # prop_decrease controls how aggressively noise is removed (0.0 to 1.0)
        # 0.6 is a good balance — removes noise without making speech sound robotic
        cleaned_samples = nr.reduce_noise(
            y=samples,
            sr=original_frame_rate,
            prop_decrease=0.6,
            stationary=True,  # Good for constant background noise (fans, hum, etc.)
        )

        # Convert back to int16 range
        cleaned_samples = np.clip(cleaned_samples * max_val, -32768, 32767).astype(np.int16)

        # Convert back to AudioSegment
        cleaned_audio = AudioSegment(
            data=cleaned_samples.tobytes(),
            sample_width=2,  # 16-bit
            frame_rate=original_frame_rate,
            channels=1,
        )

        # Save cleaned file as mp3 to keep file size small
        clean_dir = os.path.dirname(filepath)
        base_name = os.path.splitext(os.path.basename(filepath))[0]
        cleaned_path = os.path.join(clean_dir, f"{base_name}_clean.mp3")
        cleaned_audio.export(cleaned_path, format="mp3", bitrate="128k")

        cleaned_size = os.path.getsize(cleaned_path)
        original_size = os.path.getsize(filepath)
        print(f"[Lectly] Noise reduction complete: {cleaned_path} ({cleaned_size} bytes, original was {original_size} bytes)")

        return cleaned_path

    except Exception as e:
        print(f"[Lectly] Noise reduction failed, using original file: {e}")
        # If noise reduction fails, just return the original file
        # — don't block the pipeline
        return filepath


async def save_upload_from_file(
    temp_path: str, filename: str, size_bytes: int,
    subject: Optional[str] = None, user_id: Optional[str] = None,
) -> LectureUploadResponse:
    """Create a lecture record from a file already saved to disk (streaming upload)."""
    settings = get_settings()

    lecture_id = str(uuid.uuid4())[:8]
    ext = os.path.splitext(filename)[1].lower()
    saved_filename = f"{lecture_id}{ext}"
    filepath = os.path.join(settings.upload_dir, saved_filename)

    # Rename temp file to final path
    os.rename(temp_path, filepath)

    now = datetime.utcnow()
    lecture = {
        "id": lecture_id,
        "user_id": user_id,
        "filename": filename,
        "saved_filename": saved_filename,
        "filepath": filepath,
        "subject": subject,
        "size_bytes": size_bytes,
        "status": LectureStatus.UPLOADED,
        "quality_score": None,
        "duration_seconds": None,
        "error": None,
        "created_at": now,
        "updated_at": now,
    }
    create_lecture(lecture)

    return LectureUploadResponse(
        id=lecture_id,
        filename=filename,
        size_bytes=size_bytes,
        status=LectureStatus.UPLOADED,
        message="File uploaded successfully. Processing will begin shortly.",
        created_at=now,
    )


async def save_upload(file_content: bytes, filename: str, subject: Optional[str] = None, user_id: Optional[str] = None) -> LectureUploadResponse:
    """Save uploaded audio file and create a lecture record."""
    settings = get_settings()

    # Generate unique ID
    lecture_id = str(uuid.uuid4())[:8]

    # Ensure upload directory exists
    os.makedirs(settings.upload_dir, exist_ok=True)

    # Save file
    ext = os.path.splitext(filename)[1].lower()
    saved_filename = f"{lecture_id}{ext}"
    filepath = os.path.join(settings.upload_dir, saved_filename)

    with open(filepath, "wb") as f:
        f.write(file_content)

    # Create lecture record in database
    now = datetime.utcnow()
    lecture = {
        "id": lecture_id,
        "user_id": user_id,
        "filename": filename,
        "saved_filename": saved_filename,
        "filepath": filepath,
        "subject": subject,
        "size_bytes": len(file_content),
        "status": LectureStatus.UPLOADED,
        "quality_score": None,
        "duration_seconds": None,
        "error": None,
        "created_at": now,
        "updated_at": now,
    }
    create_lecture(lecture)

    return LectureUploadResponse(
        id=lecture_id,
        filename=filename,
        size_bytes=len(file_content),
        status=LectureStatus.UPLOADED,
        message="File uploaded successfully. Processing will begin shortly.",
        created_at=now,
    )


async def transcribe_audio(lecture_id: str) -> list[TranscriptSegment]:
    """
    Transcribe audio using AssemblyAI.

    How it works:
    1. Upload the audio file to AssemblyAI's servers
    2. Submit a transcription request
    3. Poll until transcription is complete
    4. Parse the result into segments

    AssemblyAI handles files up to 5GB and lectures up to several hours.
    No need to split files or worry about size limits.
    """
    settings = get_settings()
    lecture = db_get_lecture(lecture_id)

    if not lecture:
        raise ValueError(f"Lecture {lecture_id} not found")

    # Update status
    update_lecture(lecture_id, {"status": LectureStatus.TRANSCRIBING})

    api_key = settings.assemblyai_api_key
    if not api_key:
        raise ValueError("AssemblyAI API key is not set. Add ASSEMBLYAI_API_KEY to your .env file.")

    headers = {
        "authorization": api_key,
    }

    try:
        filepath = lecture["filepath"]
        is_r2 = filepath.startswith("r2://")
        r2_file_key = filepath.replace("r2://", "") if is_r2 else None

        print(f"[Lectly] Starting transcription for {lecture_id} using AssemblyAI...")
        print(f"[Lectly] File: {filepath} ({lecture['size_bytes']} bytes) [{'R2' if is_r2 else 'local'}]")

        # ── Step 0: Clean the audio (noise reduction) ──
        # Skipped on Railway by default — uses too much RAM on free tier.
        # Also skipped for R2 files (no local file to process).
        if not is_r2 and not settings.skip_noise_reduction:
            update_lecture(lecture_id, {"status": LectureStatus.CLEANING})
            filepath = clean_audio(filepath)
            print(f"[Lectly] Using cleaned audio file: {filepath}")
        else:
            print(f"[Lectly] Skipping noise reduction ({'R2 file' if is_r2 else 'disabled in settings'})")

        # ── Step 1: Get audio URL for AssemblyAI ──
        update_lecture(lecture_id, {"processing_step": "uploading_to_ai"})

        if is_r2 and r2_file_key:
            # R2 path: Generate a presigned download URL — AssemblyAI fetches directly
            # No file bytes pass through Railway at all!
            from app.services.storage import generate_presigned_download_url
            audio_url = generate_presigned_download_url(r2_file_key, expires_in=7200)
            print(f"[Lectly] Using R2 presigned URL for AssemblyAI (no re-upload needed)")
        else:
            # Legacy path: Upload local file to AssemblyAI directly
            print(f"[Lectly] Uploading local audio to AssemblyAI...")
            upload_url = "https://api.assemblyai.com/v2/upload"

            file_size = os.path.getsize(filepath)
            upload_timeout = min(900, max(120, int(file_size / (10 * 1024 * 1024) * 30)))
            print(f"[Lectly] File size: {file_size / (1024*1024):.1f}MB, upload timeout: {upload_timeout}s")

            async with httpx.AsyncClient(timeout=httpx.Timeout(upload_timeout, connect=30.0)) as client:
                with open(filepath, "rb") as audio_file:
                    upload_response = await client.post(
                        upload_url,
                        headers=headers,
                        content=audio_file.read(),
                    )

            if upload_response.status_code != 200:
                raise Exception(f"AssemblyAI upload failed ({upload_response.status_code}): {upload_response.text}")

            audio_url = upload_response.json()["upload_url"]
            print(f"[Lectly] Audio uploaded successfully.")

        # ── Step 2: Submit transcription request ──
        print(f"[Lectly] Submitting transcription request...")
        transcript_url = "https://api.assemblyai.com/v2/transcript"

        transcript_request = {
            "audio_url": audio_url,
            "language_code": "en",
            "speech_models": ["universal-2"],
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            submit_response = await client.post(
                transcript_url,
                headers={**headers, "content-type": "application/json"},
                json=transcript_request,
            )

        if submit_response.status_code != 200:
            raise Exception(f"AssemblyAI submit failed ({submit_response.status_code}): {submit_response.text}")

        transcript_id = submit_response.json()["id"]
        print(f"[Lectly] Transcription submitted. ID: {transcript_id}")

        # ── Step 3: Poll until transcription is complete ──
        # Uses async httpx — releases the event loop between polls so
        # other requests (polling, API calls) can be served concurrently
        polling_url = f"https://api.assemblyai.com/v2/transcript/{transcript_id}"
        max_wait = 2700  # 45 minutes max wait (long lectures can take 20+ min)
        waited = 0
        poll_interval = 5  # check every 5 seconds

        async with httpx.AsyncClient(timeout=30.0) as client:
            while waited < max_wait:
                poll_response = await client.get(polling_url, headers=headers)
                result = poll_response.json()
                status = result.get("status")

                if status == "completed":
                    print(f"[Lectly] Transcription completed! (took ~{waited}s)")
                    break
                elif status == "error":
                    error_msg = result.get("error", "Unknown error")
                    raise Exception(f"AssemblyAI transcription failed: {error_msg}")
                else:
                    # status is "queued" or "processing"
                    if waited % 30 == 0:  # Log every 30s instead of every 5s
                        print(f"[Lectly] Transcription status: {status} ({waited}s elapsed)...")
                    await asyncio.sleep(poll_interval)
                    waited += poll_interval
            else:
                raise Exception(f"Transcription timed out after {max_wait} seconds")

        # ── Step 4: Parse the result ──
        full_text = result.get("text", "")
        audio_duration = result.get("audio_duration", 0)  # in seconds
        words = result.get("words", [])

        segments = []

        # AssemblyAI returns individual words with timestamps.
        # Group them into ~30-second segments for a clean reading experience.
        if words:
            segment_words = []
            segment_start = words[0].get("start", 0) / 1000.0  # ms to seconds

            for word in words:
                segment_words.append(word.get("text", ""))
                word_end = word.get("end", 0) / 1000.0

                # Create a new segment roughly every 30 seconds
                if word_end - segment_start >= 30.0:
                    segments.append(
                        TranscriptSegment(
                            start=round(segment_start, 2),
                            end=round(word_end, 2),
                            text=" ".join(segment_words).strip(),
                            speaker="lecturer",
                            confidence=None,
                        )
                    )
                    segment_words = []
                    segment_start = word_end

            # Don't forget the last segment
            if segment_words:
                last_end = words[-1].get("end", 0) / 1000.0
                segments.append(
                    TranscriptSegment(
                        start=round(segment_start, 2),
                        end=round(last_end, 2),
                        text=" ".join(segment_words).strip(),
                        speaker="lecturer",
                        confidence=None,
                    )
                )

        # If no words came back but we have full text, create one segment
        if not segments and full_text:
            segments.append(
                TranscriptSegment(
                    start=0.0,
                    end=float(audio_duration),
                    text=full_text.strip(),
                    speaker="lecturer",
                    confidence=None,
                )
            )

        # Store transcript in database
        transcript_text = full_text if full_text else " ".join(s.text for s in segments)
        duration = audio_duration if audio_duration else (segments[-1].end if segments else 0)

        save_transcript(lecture_id, transcript_text, [s.model_dump() for s in segments])
        update_lecture(lecture_id, {"duration_seconds": duration})

        print(f"[Lectly] Transcribed lecture {lecture_id}: {len(segments)} segments, {len(transcript_text)} chars, {audio_duration:.0f}s duration")

        # Clean up R2 file after successful transcription to free storage
        if is_r2 and r2_file_key:
            try:
                from app.services.storage import delete_file
                delete_file(r2_file_key)
                print(f"[Lectly] Cleaned up R2 file: {r2_file_key}")
            except Exception as cleanup_err:
                print(f"[Lectly] R2 cleanup failed (non-critical): {cleanup_err}")

        return segments

    except Exception as e:
        update_lecture(lecture_id, {"status": LectureStatus.FAILED, "error": str(e)})
        print(f"[Lectly] Transcription failed for {lecture_id}: {e}")
        raise e


async def get_lecture(lecture_id: str) -> Optional[dict]:
    """Get lecture by ID from database."""
    return db_get_lecture(lecture_id)


async def list_lectures(user_id: Optional[str] = None) -> list[dict]:
    """List lectures from database, optionally filtered by user."""
    return db_list_lectures(user_id=user_id)
