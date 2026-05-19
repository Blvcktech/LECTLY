"use client";

import { useRouter } from "next/navigation";
import { ErrorFallbackUI } from "@/components/ErrorBoundary";

export default function DashboardError({
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
      label="your dashboard"
      onReset={reset}
      onGoHome={() => router.push("/dashboard")}
    />
  );
}
