"use client";

import React, { useRef, useEffect } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import type { NoteSection, StudyProgress } from "@/lib/api";

interface MobileTopicPillsProps {
  sections: NoteSection[];
  selectedSection: number | null;
  learnLevel: string;
  learnLoading: boolean;
  onSelectLevel: (level: string) => void;
  onStartLearn: (sectionIndex: number) => void;
  getProgressForSection: (idx: number) => StudyProgress | undefined;
}

export const MobileTopicPills = React.memo(function MobileTopicPills({
  sections,
  selectedSection,
  learnLevel,
  learnLoading,
  onSelectLevel,
  onStartLearn,
  getProgressForSection,
}: MobileTopicPillsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll the selected pill into view
  useEffect(() => {
    if (selectedRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const pill = selectedRef.current;
      const scrollLeft = pill.offsetLeft - container.offsetWidth / 2 + pill.offsetWidth / 2;
      container.scrollTo({ left: Math.max(0, scrollLeft), behavior: "smooth" });
    }
  }, [selectedSection]);

  // Truncate long headings for pills
  const truncate = (text: string, max: number) =>
    text.length > max ? text.substring(0, max).trim() + "..." : text;

  return (
    <div className="lg:hidden mb-4">
      {/* Difficulty toggle */}
      <div className="flex gap-1 bg-[#EDE8DF] rounded-xl p-1 mb-3">
        {["beginner", "intermediate", "advanced"].map((level) => (
          <button
            key={level}
            onClick={() => onSelectLevel(level)}
            disabled={learnLoading}
            className={`flex-1 text-[11px] font-semibold py-2 rounded-lg transition-all capitalize ${
              learnLevel === level
                ? "bg-[#1a1815] text-white shadow-md"
                : "text-[#8a7f6f] hover:text-[#1a1815]"
            }`}
          >
            {level}
          </button>
        ))}
      </div>

      {/* Scrollable topic pills */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1"
      >
        {sections.map((section, i) => {
          const isSelected = selectedSection === i;
          const progress = getProgressForSection(i);
          const isLoading = learnLoading && isSelected;

          return (
            <button
              key={i}
              ref={isSelected ? selectedRef : undefined}
              onClick={() => onStartLearn(i)}
              disabled={learnLoading}
              className={`flex-shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-medium transition-all whitespace-nowrap disabled:opacity-60 ${
                isSelected
                  ? "bg-[#1a1815] text-white shadow-sm"
                  : progress && progress.mastery_pct > 0
                  ? "bg-[#FDFCF9] border border-[rgba(217,185,130,0.35)] text-[#1a1815]"
                  : "bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] text-[#8a7f6f]"
              }`}
            >
              {isLoading && (
                <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
              )}
              {truncate(section.heading, 22)}
              {progress && progress.mastery_pct > 0 && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    isSelected
                      ? "bg-white/20 text-white"
                      : progress.mastery_pct >= 80
                      ? "bg-green-100 text-green-700"
                      : "bg-[#EDE8DF] text-[#8a7f6f]"
                  }`}
                >
                  {progress.mastery_pct}%
                </span>
              )}
            </button>
          );
        })}

        {/* Full Lecture Overview pill */}
        <button
          ref={selectedSection === -1 ? selectedRef : undefined}
          onClick={() => onStartLearn(-1)}
          disabled={learnLoading}
          className={`flex-shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-medium transition-all whitespace-nowrap disabled:opacity-60 ${
            selectedSection === -1
              ? "bg-[#1a1815] text-white shadow-sm"
              : "bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] text-[#8a7f6f]"
          }`}
        >
          {learnLoading && selectedSection === -1 && (
            <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
          )}
          <BookOpen className="w-3 h-3 flex-shrink-0" />
          Full Overview
        </button>
      </div>
    </div>
  );
});
