"use client";

import { useRouter } from "next/navigation";
import { ErrorFallbackUI } from "@/components/ErrorBoundary";

export default function ProfileError({
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
      label="your profile"
      onReset={reset}
      onGoHome={() => router.push("/dashboard")}
    />
  );
}
