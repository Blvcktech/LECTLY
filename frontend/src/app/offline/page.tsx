"use client";

import { WifiOff, RefreshCw } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-3xl bg-cream-d border border-[rgba(217,185,130,0.25)] flex items-center justify-center mx-auto mb-6">
          <WifiOff className="w-10 h-10 text-ink-m" />
        </div>
        <h1
          className="text-xl font-bold text-ink mb-2"
          style={{
            fontFamily:
              "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif",
          }}
        >
          You&apos;re offline
        </h1>
        <p className="text-sm text-ink-m leading-relaxed mb-6">
          Lectly needs an internet connection to load your lectures. Check your
          Wi-Fi or mobile data and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 text-sm font-semibold bg-ink hover:bg-ink-h text-white px-5 py-2.5 rounded-xl transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    </div>
  );
}
