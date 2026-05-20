"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { RenderBody } from "./markdown";

interface ConceptCardProps {
  card: { subtitle: string; body: string };
  cardIndex: number;
  isFirst: boolean;
  isLast: boolean;
  onNext: () => void;
  onPrev: () => void;
  onViewNotes: () => void;
}

/** Threshold in characters — bodies longer than this get a "Show more" toggle on mobile */
const TRUNCATE_THRESHOLD = 600;

export const ConceptCard = React.memo(function ConceptCard({
  card,
  cardIndex,
  isFirst,
  isLast,
  onNext,
  onPrev,
  onViewNotes,
}: ConceptCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isLong = card.body.length > TRUNCATE_THRESHOLD;

  // On mobile, truncate long cards to first ~600 chars (at a paragraph break)
  const displayBody = !expanded && isLong
    ? card.body.slice(0, TRUNCATE_THRESHOLD).replace(/\n[^\n]*$/, "") + "..."
    : card.body;

  return (
    <div
      key={`concept-${cardIndex}`}
      className="bg-paper border border-[rgba(217,185,130,0.25)] rounded-2xl shadow-sm overflow-hidden"
      style={{ animation: "fadeSlideIn 0.3s ease-out" }}
    >
      {/* Concept label */}
      <div className="px-6 sm:px-8 pt-5 flex items-center gap-3">
        <span className="text-[10px] font-bold text-green-700 uppercase tracking-widest">Concept</span>
        <span className="text-[10px] text-ink-m">·</span>
        <span className="text-[10px] text-ink-m">30 sec read</span>
      </div>

      <div className="p-6 sm:p-8 pt-4">
        {/* Card title */}
        {card.subtitle && (
          <h2 className="text-xl font-bold text-ink leading-snug mb-4" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
            {card.subtitle}
          </h2>
        )}

        {/* Card body — truncated on mobile for long content */}
        <div className="prose max-w-none">
          <div className="sm:hidden">
            <RenderBody text={displayBody} />
            {isLong && !expanded && (
              <button
                onClick={() => setExpanded(true)}
                className="flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-l mt-2 transition-colors"
              >
                Show more <ChevronDown className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="hidden sm:block">
            <RenderBody text={card.body} />
          </div>
        </div>
      </div>

      {/* Card navigation footer */}
      <div className="px-6 sm:px-8 pb-6 pt-2 flex items-center justify-between border-t border-[rgba(217,185,130,0.15)]">
        <button
          onClick={onPrev}
          disabled={isFirst}
          className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 rounded-xl transition-all ${
            isFirst
              ? "text-ink-m/40 cursor-not-allowed"
              : "text-ink-m hover:bg-cream-d active:scale-95"
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <button
          onClick={() => {
            if (isLast) {
              onViewNotes();
            } else {
              onNext();
            }
          }}
          className="flex items-center gap-1.5 text-sm font-semibold px-5 py-2.5 rounded-xl bg-ink text-white shadow-sm hover:shadow-md active:scale-95 transition-all"
        >
          {isLast ? (
            <>View Notes <ChevronRight className="w-4 h-4" /></>
          ) : (
            <>I got it <ChevronRight className="w-4 h-4" /></>
          )}
        </button>
      </div>
    </div>
  );
})
