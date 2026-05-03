/**
 * Lectly Auth — Clerk-based auth helper.
 * Provides authHeaders() for API calls using the Clerk session token.
 */

let _cachedToken: string | null = null;

/**
 * Set the current auth token (called from components with useAuth).
 */
export function setAuthToken(token: string | null) {
  _cachedToken = token;
}

/**
 * Get auth headers for API requests.
 */
export function authHeaders(): Record<string, string> {
  if (!_cachedToken) return {};
  return { Authorization: `Bearer ${_cachedToken}` };
}
