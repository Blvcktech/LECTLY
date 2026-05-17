from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # App
    app_name: str = "Lectly API"
    debug: bool = False
    allowed_origins: str = "https://lectly.vercel.app,http://localhost:3000"

    # API Keys (add these to your .env file)
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    huggingface_api_key: str = ""
    groq_api_key: str = ""
    assemblyai_api_key: str = ""
    gemini_api_key: str = ""

    # Auth
    jwt_secret_key: str = ""  # REQUIRED: set JWT_SECRET_KEY in .env
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 10080  # 7 days

    # Clerk (set CLERK_ISSUER in .env, e.g. "https://your-app.clerk.accounts.dev")
    clerk_issuer: str = ""

    # File Storage
    upload_dir: str = "./uploads"
    processed_dir: str = "./processed"
    max_file_size_mb: int = 500
    allowed_audio_extensions: str = ".mp3,.wav,.m4a,.aac,.ogg"

    # Processing
    whisper_model: str = "openai/whisper-large-v3"  # Hugging Face Whisper model
    llm_model: str = "mistralai/Mistral-7B-Instruct-v0.3"  # Hugging Face LLM
    skip_noise_reduction: bool = True  # Skip on Railway to avoid OOM crashes

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
