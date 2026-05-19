"use client";

import { useRouter } from "next/navigation";
import { ErrorFallbackUI } from "@/components/ErrorBoundary";

export default function SolveModeError({
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
      label="Solve Mode"
      onReset={reset}
      onGoHome={() => router.push("/dashboard")}
    />
  );
}
