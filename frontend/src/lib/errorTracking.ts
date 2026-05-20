/**
 * Lectly — Lightweight Error Tracking
 *
 * Captures errors with structured context and sends them to the backend.
 * Designed as a thin layer that's easy to swap for Sentry later.
 *
 * Usage:
 *   reportError(error, { component: "LearnMode", action: "loadCards" });
 *
 * In development: logs to console with full context.
 * In production: batches errors and POSTs to /api/errors (when endpoint exists).
 */

const IS_DEV = process.env.NODE_ENV === "development";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types ──────────────────────────────────────

export interface ErrorContext {
  /** Component or module name */
  component?: string;
  /** What the user was doing */
  action?: string;
  /** Extra data for debugging */
  metadata?: Record<string, unknown>;
}

interface ErrorReport {
  message: string;
  stack?: string;
  component?: string;
  action?: string;
  metadata?: Record<string, unknown>;
  url: string;
  userAgent: string;
  timestamp: string;
}

// ── Error Buffer (batch sends) ─────────────────

const ERROR_BUFFER: ErrorReport[] = [];
const FLUSH_INTERVAL = 30_000; // 30 seconds
const MAX_BUFFER_SIZE = 20;
let flushTimer: ReturnType<typeof setInterval> | null = null;

function startFlushTimer() {
  if (flushTimer) return;
  flushTimer = setInterval(flushErrors, FLUSH_INTERVAL);
}

async function flushErrors() {
  if (ERROR_BUFFER.length === 0) return;

  const batch = ERROR_BUFFER.splice(0, ERROR_BUFFER.length);

  try {
    // Use navigator.sendBeacon for reliability (works even during page unload)
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(
        `${API_URL}/api/errors`,
        new Blob([JSON.stringify({ errors: batch })], { type: "application/json" })
      );
    }
  } catch {
    // Silently fail — error tracking should never cause errors
  }
}

// Flush on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", flushErrors);
  window.addEventListener("pagehide", flushErrors);
}

// ── Public API ─────────────────────────────────

/**
 * Report an error with optional context.
 * Dev: console.error with structured output.
 * Prod: buffers and batches to backend.
 */
export function reportError(error: unknown, context: ErrorContext = {}): void {
  const err = normalizeError(error);

  const report: ErrorReport = {
    message: err.message,
    stack: err.stack,
    component: context.component,
    action: context.action,
    metadata: context.metadata,
    url: typeof window !== "undefined" ? window.location.href : "",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    timestamp: new Date().toISOString(),
  };

  if (IS_DEV) {
    console.error(
      `[Lectly Error] ${context.component || "Unknown"}${context.action ? ` → ${context.action}` : ""}`,
      "\n  Message:", err.message,
      context.metadata ? "\n  Metadata:" : "",
      context.metadata || "",
      "\n  Stack:", err.stack || "(no stack)"
    );
    return;
  }

  // Production: buffer for batch send
  ERROR_BUFFER.push(report);
  startFlushTimer();

  // Flush immediately if buffer is full
  if (ERROR_BUFFER.length >= MAX_BUFFER_SIZE) {
    flushErrors();
  }
}

/**
 * Capture unhandled promise rejections and global errors.
 * Call once in your app layout.
 */
export function initGlobalErrorTracking(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason, {
      component: "Global",
      action: "unhandledRejection",
    });
  });

  window.addEventListener("error", (event) => {
    reportError(event.error || event.message, {
      component: "Global",
      action: "uncaughtError",
      metadata: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });
}

// ── Helpers ─────────────────────────────────────

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === "string") return new Error(error);
  return new Error(String(error));
}
