"use client";

import Link from "next/link";
import {
  Beaker,
  ExternalLink,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import type { LearnResult } from "@/lib/api";

interface NotesViewProps {
  learnResult: LearnResult;
  lectureId: string;
  onBackToCards: () => void;
  onAskTutor: (message: string) => void;
}

export function NotesView({
  learnResult,
  lectureId,
  onBackToCards,
  onAskTutor,
}: NotesViewProps) {
  return (
    <div className="space-y-8">
      {/* Notes header */}
      <div>
        <span className="text-[10px] font-bold text-[#8a7f6f] uppercase tracking-widest">Notes · Reference</span>
      </div>

      {/* Worked Examples */}
      {learnResult.examples.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Beaker className="w-4 h-4 text-[#0F3D43]" />
            <h2 className="text-base font-bold text-[#1a1815]" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>Worked Examples</h2>
          </div>
          <div className="space-y-4">
            {learnResult.examples.map((example, i) => {
              const problemText = example.problem || example.description || "";
              const solutionText = example.solution || "";

              return (
                <div key={i} className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-xl overflow-hidden">
                  <div className="px-5 pt-5 pb-3 flex items-start gap-3">
                    <span className="w-7 h-7 rounded-lg bg-[#0F3D43]/10 flex items-center justify-center text-sm font-bold text-[#0F3D43] flex-shrink-0">{i + 1}</span>
                    <h3 className="text-sm font-semibold text-[#1a1815] pt-0.5">{example.title}</h3>
                  </div>

                  {problemText && (
                    <div className="mx-5 mb-3 p-4 bg-[rgba(26,24,21,0.04)] border border-[rgba(217,185,130,0.2)] rounded-xl">
                      <p className="text-[10px] font-bold text-[#0F3D43] uppercase tracking-widest mb-2">Problem</p>
                      <p className="text-sm text-[#2C2A25] leading-relaxed">{problemText}</p>
                    </div>
                  )}

                  {solutionText && (
                    <div className="mx-5 mb-4 p-4 bg-green-50/50 border border-green-200/30 rounded-xl">
                      <p className="text-[10px] font-bold text-green-700 uppercase tracking-widest mb-3">Solution</p>
                      <div className="space-y-2">
                        {solutionText.split("\n").map((line, li) => {
                          const trimmed = line.trim();
                          if (!trimmed) return <div key={li} className="h-2" />;
                          const isStep = /^(Step \d|Given:|Find:|Formula:|Answer:|Therefore:)/i.test(trimmed);
                          const isCalc = /[=×÷]/.test(trimmed) && /\d/.test(trimmed);

                          if (isStep) return <p key={li} className="text-sm font-semibold text-[#1a1815] mt-1">{trimmed}</p>;
                          if (isCalc) return (
                            <div key={li} className="bg-[#1a1a2e] border border-amber-200/20 rounded-lg px-4 py-2 my-1">
                              <code className="text-[13px] text-green-400 font-mono">{trimmed}</code>
                            </div>
                          );
                          return <p key={li} className="text-sm text-[#2C2A25] leading-relaxed">{trimmed}</p>;
                        })}
                      </div>
                    </div>
                  )}

                  {example.code && (
                    <div className="border-t border-[rgba(217,185,130,0.2)]">
                      <pre className="bg-[#1a1a2e] px-5 py-4 overflow-x-auto">
                        <code className="text-[13px] text-green-400 leading-relaxed font-mono whitespace-pre">
                          {example.code}
                        </code>
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Resources */}
      {learnResult.resources && learnResult.resources.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <ExternalLink className="w-4 h-4 text-[#0F3D43]" />
            <h2 className="text-base font-bold text-[#1a1815]" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>Further Reading</h2>
          </div>
          <div className="space-y-2.5">
            {learnResult.resources.map((resource, i) => (
              <div key={i} className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-xl p-4">
                <h3 className="text-sm font-semibold text-[#1a1815] mb-1">{resource.title}</h3>
                {resource.description && (
                  <p className="text-[13px] text-[#8a7f6f] leading-relaxed mb-2">{resource.description}</p>
                )}
                {resource.url && (
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[#0F3D43] hover:text-[#1a5c64] transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {resource.url.length > 60 ? resource.url.substring(0, 60) + "..." : resource.url}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Need more? prompts */}
      <div className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-xl p-5">
        <p className="text-xs font-bold text-[#8a7f6f] uppercase tracking-widest mb-3">Need more?</p>
        <p className="text-sm text-[#8a7f6f] mb-3">Ask the tutor to expand on anything you need.</p>
        <div className="flex flex-wrap gap-2">
          {[
            "Explain this topic in more depth",
            "Give me more worked examples",
            "Break this down step by step",
            "What are common mistakes here?",
          ].map((chip) => (
            <button
              key={chip}
              onClick={() => onAskTutor(chip)}
              className="text-xs text-[#0a2e33] bg-[#0F3D43]/8 hover:bg-[#0F3D43]/15 border border-[#0F3D43]/20 px-3 py-1.5 rounded-full transition-colors"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Back to cards / notes link */}
      <div className="flex justify-between pt-4 border-t border-[rgba(217,185,130,0.2)]">
        <button
          onClick={onBackToCards}
          className="flex items-center gap-1.5 text-sm font-medium text-[#8a7f6f] hover:text-[#1a1815] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Cards
        </button>
        <Link
          href={`/lecture/${lectureId}`}
          className="flex items-center gap-1.5 text-sm font-medium text-[#0F3D43] hover:text-[#1a5c64] transition-colors"
        >
          Full Notes <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
