"use client";

import { BookOpen, ChevronRight, Loader2 } from "lucide-react";
import type { NoteSection, StudyProgress } from "@/lib/api";

interface SectionSidebarProps {
  sections: NoteSection[];
  selectedSection: number | null;
  learnLevel: string;
  learnLoading: boolean;
  onSelectLevel: (level: string) => void;
  onStartLearn: (sectionIndex: number) => void;
  getProgressForSection: (idx: number) => StudyProgress | undefined;
}

export function SectionSidebar({
  sections,
  selectedSection,
  learnLevel,
  learnLoading,
  onSelectLevel,
  onStartLearn,
  getProgressForSection,
}: SectionSidebarProps) {
  return (
    <div className="w-72 flex-shrink-0 hidden lg:block">
      <div className="sticky top-20">
        <h2 className="text-[11px] font-bold text-ink-m uppercase tracking-wider mb-3">
          Topics
        </h2>

        {/* Level selector */}
        <div className="flex gap-1 mb-4 bg-cream-d rounded-xl p-1">
          {["beginner", "intermediate", "advanced"].map((level) => (
            <button
              key={level}
              onClick={() => onSelectLevel(level)}
              disabled={learnLoading}
              className={`flex-1 text-[11px] font-semibold py-2 rounded-lg transition-all capitalize ${
                learnLevel === level
                  ? "bg-ink text-white shadow-md"
                  : "text-ink-m hover:text-ink"
              } ${learnLoading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {level}
            </button>
          ))}
        </div>

        {/* Section list */}
        <div className="space-y-1.5">
          {sections.map((section, i) => {
            const sectionProgress = getProgressForSection(i);
            return (
              <button
                key={i}
                onClick={() => onStartLearn(i)}
                disabled={learnLoading}
                className={`w-full text-left p-3 rounded-xl border transition-all group ${
                  selectedSection === i
                    ? "bg-paper border-ink/20 shadow-sm"
                    : "bg-transparent border-transparent hover:bg-paper hover:border-[rgba(217,185,130,0.25)]"
                } ${learnLoading ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${
                    selectedSection === i ? "text-ink" : "text-ink-l group-hover:text-ink"
                  }`}>
                    {section.heading}
                  </span>
                  {learnLoading && selectedSection === i ? (
                    <Loader2 className="w-4 h-4 text-ink-m animate-spin flex-shrink-0" />
                  ) : (
                    <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${
                      selectedSection === i ? "text-ink" : "text-ink-m sm:opacity-0 sm:group-hover:opacity-100"
                    } transition-opacity`} />
                  )}
                </div>
                {sectionProgress && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 h-1 bg-cream-d rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${sectionProgress.mastery_pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-ink-m">
                      {sectionProgress.mastery_pct}%
                    </span>
                  </div>
                )}
              </button>
            );
          })}

          {/* Full lecture option */}
          <button
            onClick={() => onStartLearn(-1)}
            disabled={learnLoading}
            className={`w-full text-left p-3 rounded-xl border transition-all group ${
              selectedSection === -1
                ? "bg-paper border-ink/20 shadow-sm"
                : "bg-transparent border-transparent hover:bg-paper hover:border-[rgba(217,185,130,0.25)]"
            } ${learnLoading ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-sm font-medium ${
                selectedSection === -1 ? "text-ink" : "text-ink-l"
              }`}>
                Full Lecture Overview
              </span>
              <BookOpen className="w-3.5 h-3.5 text-ink-m" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
