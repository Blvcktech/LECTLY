"use client";

import { AlertCircle, RotateCcw } from "lucide-react";

/**
 * Global error boundary — catches errors in the ROOT LAYOUT itself.
 * This is the last line of defense. Because the root layout may have
 * crashed, this component must provide its own <html> and <body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F7F4EE",
          fontFamily:
            "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 380, padding: "0 20px" }}>
          {/* Icon */}
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              backgroundColor: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
            }}
          >
            <AlertCircle size={32} color="#ef4444" />
          </div>

          {/* Message */}
          <h1
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "#1a1815",
              margin: "0 0 8px",
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "#8a7f6f",
              lineHeight: 1.6,
              margin: "0 0 24px",
            }}
          >
            Lectly ran into an unexpected error. This has been logged and
            we&apos;ll look into it.
          </p>

          {/* Retry button */}
          <button
            onClick={reset}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
              fontWeight: 600,
              backgroundColor: "#0F3D43",
              color: "white",
              padding: "10px 20px",
              borderRadius: 12,
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(15,61,67,0.15)",
            }}
          >
            <RotateCcw size={16} />
            Reload Lectly
          </button>

          {/* Dev-only error detail */}
          {process.env.NODE_ENV === "development" && error && (
            <details style={{ marginTop: 24, textAlign: "left" }}>
              <summary
                style={{
                  fontSize: 11,
                  color: "#8a7f6f",
                  cursor: "pointer",
                }}
              >
                Error details (dev only)
              </summary>
              <pre
                style={{
                  marginTop: 8,
                  fontSize: 10,
                  color: "#dc2626",
                  backgroundColor: "rgba(239,68,68,0.05)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: 8,
                  padding: 12,
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {error.message}
                {error.stack && `\n\n${error.stack}`}
              </pre>
            </details>
          )}
        </div>
      </body>
    </html>
  );
}
