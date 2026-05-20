"use client";

import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-ink/10 flex items-center justify-center mx-auto mb-6">
          <WifiOff className="w-8 h-8 text-ink-m" />
        </div>
        <h1
          className="text-2xl font-extrabold text-ink mb-3"
          style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}
        >
          You&apos;re offline
        </h1>
        <p className="text-ink-m text-sm leading-relaxed mb-8">
          Lectly needs an internet connection to load your lectures and generate
          notes. Please check your connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-ink text-cream rounded-xl text-sm font-semibold hover:bg-[#2a2825] transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
