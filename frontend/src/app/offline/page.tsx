"use client";

import { WifiOff, RefreshCw } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#F7F4EE] flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-3xl bg-[#EDE8DF] border border-[rgba(217,185,130,0.25)] flex items-center justify-center mx-auto mb-6">
          <WifiOff className="w-10 h-10 text-[#8a7f6f]" />
        </div>
        <h1
          className="text-xl font-bold text-[#1a1815] mb-2"
          style={{
            fontFamily:
              "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif",
          }}
        >
          You&apos;re offline
        </h1>
        <p className="text-sm text-[#8a7f6f] leading-relaxed mb-6">
          Lectly needs an internet connection to load your lectures. Check your
          Wi-Fi or mobile data and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 text-sm font-semibold bg-[#1a1815] hover:bg-[#2a2520] text-white px-5 py-2.5 rounded-xl transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    </div>
  );
}
