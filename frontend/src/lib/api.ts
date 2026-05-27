/**
 * Lectly API client.
 * Handles all communication between the frontend and FastAPI backend.
 *
 * All requests go through fetchWithRetry() which provides:
 * - Automatic retry with exponential backoff for network errors
 * - Fresh auth token before every attempt
 * - Request timeouts (10s GET, 30s POST, 5min uploads)
 * - In-flight GET deduplication
 */

import { fetchWithRetry } from "./fetch";
import { freshAuthHeaders } from "./auth";

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
async function checkResponse(res: Response, fallbackMsg: string): Promise<void> {
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
  const err = await res.json().catch(() => ({ detail: fallbackMsg }));
  const detail = err.detail;
  let message: string;
  if (typeof detail === "string") {
    message = detail;
  } else if (Array.isArray(detail)) {
    // Pydantic validation errors return detail as an array of objects
    message = detail
      .map((d: { msg?: string; message?: string }) => d.msg || d.message || "Validation error")
      .join("; ");
  } else {
    message = fallbackMsg;
  }
  throw new Error(message || fallbackMsg);
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
  processing_step?: string;
  quality_score?: number;
  duration_seconds?: number;
  error?: string;
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

/**
 * Upload a lecture file with real-time progress tracking.
 *
 * Uses XMLHttpRequest instead of fetch() because XHR supports
 * upload.onprogress events — critical for showing actual upload
 * percentage on slow mobile connections (e.g. Nigerian mobile data
 * uploading 38MB at 100-500KB/s = 1-6 minutes).
 *
 * @param file      - Audio file to upload
 * @param subject   - Optional course code / subject
 * @param onProgress - Callback with upload progress (0-100)
 */
/**
 * Upload a lecture file using direct-to-R2 presigned URL flow.
 *
 * Flow:
 * 1. Ask backend for a presigned R2 upload URL (tiny request)
 * 2. Upload file directly to Cloudflare R2 via XHR (with progress)
 * 3. Notify backend that upload is complete → starts processing
 *
 * This bypasses Railway entirely for file transfer. The browser
 * uploads to Cloudflare's infrastructure which is built for large files.
 */
export async function uploadLecture(
  file: File,
  subject?: string,
  onProgress?: (pct: number) => void
): Promise<LectureUpload> {
  // Step 1: Get presigned upload URL from backend
  const headers = await freshAuthHeaders();

  const presignRes = await fetch(`${API_URL}/api/upload/presign`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filename: file.name,
      size: file.size,
      content_type: file.type || "audio/mpeg",
      subject: subject || undefined,
    }),
  });

  if (!presignRes.ok) {
    if (presignRes.status === 429) {
      const retry = parseInt(presignRes.headers.get("Retry-After") || "60", 10);
      throw new RateLimitError(retry);
    }
    if (presignRes.status === 401) {
      throw new Error("Session expired. Please sign in again.");
    }
    if (presignRes.status === 403) {
      const err = await presignRes.json().catch(() => ({}));
      throw new Error(err.detail || "You don't have permission to do this.");
    }
    const err = await presignRes.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to prepare upload");
  }

  const { upload_url, file_key, lecture_id } = await presignRes.json();

  // Step 2: Upload file directly to R2 via XHR (for progress tracking)
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const TIMEOUT = 1_800_000; // 30 minutes — R2 is fast, but allow for very large files

    xhr.open("PUT", upload_url);
    xhr.timeout = TIMEOUT;
    xhr.setRequestHeader("Content-Type", file.type || "audio/mpeg");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        const pct = Math.round((e.loaded / e.total) * 100);
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(
          `Upload to storage failed (${xhr.status}). Please try again.`
        ));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Network error during upload — check your internet connection and try again."));
    };

    xhr.ontimeout = () => {
      reject(new Error(
        `Upload timed out after ${TIMEOUT / 1000 / 60} minutes. ` +
        "Your connection may be too slow for this file size. Try WiFi or a smaller file."
      ));
    };

    xhr.send(file);
  });

  onProgress?.(100);

  // Step 3: Notify backend that upload is complete
  const freshHeaders = await freshAuthHeaders();

  const completeRes = await fetch(`${API_URL}/api/upload/complete`, {
    method: "POST",
    headers: {
      ...freshHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ lecture_id, file_key }),
  });

  if (!completeRes.ok) {
    const err = await completeRes.json().catch(() => ({}));
    throw new Error(err.detail || "Upload confirmation failed. Please try again.");
  }

  // Return a LectureUpload-compatible response
  return {
    id: lecture_id,
    filename: file.name,
    size_bytes: file.size,
    status: "uploaded",
    message: "Upload confirmed. Processing started.",
    created_at: new Date().toISOString(),
  };
}

export async function processLecture(
  lectureId: string,
  onStatusChange?: (status: string) => void
): Promise<ProcessResult> {
  // Step 1: Fire off the background processing request
  const res = await fetchWithRetry(`${API_URL}/api/lectures/${lectureId}/process`, {
    method: "POST",
  });

  await checkResponse(res, "Processing failed");

  // Step 2: Poll GET /lectures/{id} until status is "ready" or "failed"
  const maxWait = 3_000_000; // 50 minutes (long lectures can take 20+ min to transcribe)
  const pollInterval = 4_000; // check every 4 seconds
  let waited = 0;

  while (waited < maxWait) {
    await new Promise((r) => setTimeout(r, pollInterval));
    waited += pollInterval;

    const lecture = await getLecture(lectureId);
    const status = lecture.status;

    // Notify caller of status changes — use processing_step for granular UI updates
    const step = lecture.processing_step || status;
    if (onStatusChange) onStatusChange(step);

    if (status === "ready") {
      return {
        lecture_id: lectureId,
        status: "ready",
        message: "Lecture processed successfully",
        notes_title: lecture.notes?.title || "",
        sections_count: lecture.notes?.sections?.length || 0,
      };
    }

    if (status === "failed") {
      throw new Error(lecture.error || "Processing failed. Please try again.");
    }

    // Otherwise status is processing/transcribing/cleaning/generating_notes — keep polling
  }

  throw new Error("Processing timed out. Try a shorter audio file or try again.");
}

export async function retryLecture(
  lectureId: string,
  onStatusChange?: (status: string) => void
): Promise<ProcessResult> {
  // Step 1: Fire off the retry request
  const res = await fetchWithRetry(`${API_URL}/api/lectures/${lectureId}/retry`, {
    method: "POST",
  });

  await checkResponse(res, "Retry failed");

  // Step 2: Poll until ready or failed (same as processLecture)
  const maxWait = 3_000_000; // 50 minutes
  const pollInterval = 4_000;
  let waited = 0;

  while (waited < maxWait) {
    await new Promise((r) => setTimeout(r, pollInterval));
    waited += pollInterval;

    const lecture = await getLecture(lectureId);
    const status = lecture.status;

    if (onStatusChange) onStatusChange(status);

    if (status === "ready") {
      return {
        lecture_id: lectureId,
        status: "ready",
        message: "Lecture processed successfully",
        notes_title: lecture.notes?.title || "",
        sections_count: lecture.notes?.sections?.length || 0,
      };
    }

    if (status === "failed") {
      throw new Error(lecture.error || "Retry failed. Please try again.");
    }
  }

  throw new Error("Processing timed out. Try a shorter audio file or try again.");
}

export async function getLecture(lectureId: string): Promise<Lecture> {
  const res = await fetchWithRetry(`${API_URL}/api/lectures/${lectureId}`);

  await checkResponse(res, "Lecture not found");

  return res.json();
}

export async function getLectures(): Promise<{
  lectures: Lecture[];
  count: number;
}> {
  const res = await fetchWithRetry(`${API_URL}/api/lectures`);

  await checkResponse(res, "Failed to fetch lectures");

  return res.json();
}

export async function explainText(
  text: string,
  level: string = "intermediate"
): Promise<ExplainResult> {
  const res = await fetchWithRetry(`${API_URL}/api/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  const res = await fetchWithRetry(
    `${API_URL}/api/learn`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lecture_id: lectureId,
        level,
        section_index: sectionIndex,
        card_style: cardStyle,
      }),
    },
    { timeout: 60_000 } // LLM calls can take longer
  );

  await checkResponse(res, "Learn Mode failed");

  return res.json();
}

export async function solveMode(
  lectureId: string,
  problem: string,
  sectionIndex?: number,
  studentAttempt?: string
): Promise<SolveResult> {
  const res = await fetchWithRetry(
    `${API_URL}/api/solve`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lecture_id: lectureId,
        problem,
        section_index: sectionIndex,
        student_attempt: studentAttempt || null,
      }),
    },
    { timeout: 60_000 } // LLM calls can take longer
  );

  await checkResponse(res, "Solve Mode failed");

  return res.json();
}

export async function downloadNotesPdf(lectureId: string): Promise<void> {
  const res = await fetchWithRetry(
    `${API_URL}/api/lectures/${lectureId}/pdf`,
    {},
    { timeout: 60_000 } // PDF generation can be slow
  );

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
  const res = await fetchWithRetry(`${API_URL}/api/lectures/${lectureId}`, {
    method: "DELETE",
  });

  await checkResponse(res, "Failed to delete lecture");
}

export async function renameLecture(lectureId: string, title: string): Promise<void> {
  const res = await fetchWithRetry(`${API_URL}/api/lectures/${lectureId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
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
  const res = await fetchWithRetry(
    `${API_URL}/api/tutor/ask`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lecture_id: lectureId,
        question,
        conversation_history: conversationHistory,
        current_section_index: currentSectionIndex,
        card_context: cardContext || null,
      }),
    },
    { timeout: 60_000 } // LLM tutor calls can take longer
  );

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
  const res = await fetchWithRetry(`${API_URL}/api/user/limits`);

  await checkResponse(res, "Failed to fetch user limits");

  return res.json();
}

export async function healthCheck(): Promise<{
  status: string;
  openai_configured: boolean;
  anthropic_configured: boolean;
}> {
  const res = await fetchWithRetry(`${API_URL}/health`);
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
  const res = await fetchWithRetry(`${API_URL}/api/progress`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  await checkResponse(res, "Failed to save progress");

  return res.json();
}

export async function getAllProgress(): Promise<{
  progress: StudyProgress[];
  last_studied: StudyProgress | null;
}> {
  const res = await fetchWithRetry(`${API_URL}/api/progress`);

  await checkResponse(res, "Failed to fetch progress");

  return res.json();
}

export async function getLectureProgress(
  lectureId: string
): Promise<{ progress: StudyProgress[] }> {
  const res = await fetchWithRetry(`${API_URL}/api/progress/${lectureId}`);

  await checkResponse(res, "Failed to fetch lecture progress");

  return res.json();
}


// ── Payments ──────────────────────────────────

export async function initializePayment(plan: string, email: string): Promise<{
  authorization_url: string;
  reference: string;
  access_code: string;
}> {
  const res = await fetchWithRetry(`${API_URL}/api/payments/initialize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, email }),
  });

  await checkResponse(res, "Failed to initialize payment");
  return res.json();
}

export async function verifyPayment(reference: string): Promise<{
  verified: boolean;
  plan?: string;
  message: string;
}> {
  const res = await fetchWithRetry(`${API_URL}/api/payments/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference }),
  });

  await checkResponse(res, "Failed to verify payment");
  return res.json();
}

export async function getSubscriptionStatus(): Promise<{
  tier: string;
  lectures_limit: number;
  status: string;
  current_period_end?: string;
}> {
  const res = await fetchWithRetry(`${API_URL}/api/payments/subscription`);

  await checkResponse(res, "Failed to fetch subscription");
  return res.json();
}
