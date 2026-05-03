/**
 * Lectly API client.
 * Handles all communication between the frontend and FastAPI backend.
 */

import { authHeaders } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

export interface TutorMessage {
  role: "user" | "tutor";
  content: string;
}

export interface TutorAskResult {
  answer: string;
  lecture_id: string;
  section_referenced?: string;
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

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(err.detail || "Upload failed");
  }

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

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Processing failed" }));
      throw new Error(err.detail || "Processing failed");
    }

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

  if (!res.ok) {
    throw new Error("Lecture not found");
  }

  return res.json();
}

export async function getLectures(): Promise<{
  lectures: Lecture[];
  count: number;
}> {
  const res = await fetch(`${API_URL}/api/lectures`, {
    headers: { ...authHeaders() },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch lectures");
  }

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

  if (!res.ok) {
    throw new Error("Explain failed");
  }

  return res.json();
}

export async function learnMode(
  lectureId: string,
  level: string = "intermediate",
  sectionIndex?: number
): Promise<LearnResult> {
  const res = await fetch(`${API_URL}/api/learn`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      lecture_id: lectureId,
      level,
      section_index: sectionIndex,
    }),
  });

  if (!res.ok) {
    throw new Error("Learn Mode failed");
  }

  return res.json();
}

export async function downloadNotesPdf(lectureId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/lectures/${lectureId}/pdf`, {
    headers: { ...authHeaders() },
  });

  if (!res.ok) {
    throw new Error("Failed to generate PDF");
  }

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

  if (!res.ok) {
    throw new Error("Failed to delete lecture");
  }
}

export async function askTutor(
  lectureId: string,
  question: string,
  conversationHistory: TutorMessage[] = [],
  currentSectionIndex?: number
): Promise<TutorAskResult> {
  const res = await fetch(`${API_URL}/api/tutor/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      lecture_id: lectureId,
      question,
      conversation_history: conversationHistory,
      current_section_index: currentSectionIndex,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Tutor request failed" }));
    throw new Error(err.detail || "Tutor request failed");
  }

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
