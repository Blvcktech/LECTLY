"use client";

import { useRouter } from "next/navigation";
import { ErrorFallbackUI } from "@/components/ErrorBoundary";

/**
 * Root error boundary — catches any unhandled error in the app
 * (except errors in the root layout itself, which global-error.tsx handles).
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  return (
    <ErrorFallbackUI
      error={error}
      onReset={reset}
      onGoHome={() => router.push("/dashboard")}
    />
  );
}
