/**
 * Lectly API client.
 * Handles all communication between the frontend and FastAPI backend.
 */

import { authHeaders } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Error Classes ─────────────────────────────

export class RateLimitError extends Error {
  retryAfter: number;
  constructor(retryAfter: number = 60) {
    const minutes = Math.ceil(retryAfter / 60);
    super(
      `You're using Lectly too quickly. Please wait ${minutes} minute${minutes > 1 ? "s" : ""} and try again.`
    );
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

/** Check response for common error codes and throw descriptive errors. */
function checkResponse(res: Response, fallbackMsg: string) {
  if (res.ok) return;
  if (res.status === 429) {
    const retry = parseInt(res.headers.get("Retry-After") || "60", 10);
    throw new RateLimitError(retry);
  }
  if (res.status === 401) {
    throw new Error("Session expired. Please sign in again.");
  }
  if (res.status === 403) {
    throw new Error("You don't have permission to do this.");
  }
  // For other errors, try to get detail from response body
  return res
    .json()
    .catch(() => ({ detail: fallbackMsg }))
    .then((err: { detail?: string }) => {
      throw new Error(err.detail || fallbackMsg);
    });
}

// ── Types ──────────────────────────────────────

export interface LectureUpload {
  id: string;
  filename: string;
  size_bytes: number;
  status: string;
  message: string;
  created_at: string;
}

export interface ProcessResult {
  lecture_id: string;
  status: string;
  message: string;
  notes_title: string;
  sections_count: number;
}

export interface NoteSection {
  heading: string;
  content: string;
  key_points: string[];
  definitions: { term: string; definition: string }[];
  source_type: "original" | "ai_enhanced";
  timestamp_start?: number;
  timestamp_end?: number;
}

export interface Lecture {
  id: string;
  filename: string;
  subject?: string;
  status: string;
  quality_score?: number;
  duration_seconds?: number;
  transcript_text?: string;
  notes?: {
    title: string;
    summary: string;
    sections: NoteSection[];
    generated_at: string;
  };
  created_at: string;
  updated_at: string;
}

export interface ExplainResult {
  original_text: string;
  explanation: string;
  analogy?: string;
  level: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

export interface LessonSection {
  subtitle: string;
  body: string;
}

export interface ExampleItem {
  title: string;
  problem: string;
  solution: string;
  description?: string;
  code?: string | null;
}

export interface ResourceItem {
  title: string;
  description: string;
  url: string;
}

export interface LearnResult {
  topic: string;
  explanation: LessonSection[];
  analogy: string;
  examples: ExampleItem[];
  quiz: QuizQuestion[];
  resources: ResourceItem[];
  level: string;
}

export interface SolveStep {
  step_number: number;
  title: string;
  content: string;
  key_insight: string;
}

export interface SolveResult {
  problem_restatement: string;
  given: string[];
  find: string;
  concept: string;
  steps: SolveStep[];
  answer: string;
  verification: string;
  common_mistakes: string[];
  follow_up: string;
  lecture_connection: string;
}

export interface TutorMessage {
  role: "user" | "tutor";
  content: string;
}

export interface CardContext {
  card_type: "concept" | "quiz" | "analogy";
  card_content?: string;
  card_title?: string;
  quiz_question?: string;
  quiz_options?: string[];
  student_answer?: string;
  correct_answer?: string;
}

export interface TutorAskResult {
  answer: string;
  lecture_id: string;
  section_referenced?: string;
}

export interface StudyProgress {
  user_id: string;
  lecture_id: string;
  section_index: number;
  total_cards: number;
  completed_cards: number;
  quiz_correct: number;
  quiz_total: number;
  last_card_index: number;
  mastery_pct: number;
  last_studied_at: string;
}

// ── API Functions ──────────────────────────────

export async function uploadLecture(
  file: File,
  subject?: string
): Promise<LectureUpload> {
  const formData = new FormData();
  formData.append("file", file);
  if (subject) formData.append("subject", subject);

  const res = await fetch(`${API_URL}/api/upload`, {
    method: "POST",
    headers: { ...authHeaders() },
    body: formData,
  });

  await checkResponse(res, "Upload failed");

  return res.json();
}

export async function processLecture(
  lectureId: string
): Promise<ProcessResult> {
  // Long timeout — transcribing + generating notes can take several minutes
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 600_000); // 10 minutes

  try {
    const res = await fetch(`${API_URL}/api/lectures/${lectureId}/process`, {
      method: "POST",
      headers: { ...authHeaders() },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    await checkResponse(res, "Processing failed");

    return res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Processing timed out. Try a shorter audio file or try again.");
    }
    throw err;
  }
}

export async function getLecture(lectureId: string): Promise<Lecture> {
  const res = await fetch(`${API_URL}/api/lectures/${lectureId}`, {
    headers: { ...authHeaders() },
  });

  await checkResponse(res, "Lecture not found");

  return res.json();
}

export async function getLectures(): Promise<{
  lectures: Lecture[];
  count: number;
}> {
  const res = await fetch(`${API_URL}/api/lectures`, {
    headers: { ...authHeaders() },
  });

  await checkResponse(res, "Failed to fetch lectures");

  return res.json();
}

export async function explainText(
  text: string,
  level: string = "intermediate"
): Promise<ExplainResult> {
  const res = await fetch(`${API_URL}/api/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ text, level }),
  });

  await checkResponse(res, "Explain failed");

  return res.json();
}

export async function learnMode(
  lectureId: string,
  level: string = "intermediate",
  sectionIndex?: number,
  cardStyle: string = "mixed"
): Promise<LearnResult> {
  const res = await fetch(`${API_URL}/api/learn`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      lecture_id: lectureId,
      level,
      section_index: sectionIndex,
      card_style: cardStyle,
    }),
  });

  await checkResponse(res, "Learn Mode failed");

  return res.json();
}

export async function solveMode(
  lectureId: string,
  problem: string,
  sectionIndex?: number,
  studentAttempt?: string
): Promise<SolveResult> {
  const res = await fetch(`${API_URL}/api/solve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      lecture_id: lectureId,
      problem,
      section_index: sectionIndex,
      student_attempt: studentAttempt || null,
    }),
  });

  await checkResponse(res, "Solve Mode failed");

  return res.json();
}

export async function downloadNotesPdf(lectureId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/lectures/${lectureId}/pdf`, {
    headers: { ...authHeaders() },
  });

  await checkResponse(res, "Failed to generate PDF");

  // Get filename from Content-Disposition header or use default
  const disposition = res.headers.get("Content-Disposition");
  let filename = "Lectly-Notes.pdf";
  if (disposition) {
    const match = disposition.match(/filename="?(.+?)"?$/);
    if (match) filename = match[1];
  }

  // Download the file
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export async function deleteLecture(lectureId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/lectures/${lectureId}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });

  await checkResponse(res, "Failed to delete lecture");
}

export async function renameLecture(lectureId: string, title: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/lectures/${lectureId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ title }),
  });

  await checkResponse(res, "Failed to rename lecture");
}

export async function askTutor(
  lectureId: string,
  question: string,
  conversationHistory: TutorMessage[] = [],
  currentSectionIndex?: number,
  cardContext?: CardContext
): Promise<TutorAskResult> {
  const res = await fetch(`${API_URL}/api/tutor/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      lecture_id: lectureId,
      question,
      conversation_history: conversationHistory,
      current_section_index: currentSectionIndex,
      card_context: cardContext || null,
    }),
  });

  await checkResponse(res, "Tutor request failed");

  return res.json();
}

export interface UserLimits {
  tier: string;
  lectures_used: number;
  lectures_limit: number;
  lectures_remaining: number;
  can_upload: boolean;
}

export async function getUserLimits(): Promise<UserLimits> {
  const res = await fetch(`${API_URL}/api/user/limits`, {
    headers: { ...authHeaders() },
  });

  await checkResponse(res, "Failed to fetch user limits");

  return res.json();
}

export async function healthCheck(): Promise<{
  status: string;
  openai_configured: boolean;
  anthropic_configured: boolean;
}> {
  const res = await fetch(`${API_URL}/health`);
  return res.json();
}

// ── Progress Tracking ──────────────────────────

export async function saveProgress(data: {
  lecture_id: string;
  section_index: number;
  total_cards: number;
  completed_cards: number;
  quiz_correct?: number;
  quiz_total?: number;
  last_card_index?: number;
  mastery_pct?: number;
}): Promise<StudyProgress> {
  const res = await fetch(`${API_URL}/api/progress`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });

  await checkResponse(res, "Failed to save progress");

  return res.json();
}

export async function getAllProgress(): Promise<{
  progress: StudyProgress[];
  last_studied: StudyProgress | null;
}> {
  const res = await fetch(`${API_URL}/api/progress`, {
    headers: { ...authHeaders() },
  });

  await checkResponse(res, "Failed to fetch progress");

  return res.json();
}

export async function getLectureProgress(
  lectureId: string
): Promise<{ progress: StudyProgress[] }> {
  const res = await fetch(`${API_URL}/api/progress/${lectureId}`, {
    headers: { ...authHeaders() },
  });

  await checkResponse(res, "Failed to fetch lecture progress");

  return res.json();
}
