"use client";

import React from "react";
import { Lightbulb, ChevronLeft, ChevronRight } from "lucide-react";

interface AnalogyCardProps {
  body: string;
  cardIndex: number;
  totalCards: number;
  isFirst: boolean;
  isLast: boolean;
  onNext: () => void;
  onPrev: () => void;
  onViewNotes: () => void;
  onAskTutor: (message: string) => void;
}

export const AnalogyCard = React.memo(function AnalogyCard({
  body,
  cardIndex,
  totalCards,
  isFirst,
  isLast,
  onNext,
  onPrev,
  onViewNotes,
  onAskTutor,
}: AnalogyCardProps) {
  return (
    <div
      key={`analogy-${cardIndex}`}
      className="bg-paper border border-[rgba(217,185,130,0.25)] rounded-2xl shadow-sm overflow-hidden"
      style={{ animation: "fadeSlideIn 0.3s ease-out" }}
    >
      <div className="px-6 sm:px-8 pt-5 flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-amber-600" />
        <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Real-World Analogy</span>
      </div>

      <div className="p-6 sm:p-8 pt-4">
        <div className="prose max-w-none">
          {body.split("\n\n").map((p, i) => (
            <p key={i} className="text-sm text-ink-l leading-[1.85] mb-4 last:mb-0 italic">
              {p.trim()}
            </p>
          ))}
        </div>
      </div>

      <div className="px-6 sm:px-8 pb-6 pt-2 border-t border-[rgba(217,185,130,0.15)]">
        {/* "Need more?" hint on last card */}
        {cardIndex >= totalCards - 1 && (
          <div className="flex items-center justify-center gap-2 mb-3">
            <button
              onClick={() => {
                onAskTutor("Can you explain this topic in more depth with additional examples?");
              }}
              className="text-xs text-accent hover:text-accent-l transition-colors"
            >
              Need more detail? Ask the tutor
            </button>
          </div>
        )}
        <div className="flex items-center justify-between">
          <button
            onClick={onPrev}
            className="flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 rounded-xl text-ink-m hover:bg-cream-d active:scale-95 transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={() => {
              if (cardIndex >= totalCards - 1) onViewNotes();
              else onNext();
            }}
            className="flex items-center gap-1.5 text-sm font-semibold px-5 py-2.5 rounded-xl bg-ink text-white shadow-sm hover:shadow-md active:scale-95 transition-all"
          >
            {cardIndex >= totalCards - 1 ? <>View Notes <ChevronRight className="w-4 h-4" /></> : <>Next <ChevronRight className="w-4 h-4" /></>}
          </button>
        </div>
      </div>
    </div>
  );
})
