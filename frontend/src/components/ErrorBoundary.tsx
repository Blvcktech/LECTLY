"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle, RotateCcw, Home } from "lucide-react";

// ── Types ────────────────────────────────────────

interface ErrorBoundaryProps {
  children: ReactNode;
  /** What area this boundary covers — shown in the error UI */
  label?: string;
  /** Compact mode for wrapping subsections instead of full pages */
  compact?: boolean;
  /** Custom fallback component */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// ── ErrorBoundary Class Component ────────────────
// React error boundaries MUST be class components — hooks can't catch render errors.

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Log to console for debugging — in production you'd send this to Sentry/etc
    console.error(
      `[Lectly ErrorBoundary${this.props.label ? ` — ${this.props.label}` : ""}]`,
      error,
      errorInfo
    );
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback takes priority
      if (this.props.fallback) return this.props.fallback;

      // Compact mode — small inline error for subsections
      if (this.props.compact) {
        return (
          <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 text-center">
            <AlertCircle className="w-5 h-5 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-700 font-medium mb-1">
              Something went wrong{this.props.label ? ` in ${this.props.label}` : ""}
            </p>
            <button
              onClick={this.handleReset}
              className="text-xs text-red-600 hover:text-red-800 font-medium underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        );
      }

      // Full page error — matches Lectly's design system
      return <ErrorFallbackUI
        error={this.state.error}
        label={this.props.label}
        onReset={this.handleReset}
      />;
    }

    return this.props.children;
  }
}

// ── Reusable Fallback UI ─────────────────────────
// Exported separately so Next.js error.tsx files can use the same design.

export function ErrorFallbackUI({
  error,
  label,
  onReset,
  onGoHome,
}: {
  error: Error | null;
  label?: string;
  onReset?: () => void;
  onGoHome?: () => void;
}) {
  const isNetworkError =
    error?.message?.includes("fetch") ||
    error?.message?.includes("NetworkError") ||
    error?.message?.includes("network") ||
    error?.message?.includes("timed out");

  const isAuthError =
    error?.message?.includes("Session expired") ||
    error?.message?.includes("sign in");

  // Pick a user-friendly message
  let title = "Something went wrong";
  let description = "An unexpected error occurred. Please try again.";

  if (isNetworkError) {
    title = "Connection problem";
    description = "Can't reach the server. Check your internet connection and try again.";
  } else if (isAuthError) {
    title = "Session expired";
    description = "Your login session has expired. Please sign in again.";
  } else if (label) {
    description = `Something went wrong while loading ${label}. Please try again.`;
  }

  return (
    <div className="min-h-[50vh] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-5">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>

        {/* Message */}
        <h2
          className="text-lg font-bold text-[#1a1815] mb-2"
          style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}
        >
          {title}
        </h2>
        <p className="text-sm text-[#8a7f6f] mb-6 leading-relaxed">
          {description}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          {onReset && (
            <button
              onClick={onReset}
              className="flex items-center gap-2 text-sm font-semibold bg-[#0F3D43] hover:bg-[#1a5c65] text-white px-5 py-2.5 rounded-xl transition-colors shadow-md shadow-[#0F3D43]/15"
            >
              <RotateCcw className="w-4 h-4" />
              Try again
            </button>
          )}
          {onGoHome && (
            <button
              onClick={onGoHome}
              className="flex items-center gap-2 text-sm font-medium text-[#8a7f6f] hover:text-[#1a1815] px-4 py-2.5 rounded-xl border border-[rgba(217,185,130,0.25)] hover:border-[rgba(217,185,130,0.5)] transition-colors"
            >
              <Home className="w-4 h-4" />
              Dashboard
            </button>
          )}
        </div>

        {/* Debug info — only in development */}
        {process.env.NODE_ENV === "development" && error && (
          <details className="mt-6 text-left">
            <summary className="text-[11px] text-[#8a7f6f] cursor-pointer hover:text-[#1a1815]">
              Error details (dev only)
            </summary>
            <pre className="mt-2 text-[10px] text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

export default ErrorBoundary;
