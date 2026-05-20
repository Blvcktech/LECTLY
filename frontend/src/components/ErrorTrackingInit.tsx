"use client";

import { useEffect } from "react";
import { initGlobalErrorTracking } from "@/lib/errorTracking";
import { initWebVitals } from "@/lib/webVitals";

/**
 * Initializes global error tracking and performance monitoring.
 * Mount once in the root layout.
 */
export default function ErrorTrackingInit() {
  useEffect(() => {
    initGlobalErrorTracking();
    initWebVitals();
  }, []);

  return null;
}
