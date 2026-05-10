"use client";

/**
 * AuthSync — Keeps the API auth token in sync with the Clerk session.
 *
 * Mount this once in the app layout (inside ClerkProvider).
 * It continuously fetches the latest Clerk session token and caches it
 * via setAuthToken(), so every API call automatically gets auth headers.
 *
 * This replaces the old pattern where each page had to manually call
 * setAuthToken() — which was error-prone and caused auth failures
 * when users navigated directly to notes/learn pages.
 */

import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { setAuthToken } from "@/lib/auth";

export default function AuthSync() {
  const { getToken, isSignedIn } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isSignedIn) {
      setAuthToken(null);
      return;
    }

    // Fetch token immediately
    const syncToken = async () => {
      try {
        const token = await getToken();
        setAuthToken(token);
      } catch {
        // Silently handle — will retry on next interval
      }
    };

    syncToken();

    // Refresh token every 50 seconds (Clerk tokens expire after ~60s)
    intervalRef.current = setInterval(syncToken, 50_000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [getToken, isSignedIn]);

  return null; // Invisible component
}
