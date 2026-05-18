"use client";

/**
 * AuthSync — Keeps the API auth token in sync with the Clerk session.
 *
 * Mount this once in the app layout (inside ClerkProvider).
 *
 * It does three things:
 * 1. Registers Clerk's getToken() with the auth module so API calls
 *    can always fetch a fresh token (via freshAuthHeaders()).
 * 2. Keeps the cached token refreshed every 45 seconds as a backup.
 * 3. Re-syncs the token when the tab becomes visible again.
 *    This is CRITICAL for mobile Chrome, which freezes tabs instead
 *    of reloading them (Safari reloads, which masks the issue).
 */

import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { setAuthToken, setTokenGetter } from "@/lib/auth";

export default function AuthSync() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  // Keep a ref to the latest getToken so the visibility handler always
  // uses the most current Clerk function, not a stale closure.
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  // Register the token getter so the API layer can refresh tokens on demand.
  // We wrap it to always use the latest getToken ref.
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      setTokenGetter(() => getTokenRef.current());
    } else if (isLoaded && !isSignedIn) {
      setTokenGetter(null);
      setAuthToken(null);
    }
  }, [isSignedIn, isLoaded]);

  // Keep the cached token fresh as a backup
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    const syncToken = async () => {
      try {
        const token = await getToken();
        setAuthToken(token);
      } catch {
        // Will retry on next interval
      }
    };

    syncToken();
    intervalRef.current = setInterval(syncToken, 45_000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [getToken, isSignedIn, isLoaded]);

  // Re-sync token when the tab becomes visible again.
  // On mobile Chrome, tabs are frozen (not reloaded) when backgrounded.
  // When the user returns, the old token is expired but the page is still
  // alive with stale state. This listener fixes that.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        try {
          const token = await getTokenRef.current();
          if (token) {
            setAuthToken(token);
          }
        } catch {
          // Clerk session may need a moment to re-establish
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isSignedIn, isLoaded]);

  return null;
}
