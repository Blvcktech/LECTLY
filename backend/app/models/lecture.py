from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum


class LectureStatus(str, Enum):
    UPLOADED = "uploaded"
    CLEANING = "cleaning"
    TRANSCRIBING = "transcribing"
    GENERATING_NOTES = "generating_notes"
    READY = "ready"
    FAILED = "failed"


class LectureUploadResponse(BaseModel):
    id: str
    filename: str
    size_bytes: int
    status: LectureStatus
    message: str
    created_at: datetime


class LectureResponse(BaseModel):
    id: str
    title: str
    filename: str
    subject: Optional[str] = None
    duration_seconds: Optional[int] = None
    status: LectureStatus
    quality_score: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class TranscriptSegment(BaseModel):
    start: float
    end: float
    text: str
    speaker: Optional[str] = None
    confidence: Optional[float] = None


class NoteSection(BaseModel):
    heading: str
    content: str
    key_points: list[str]
    definitions: list[dict]
    source_type: str  # "original" or "ai_enhanced"
    timestamp_start: Optional[float] = None
    timestamp_end: Optional[float] = None


class StructuredNotes(BaseModel):
    lecture_id: str
    title: str
    summary: str
    sections: list[NoteSection]
    generated_at: datetime


class ExplainRequest(BaseModel):
    text: str
    level: str = "intermediate"  # beginner, intermediate, advanced


class ExplainResponse(BaseModel):
    original_text: str
    explanation: str
    analogy: Optional[str] = None
    level: str


class LearnModeRequest(BaseModel):
    lecture_id: str
    section_index: Optional[int] = None
    level: str = "intermediate"


class QuizQuestion(BaseModel):
    question: str
    options: list[str]
    correct_index: int
    explanation: str


class LessonSection(BaseModel):
    subtitle: str
    body: str


class ExampleItem(BaseModel):
    title: str
    problem: str = ""
    solution: str = ""
    description: str = ""  # legacy fallback
    code: Optional[str] = None


class ResourceItem(BaseModel):
    title: str
    description: str
    url: str = ""


class LearnModeResponse(BaseModel):
    topic: str
    explanation: list[LessonSection]
    analogy: str
    examples: list[ExampleItem]
    quiz: list[QuizQuestion]
    resources: list[ResourceItem] = []
    level: str


# ──────────────────────────────────────────────
# Ask Tutor models
# ──────────────────────────────────────────────

class TutorMessage(BaseModel):
    role: str  # "user" or "tutor"
    content: str


class CardContext(BaseModel):
    card_type: str  # "concept", "quiz", "analogy"
    card_content: str = ""
    card_title: str = ""
    quiz_question: str = ""
    quiz_options: list[str] = []
    student_answer: str = ""
    correct_answer: str = ""


class TutorAskRequest(BaseModel):
    lecture_id: str
    question: str
    conversation_history: list[TutorMessage] = []
    current_section_index: Optional[int] = None
    card_context: Optional[CardContext] = None


class TutorAskResponse(BaseModel):
    answer: str
    lecture_id: str
    section_referenced: Optional[str] = None


# ──────────────────────────────────────────────
# Progress Tracking models
# ──────────────────────────────────────────────

class ProgressSaveRequest(BaseModel):
    lecture_id: str
    section_index: int = -1
    total_cards: int
    completed_cards: int
    quiz_correct: int = 0
    quiz_total: int = 0
    last_card_index: int = 0
    mastery_pct: int = 0


class ProgressResponse(BaseModel):
    user_id: str
    lecture_id: str
    section_index: int
    total_cards: int
    completed_cards: int
    quiz_correct: int
    quiz_total: int
    last_card_index: int
    mastery_pct: int
    last_studied_at: str
