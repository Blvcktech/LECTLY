"use client";

import type { FlowCard } from "./types";

interface ProgressDotsProps {
  cardFlow: FlowCard[];
  cardIndex: number;
  totalCards: number;
  onSelectCard: (index: number) => void;
}

export function ProgressDots({
  cardFlow,
  cardIndex,
  totalCards,
  onSelectCard,
}: ProgressDotsProps) {
  return (
    <div className="flex items-center justify-center gap-1.5 mb-5 overflow-x-auto px-2 scrollbar-hide">
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {cardFlow.map((card, i) => {
          const isQuiz = card.type === "quiz";
          const isAnalogy = card.type === "analogy";
          return (
            <button
              key={i}
              onClick={() => onSelectCard(i)}
              className={`transition-all duration-300 rounded-full flex-shrink-0 ${
                i === cardIndex
                  ? isQuiz
                    ? "w-8 h-2.5 bg-gradient-to-r from-green-500 to-emerald-500"
                    : isAnalogy
                    ? "w-8 h-2.5 bg-gradient-to-r from-amber-500 to-orange-500"
                    : "w-8 h-2.5 bg-[#1a1815]"
                  : i < cardIndex
                  ? isQuiz
                    ? "w-2.5 h-2.5 bg-green-400/50"
                    : "w-2.5 h-2.5 bg-[#1a1815]/40"
                  : isQuiz
                  ? "w-2.5 h-2.5 bg-green-300/30"
                  : "w-2.5 h-2.5 bg-[#8a7f6f]/30"
              }`}
              aria-label={`Go to card ${i + 1}`}
            />
          );
        })}
      </div>
      <span className="ml-3 text-[11px] font-medium text-[#8a7f6f] flex-shrink-0">
        {cardIndex + 1} / {totalCards}
      </span>
    </div>
  );
}
