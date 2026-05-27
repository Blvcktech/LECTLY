"""
Cloudflare R2 storage service for Lectly.

Handles presigned URL generation for direct browser-to-R2 uploads.
This eliminates Railway as a file proxy — the browser uploads directly
to Cloudflare's infrastructure, which is built for large file transfers.

Flow:
1. Backend generates a presigned PUT URL for the browser
2. Browser uploads directly to R2 (with progress tracking via XHR)
3. Backend generates a presigned GET URL for AssemblyAI to fetch
4. After transcription, the R2 object is deleted

Uses boto3 with R2's S3-compatible API.
"""

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError
from app.config import get_settings


def _get_r2_client():
    """Create an S3-compatible client pointing at Cloudflare R2."""
    settings = get_settings()

    if not settings.r2_account_id or not settings.r2_access_key_id:
        raise ValueError(
            "R2 credentials not configured. Set R2_ACCOUNT_ID, "
            "R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY in environment."
        )

    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        region_name="auto",
        config=BotoConfig(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
        ),
    )


def generate_presigned_upload_url(
    file_key: str,
    content_type: str = "audio/mpeg",
    expires_in: int = 3600,
) -> str:
    """
    Generate a presigned PUT URL for direct browser upload to R2.

    The browser uses this URL to PUT the file directly to R2,
    bypassing the backend entirely. Supports files up to 5GB.

    Args:
        file_key: Object key in the bucket (e.g., "uploads/abc123.mp3")
        content_type: MIME type of the file
        expires_in: URL validity in seconds (default 1 hour)

    Returns:
        Presigned PUT URL string
    """
    settings = get_settings()
    client = _get_r2_client()

    url = client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.r2_bucket_name,
            "Key": file_key,
            "ContentType": content_type,
        },
        ExpiresIn=expires_in,
    )
    return url


def generate_presigned_download_url(
    file_key: str,
    expires_in: int = 3600,
) -> str:
    """
    Generate a presigned GET URL for AssemblyAI to fetch the audio.

    AssemblyAI accepts an audio_url parameter — we give it a temporary
    R2 URL so it can download the file directly. No bytes flow through Railway.

    Args:
        file_key: Object key in the bucket
        expires_in: URL validity in seconds (default 1 hour)

    Returns:
        Presigned GET URL string
    """
    settings = get_settings()
    client = _get_r2_client()

    url = client.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.r2_bucket_name,
            "Key": file_key,
        },
        ExpiresIn=expires_in,
    )
    return url


def delete_file(file_key: str) -> bool:
    """
    Delete a file from R2 after processing is complete.

    Called after successful transcription to free up storage.
    Non-critical — if deletion fails, R2 lifecycle rules will clean up.
    """
    settings = get_settings()
    client = _get_r2_client()

    try:
        client.delete_object(
            Bucket=settings.r2_bucket_name,
            Key=file_key,
        )
        return True
    except ClientError as e:
        print(f"[Lectly] R2 delete failed for {file_key}: {e}")
        return False


def file_exists(file_key: str) -> bool:
    """Check if a file exists in R2 (used to verify upload completion)."""
    settings = get_settings()
    client = _get_r2_client()

    try:
        client.head_object(
            Bucket=settings.r2_bucket_name,
            Key=file_key,
        )
        return True
    except ClientError:
        return False


def get_file_size(file_key: str) -> int:
    """Get the size of a file in R2 in bytes."""
    settings = get_settings()
    client = _get_r2_client()

    try:
        response = client.head_object(
            Bucket=settings.r2_bucket_name,
            Key=file_key,
        )
        return response.get("ContentLength", 0)
    except ClientError:
        return 0


def setup_cors():
    """
    Configure CORS on the R2 bucket to allow direct browser uploads.

    Must be called once (e.g., on app startup). Safe to call multiple
    times — it just overwrites the existing CORS config.
    """
    settings = get_settings()

    if not settings.r2_account_id or not settings.r2_access_key_id:
        print("[Lectly] R2 not configured — skipping CORS setup")
        return

    client = _get_r2_client()

    # Parse allowed origins from settings
    origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]

    cors_config = {
        "CORSRules": [
            {
                "AllowedOrigins": origins,
                "AllowedMethods": ["PUT", "GET", "HEAD"],
                "AllowedHeaders": ["*"],
                "ExposeHeaders": ["ETag", "Content-Length"],
                "MaxAgeSeconds": 3600,
            }
        ]
    }

    try:
        client.put_bucket_cors(
            Bucket=settings.r2_bucket_name,
            CORSConfiguration=cors_config,
        )
        print(f"[Lectly] R2 CORS configured for bucket '{settings.r2_bucket_name}'")
    except ClientError as e:
        print(f"[Lectly] R2 CORS setup failed: {e}")
