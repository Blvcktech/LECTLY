"use client";

/**
 * NotificationWatcher — Background polling for lecture processing status.
 *
 * Runs silently across all pages. When a lecture transitions from
 * "processing" to "ready" (or "failed"), it fires a toast notification
 * so the student knows their lecture is done — even if they navigated
 * away from the upload page.
 *
 * How it works:
 * 1. Every 10 seconds, fetches the user's lecture list
 * 2. Tracks which lectures are currently "processing"
 * 3. When a lecture's status changes to "ready" or "failed", shows a toast
 * 4. Stops polling when nothing is processing (saves bandwidth)
 *
 * Mount once in the app layout, inside both ClerkProvider and ToastProvider.
 */

import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { getLectures } from "@/lib/api";
import { useToast } from "@/components/Toast";

const POLL_INTERVAL = 10_000; // 10 seconds
const PROCESSING_STATUSES = new Set([
  "processing",
  "transcribing",
  "cleaning",
  "generating_notes",
]);

export default function NotificationWatcher() {
  const { isSignedIn } = useAuth();
  const { toast } = useToast();
  const processingRef = useRef<Map<string, string>>(new Map()); // id -> title
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const notifiedRef = useRef<Set<string>>(new Set()); // prevent duplicate toasts

  const checkLectures = useCallback(async () => {
    try {
      const { lectures } = await getLectures();

      // Find lectures that are currently processing
      const nowProcessing = new Map<string, string>();
      for (const lecture of lectures) {
        if (PROCESSING_STATUSES.has(lecture.status)) {
          nowProcessing.set(lecture.id, lecture.notes?.title || lecture.filename || "Your lecture");
        }
      }

      // Check if any previously-processing lectures are now done
      for (const [id, title] of processingRef.current) {
        if (notifiedRef.current.has(id)) continue; // already notified

        const lecture = lectures.find((l) => l.id === id);
        if (!lecture) continue;

        if (lecture.status === "ready") {
          toast(`"${title}" is ready! Tap to view your notes.`, "success");
          notifiedRef.current.add(id);
        } else if (lecture.status === "failed") {
          toast(`"${title}" failed to process. Try uploading again.`, "error");
          notifiedRef.current.add(id);
        }
      }

      // Update tracking
      processingRef.current = nowProcessing;

      // If nothing is processing, clear the interval (saves bandwidth)
      if (nowProcessing.size === 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      // If something IS processing and we don't have an interval, start one
      if (nowProcessing.size > 0 && !intervalRef.current) {
        intervalRef.current = setInterval(checkLectures, POLL_INTERVAL);
      }
    } catch {
      // Silently handle — user might not be authenticated yet
    }
  }, [toast]);

  useEffect(() => {
    if (!isSignedIn) {
      // Clean up when signed out
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      processingRef.current.clear();
      notifiedRef.current.clear();
      return;
    }

    // Initial check
    checkLectures();

    // Start polling (will self-stop when nothing is processing)
    intervalRef.current = setInterval(checkLectures, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isSignedIn, checkLectures]);

  // Also listen for custom events from the upload page
  // so we start tracking immediately when a new upload begins
  useEffect(() => {
    const handleUploadStarted = () => {
      // Kick off a check immediately so we pick up the new processing lecture
      checkLectures();

      // Ensure polling is running
      if (!intervalRef.current) {
        intervalRef.current = setInterval(checkLectures, POLL_INTERVAL);
      }
    };

    window.addEventListener("lectly:upload-started", handleUploadStarted);
    return () => {
      window.removeEventListener("lectly:upload-started", handleUploadStarted);
    };
  }, [checkLectures]);

  return null; // Invisible component
}
