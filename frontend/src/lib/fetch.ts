/**
 * Lectly — Resilient Fetch Layer
 *
 * Wraps native fetch with:
 * - Automatic retry + exponential backoff for network errors & 502/503/504
 * - Fresh auth token before every attempt (handles token expiry across retries)
 * - AbortController timeouts (10s GET, 30s POST, 300s uploads)
 * - In-flight GET deduplication (identical GETs share one request)
 * - No retry on client errors (400/401/403/404/409/422/429)
 *
 * Designed for unreliable mobile networks (Nigerian mobile data, etc).
 */

import { freshAuthHeaders } from "./auth";

// ── Configuration ────────────────────────────────

const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s
const MAX_RETRIES = 3;

const TIMEOUT_GET = 10_000;      // 10 seconds
const TIMEOUT_POST = 30_000;     // 30 seconds
const TIMEOUT_UPLOAD = 600_000;  // 10 minutes — large files on Nigerian mobile data need this

/** HTTP status codes that should NOT be retried (client errors) */
const NO_RETRY_STATUSES = new Set([400, 401, 403, 404, 409, 422, 429]);

/** HTTP status codes that SHOULD be retried (server/gateway errors) */
const RETRY_STATUSES = new Set([502, 503, 504]);

// ── In-flight dedup map for GET requests ─────────

const inflight = new Map<string, Promise<Response>>();

// ── Types ────────────────────────────────────────

export interface FetchWithRetryOptions {
  /** Override max retries (default 3) */
  maxRetries?: number;
  /** Override timeout in ms */
  timeout?: number;
  /** Skip deduplication even for GET */
  skipDedup?: boolean;
  /** If true, this is a file upload — uses longer timeout, no Content-Type merge */
  isUpload?: boolean;
}

// ── Core Function ────────────────────────────────

/**
 * Resilient fetch wrapper. Drop-in replacement for native fetch.
 *
 * @param url     - Full URL to fetch
 * @param init    - Standard RequestInit (method, body, headers, etc.)
 * @param options - Extra retry/timeout options
 * @returns       - The Response object (caller handles .json(), checkResponse, etc.)
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const method = (init.method || "GET").toUpperCase();
  const maxRetries = options.maxRetries ?? MAX_RETRIES;
  const isUpload = options.isUpload ?? false;

  // Pick timeout based on request type
  const timeout =
    options.timeout ??
    (isUpload ? TIMEOUT_UPLOAD : method === "GET" ? TIMEOUT_GET : TIMEOUT_POST);

  // ── GET deduplication ──
  // If an identical GET is already in-flight, return the same promise
  if (method === "GET" && !options.skipDedup) {
    const existing = inflight.get(url);
    if (existing) {
      return existing.then((res) => res.clone());
    }
  }

  const execute = async (): Promise<Response> => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // Wait before retrying (not on first attempt)
      if (attempt > 0) {
        const delay = RETRY_DELAYS[Math.min(attempt - 1, RETRY_DELAYS.length - 1)];
        // Add jitter: ±25% to prevent thundering herd
        const jitter = delay * (0.75 + Math.random() * 0.5);
        await new Promise((r) => setTimeout(r, jitter));
      }

      // Fresh auth token for every attempt
      const authHeaders = await freshAuthHeaders();

      // Merge headers: auth + caller's headers
      // For uploads (FormData), don't set Content-Type — browser sets it with boundary
      const callerHeaders = (init.headers as Record<string, string>) || {};
      const mergedHeaders: Record<string, string> = {
        ...authHeaders,
        ...callerHeaders,
      };

      // AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const res = await fetch(url, {
          ...init,
          headers: mergedHeaders,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Success — return immediately
        if (res.ok) return res;

        // Client error — don't retry, throw immediately
        if (NO_RETRY_STATUSES.has(res.status)) return res;

        // Server error that's retryable — continue to next attempt
        if (RETRY_STATUSES.has(res.status)) {
          lastError = new Error(`HTTP ${res.status} on ${method} ${url}`);
          continue;
        }

        // Other server errors (500, etc.) — return as-is, let caller handle
        return res;
      } catch (err: unknown) {
        clearTimeout(timeoutId);

        // AbortError = timeout
        if (err instanceof DOMException && err.name === "AbortError") {
          lastError = new Error(
            `Request timed out after ${timeout / 1000}s: ${method} ${url}`
          );
          // Timeouts are retryable
          continue;
        }

        // Network error (offline, DNS failure, connection refused)
        if (err instanceof TypeError && err.message.includes("fetch")) {
          lastError = new Error(`Network error: ${err.message}`);
          continue;
        }

        // Unknown error — also retry
        lastError = err instanceof Error ? err : new Error(String(err));
        continue;
      }
    }

    // All retries exhausted
    throw lastError || new Error(`Request failed after ${maxRetries + 1} attempts`);
  };

  // ── Wrap with dedup for GET ──
  if (method === "GET" && !options.skipDedup) {
    const promise = execute().finally(() => {
      inflight.delete(url);
    });
    inflight.set(url, promise);
    return promise.then((res) => res.clone());
  }

  return execute();
}
