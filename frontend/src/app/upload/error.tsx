"use client";

import { useRouter } from "next/navigation";
import { ErrorFallbackUI } from "@/components/ErrorBoundary";

export default function UploadError({
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
      label="the upload page"
      onReset={reset}
      onGoHome={() => router.push("/dashboard")}
    />
  );
}
