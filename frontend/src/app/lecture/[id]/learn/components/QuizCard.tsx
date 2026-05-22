"use client";

import React from "react";
import { CheckCircle2, XCircle, ChevronLeft, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { RenderBody, RenderInline, TutorMessageContent } from "./markdown";
import type { QuizQuestion } from "@/lib/api";

interface QuizCardProps {
  question: QuizQuestion;
  questionIndex: number;
  isFirst: boolean;
  isLast: boolean;
  cardIndex: number;
  selectedAnswer: number | undefined;
  isRevealed: boolean;
  onSelectAnswer: (qIndex: number, optIndex: number) => void;
  onNext: () => void;
  onPrev: () => void;
  onViewNotes: () => void;
  reteachIndex: number | null;
  reteachLoading: boolean;
  reteachText: string;
  onReteach: (qIndex: number) => void;
}

export const QuizCard = React.memo(function QuizCard({
  question,
  questionIndex,
  isFirst,
  isLast,
  cardIndex,
  selectedAnswer,
  isRevealed,
  onSelectAnswer,
  onNext,
  onPrev,
  onViewNotes,
  reteachIndex,
  reteachLoading,
  reteachText,
  onReteach,
}: QuizCardProps) {
  const qi = questionIndex;
  const q = question;
  const isCorrect = isRevealed && selectedAnswer === q.correct_index;

  return (
    <div
      key={`quiz-${cardIndex}`}
      className="bg-paper border border-[rgba(217,185,130,0.25)] rounded-2xl shadow-sm overflow-hidden"
      style={{ animation: "fadeSlideIn 0.3s ease-out" }}
    >
      {/* Quiz label */}
      <div className="px-6 sm:px-8 pt-5">
        <span className="text-[10px] font-bold text-green-700 uppercase tracking-widest">Quick Check</span>
      </div>

      <div className="p-6 sm:p-8 pt-4">
        <div className="text-lg font-bold text-ink leading-snug mb-5" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
          <RenderBody text={q.question} />
        </div>

        {/* Options */}
        <div className="space-y-2.5">
          {q.options.map((opt, oi) => {
            const isSelected = selectedAnswer === oi;
            const isCorrectOpt = oi === q.correct_index;

            let style = "border-[rgba(217,185,130,0.3)] text-ink-l hover:border-[rgba(217,185,130,0.5)] hover:bg-cream-d/50";
            if (isRevealed) {
              if (isCorrectOpt) {
                style = "border-green-400/50 bg-green-50 text-green-800";
              } else if (isSelected && !isCorrectOpt) {
                style = "border-red-400/50 bg-red-50 text-red-700";
              } else {
                style = "border-[rgba(217,185,130,0.15)] text-ink-m";
              }
            } else if (isSelected) {
              style = "border-ink/30 bg-cream-d text-ink";
            }

            return (
              <button
                key={oi}
                onClick={() => onSelectAnswer(qi, oi)}
                disabled={isRevealed}
                aria-pressed={isSelected}
                aria-label={`Option ${String.fromCharCode(65 + oi)}`}
                className={`w-full flex items-center gap-3 text-left text-sm p-4 rounded-xl border transition-all ${style}`}
              >
                <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                  isRevealed && isCorrectOpt ? "border-green-500 bg-green-500 text-white" :
                  isRevealed && isSelected ? "border-red-400 bg-red-400 text-white" :
                  isSelected ? "border-ink bg-ink text-white" : "border-ink-m/40 text-ink-m"
                }`}>
                  {isRevealed && isCorrectOpt ? <CheckCircle2 className="w-4 h-4" /> :
                   isRevealed && isSelected && !isCorrectOpt ? <XCircle className="w-4 h-4" /> :
                   String.fromCharCode(65 + oi)}
                </div>
                <span className={isRevealed && isSelected && !isCorrectOpt ? "line-through" : ""}><RenderInline text={opt} /></span>
                {isRevealed && isSelected && !isCorrectOpt && (
                  <span className="ml-auto text-[10px] font-bold text-red-500 uppercase">Your pick</span>
                )}
                {isRevealed && isCorrectOpt && (
                  <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Feedback after answering */}
        {isRevealed && (
          <div className={`mt-4 p-4 rounded-xl text-sm leading-relaxed ${
            isCorrect
              ? "bg-green-50 border border-green-200/50 text-green-800"
              : "bg-amber-50 border border-amber-200/50 text-amber-900"
          }`}>
            {isCorrect ? (
              <div><p className="mb-2"><strong>Correct!</strong></p><RenderBody text={q.explanation} /></div>
            ) : (
              <>
                <div className="mb-3"><p className="mb-2"><strong>Not quite.</strong></p><RenderBody text={q.explanation} /></div>

                {/* Reteach */}
                {reteachIndex === qi && (reteachLoading || reteachText) ? (
                  <div className="mt-3 rounded-xl overflow-hidden border border-amber-300/40 bg-paper">
                    <div className="px-4 py-2 flex items-center gap-2 border-b border-amber-200/30">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">
                        Let&apos;s try that differently
                      </span>
                    </div>
                    <div className="px-4 py-3">
                      {reteachLoading ? (
                        <div className="flex items-center gap-2 py-2">
                          <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
                          <span className="text-sm text-amber-800">Thinking of a better explanation...</span>
                        </div>
                      ) : (
                        <TutorMessageContent content={reteachText} />
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => onReteach(qi)}
                    className="flex items-center gap-2 text-xs font-semibold text-amber-700 hover:text-amber-900 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Teach me this differently
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Nav footer */}
      <div className="px-6 sm:px-8 pb-6 pt-2 flex items-center justify-between border-t border-[rgba(217,185,130,0.15)]">
        <button
          onClick={onPrev}
          disabled={isFirst}
          className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 rounded-xl transition-all ${
            isFirst ? "text-ink-m/40 cursor-not-allowed" : "text-ink-m hover:bg-cream-d active:scale-95"
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={() => {
            if (isLast) onViewNotes();
            else onNext();
          }}
          className="flex items-center gap-1.5 text-sm font-semibold px-5 py-2.5 rounded-xl bg-ink text-white shadow-sm hover:shadow-md active:scale-95 transition-all"
        >
          {isLast ? <>View Notes <ChevronRight className="w-4 h-4" /></> : <>Next card <ChevronRight className="w-4 h-4" /></>}
        </button>
      </div>
    </div>
  );
})
