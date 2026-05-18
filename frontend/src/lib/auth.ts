/**
 * Lectly Auth — Clerk-based auth helper.
 *
 * Two-part system:
 * 1. AuthSync component registers Clerk's getToken() via setTokenGetter()
 * 2. API calls use freshAuthHeaders() which always fetches a fresh token
 *
 * This eliminates all token-expiry issues. Every API call gets a fresh
 * Clerk token right before the request, so tokens can never be stale.
 *
 * Why this matters on mobile Chrome:
 * Chrome freezes tabs when backgrounded (e.g. during file picker).
 * Unlike Safari which reloads the page, Chrome resumes with stale state.
 * freshAuthHeaders() + the visibilitychange listener in AuthSync handle this.
 */

let _cachedToken: string | null = null;
let _getToken: (() => Promise<string | null>) | null = null;

/**
 * Register Clerk's getToken function so the API layer can refresh tokens.
 * Called once by AuthSync on mount.
 */
export function setTokenGetter(getter: (() => Promise<string | null>) | null) {
  _getToken = getter;
}

/**
 * Set the current auth token (called from components with useAuth).
 */
export function setAuthToken(token: string | null) {
  _cachedToken = token;
}

/**
 * Get auth headers using the cached token.
 * Prefer freshAuthHeaders() which guarantees a fresh token.
 */
export function authHeaders(): Record<string, string> {
  if (!_cachedToken) return {};
  return { Authorization: `Bearer ${_cachedToken}` };
}

/**
 * Get auth headers with a guaranteed-fresh token.
 *
 * Calls Clerk's getToken() to get a new JWT right before the request.
 * If the first attempt returns null (can happen when Chrome mobile
 * resumes a frozen tab), waits briefly and retries once to give
 * Clerk time to re-establish the session.
 *
 * Falls back to the cached token only as a last resort.
 */
export async function freshAuthHeaders(): Promise<Record<string, string>> {
  if (_getToken) {
    try {
      let token = await _getToken();

      // If null, Clerk may need a moment after tab resume — retry once
      if (!token) {
        await new Promise((r) => setTimeout(r, 500));
        token = await _getToken();
      }

      if (token) {
        _cachedToken = token;
        return { Authorization: `Bearer ${token}` };
      }
    } catch {
      // Fall through to cached token
    }
  }

  // Fallback to cached token
  if (!_cachedToken) return {};
  return { Authorization: `Bearer ${_cachedToken}` };
}
