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
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Don't do anything until Clerk has finished loading.
    // Previously, isSignedIn could be undefined during loading,
    // which caused setAuthToken(null) and wiped out valid tokens.
    if (!isLoaded) return;

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

    // Refresh token every 45 seconds (Clerk tokens expire after ~60s)
    // Reduced from 50s to give more buffer
    intervalRef.current = setInterval(syncToken, 45_000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [getToken, isSignedIn, isLoaded]);

  return null; // Invisible component
}
