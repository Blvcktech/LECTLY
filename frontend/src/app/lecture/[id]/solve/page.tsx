"use client";

import { useState, useEffect, use } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Target,
  Zap,
  BookOpen,
} from "lucide-react";
import {
  getLecture,
  solveMode,
  type Lecture,
  type SolveResult,
  type NoteSection,
} from "@/lib/api";
import { useAuth } from "@clerk/nextjs";
import { setAuthToken } from "@/lib/auth";

// Re-use Learn Mode's markdown components — single source of truth
import { RenderBody, RenderInline } from "../learn/components/markdown";


export default function SolveModePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: lectureId } = use(params);
  const searchParams = useSearchParams();
  const { getToken, isLoaded: authLoaded } = useAuth();
  const sectionParam = searchParams.get("section");
  const sectionIndex = sectionParam !== null ? parseInt(sectionParam, 10) : undefined;

  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Solve state
  const [problem, setProblem] = useState("");
  const [studentAttempt, setStudentAttempt] = useState("");
  const [showAttempt, setShowAttempt] = useState(false);
  const [solving, setSolving] = useState(false);
  const [solution, setSolution] = useState<SolveResult | null>(null);
  const [solveError, setSolveError] = useState("");
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  // Progressive reveal — tracks how many steps the student has unlocked
  const [revealedUpTo, setRevealedUpTo] = useState(0);

  // Load lecture with fresh auth token
  useEffect(() => {
    if (!authLoaded) return;

    async function load() {
      try {
        const token = await getToken();
        setAuthToken(token);
        const data = await getLecture(lectureId);
        setLecture(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load lecture");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [lectureId, authLoaded, getToken]);

  // Get section info
  const sections: NoteSection[] = lecture?.notes?.sections || [];
  const currentSection = sectionIndex !== undefined ? sections[sectionIndex] : null;

  async function handleSolve() {
    if (!problem.trim()) return;
    setSolving(true);
    setSolveError("");
    setSolution(null);
    setRevealedUpTo(0);

    try {
      // Fresh auth token before expensive LLM call
      const token = await getToken();
      setAuthToken(token);

      const result = await solveMode(
        lectureId,
        problem.trim(),
        sectionIndex,
        studentAttempt.trim() || undefined
      );
      setSolution(result);
      // Progressive reveal: start with only step 1 expanded
      setExpandedSteps(new Set([0]));
      setRevealedUpTo(0);
    } catch (err) {
      setSolveError(err instanceof Error ? err.message : "Failed to solve");
    } finally {
      setSolving(false);
    }
  }

  function toggleStep(index: number) {
    const next = new Set(expandedSteps);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setExpandedSteps(next);
  }

  // ── Loading State (skeleton) ──
  if (loading || !authLoaded) {
    return (
      <div className="min-h-screen bg-[#F7F4EE]">
        <header className="sticky top-0 z-50 bg-[#FDFCF9]/90 backdrop-blur-md border-b border-[rgba(217,185,130,0.2)]">
          <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            <div className="w-20 h-5 bg-[#EDE8DF] rounded" />
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-[#EDE8DF] rounded" />
              <div className="w-24 h-5 bg-[#EDE8DF] rounded" />
            </div>
            <div className="w-20" />
          </div>
        </header>
        <main className="max-w-[900px] mx-auto px-4 sm:px-6 py-8 animate-pulse">
          <div className="h-8 w-3/4 bg-[#EDE8DF] rounded mb-3" />
          <div className="h-4 w-1/2 bg-[#EDE8DF]/60 rounded mb-6" />
          <div className="h-36 w-full bg-[#EDE8DF]/40 rounded-xl mb-4" />
          <div className="h-12 w-40 bg-[#EDE8DF] rounded-xl" />
        </main>
      </div>
    );
  }

  // ── Error State ──
  if (error) {
    return (
      <div className="min-h-screen bg-[#F7F4EE] flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-[#1a1815] font-semibold mb-2">Something went wrong</p>
          <p className="text-sm text-[#8a7f6f] mb-4">{error}</p>
          <Link
            href={`/lecture/${lectureId}`}
            className="text-sm text-[#0F3D43] hover:underline"
          >
            Back to lecture
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F4EE]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#FDFCF9]/90 backdrop-blur-md border-b border-[rgba(217,185,130,0.2)]">
        <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link
            href={`/lecture/${lectureId}`}
            className="flex items-center gap-2 text-[#8a7f6f] hover:text-[#1a1815] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">Back to Notes</span>
          </Link>
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-[#0F3D43]" />
            <span className="text-sm font-bold text-[#1a1815]">Solve Mode</span>
          </div>
          <div className="w-20" />
        </div>
      </header>

      <main className="max-w-[900px] mx-auto px-4 sm:px-6 py-8">
        {/* Section Context */}
        {currentSection && (
          <div className="mb-6 px-4 py-3 bg-[#0F3D43]/5 border border-[#0F3D43]/20/30 rounded-xl">
            <p className="text-xs font-bold uppercase tracking-wider text-[#0F3D43] mb-1">
              Solving from
            </p>
            <p className="text-sm font-semibold text-[#1a1815]">
              {currentSection.heading}
            </p>
          </div>
        )}

        {/* Problem Input */}
        {!solution && (
          <div className="space-y-4">
            <div>
              <h1
                className="text-2xl font-extrabold text-[#1a1815] mb-2"
                style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}
              >
                What problem do you want to solve?
              </h1>
              <p className="text-sm text-[#8a7f6f]">
                Type or paste a problem from your lecture, textbook, or assignment.
                I&apos;ll walk you through it step by step.
              </p>
            </div>

            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="e.g. Calculate the moment of inertia of a solid cylinder rotating about its central axis..."
              className="w-full h-36 px-4 py-3 rounded-xl border border-[rgba(217,185,130,0.3)] bg-white text-sm text-[#1a1815] placeholder:text-[#b5ad9e] focus:outline-none focus:ring-2 focus:ring-[#0F3D43]/20 focus:border-transparent resize-none"
            />

            {/* Optional: Student attempt */}
            <div>
              <button
                onClick={() => setShowAttempt(!showAttempt)}
                className="flex items-center gap-2 text-xs font-medium text-[#8a7f6f] hover:text-[#1a1815] transition-colors"
              >
                {showAttempt ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
                I already tried — find where I went wrong
              </button>
              {showAttempt && (
                <textarea
                  value={studentAttempt}
                  onChange={(e) => setStudentAttempt(e.target.value)}
                  placeholder="Paste your attempt here and I'll identify where you went wrong..."
                  className="mt-2 w-full h-28 px-4 py-3 rounded-xl border border-[rgba(217,185,130,0.3)] bg-white text-sm text-[#1a1815] placeholder:text-[#b5ad9e] focus:outline-none focus:ring-2 focus:ring-[#0F3D43]/20 focus:border-transparent resize-none"
                />
              )}
            </div>

            {solveError && (
              <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200/50 rounded-xl">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{solveError}</p>
              </div>
            )}

            <button
              onClick={handleSolve}
              disabled={!problem.trim() || solving}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-[#1a1815] text-[#F7F4EE] rounded-xl text-sm font-semibold hover:bg-[#2a2825] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {solving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Solving...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Solve it
                </>
              )}
            </button>
          </div>
        )}

        {/* Solving Animation */}
        {solving && (
          <div className="mt-8 flex flex-col items-center justify-center py-16">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-[#0F3D43]/20 border-t-[#0F3D43] animate-spin" />
              <Target className="w-6 h-6 text-[#0F3D43] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <p className="mt-4 text-sm font-semibold text-[#1a1815]">
              Working through the problem...
            </p>
            <p className="mt-1 text-xs text-[#8a7f6f]">
              Breaking it down step by step
            </p>
          </div>
        )}

        {/* Solution Display */}
        {solution && !solving && (
          <div className="space-y-6">
            {/* New Problem Button */}
            <div className="flex items-center justify-between">
              <h2
                className="text-xl font-extrabold text-[#1a1815]"
                style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}
              >
                Solution
              </h2>
              <button
                onClick={() => {
                  setSolution(null);
                  setProblem("");
                  setStudentAttempt("");
                  setSolveError("");
                }}
                className="text-sm font-medium text-[#0F3D43] hover:text-[#0a2e33] transition-colors"
              >
                Solve another problem
              </button>
            </div>

            {/* Problem Restatement */}
            <div className="bg-white rounded-2xl border border-[rgba(217,185,130,0.2)] p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-[#0F3D43]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F3D43]">
                  Problem
                </h3>
              </div>
              <div className="text-sm text-[#2C2A25] leading-relaxed">
                <RenderBody text={solution.problem_restatement} />
              </div>

              {/* Given & Find */}
              {(solution.given.length > 0 || solution.find) && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {solution.given.length > 0 && (
                    <div className="bg-[#F7F4EE] rounded-xl px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#8a7f6f] mb-2">
                        Given
                      </p>
                      {solution.given.map((g, i) => (
                        <p key={i} className="text-sm text-[#2C2A25]">
                          <RenderInline text={g} />
                        </p>
                      ))}
                    </div>
                  )}
                  {solution.find && (
                    <div className="bg-[#F7F4EE] rounded-xl px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#8a7f6f] mb-2">
                        Find
                      </p>
                      <p className="text-sm text-[#2C2A25]">
                        <RenderInline text={solution.find} />
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Concept */}
              {solution.concept && (
                <div className="mt-3 flex items-start gap-2 px-3 py-2 bg-[#0F3D43]/5 rounded-lg">
                  <Lightbulb className="w-4 h-4 text-[#0F3D43] mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-[#0a2e33]">
                    <RenderInline text={solution.concept} />
                  </p>
                </div>
              )}
            </div>

            {/* Steps — Progressive Reveal */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#8a7f6f]">
                  Step-by-Step Solution
                </h3>
                {revealedUpTo < solution.steps.length - 1 && (
                  <span className="text-[10px] font-medium text-[#8a7f6f]">
                    Step {revealedUpTo + 1} of {solution.steps.length}
                  </span>
                )}
              </div>
              {solution.steps.map((step, idx) => {
                // Only show steps up to what the student has revealed
                const isRevealed = idx <= revealedUpTo;
                const isLocked = idx > revealedUpTo;

                if (isLocked) return null;

                return (
                  <div
                    key={idx}
                    className="bg-white rounded-2xl border border-[rgba(217,185,130,0.2)] shadow-sm overflow-hidden"
                    style={idx === revealedUpTo && idx > 0 ? { animation: "fadeSlideIn 0.3s ease-out" } : undefined}
                  >
                    <button
                      onClick={() => toggleStep(idx)}
                      className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[#F7F4EE]/50 transition-colors text-left"
                    >
                      <div className="w-7 h-7 rounded-full bg-[#0F3D43] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {step.step_number}
                      </div>
                      <span className="text-sm font-semibold text-[#1a1815] flex-1">
                        {step.title}
                      </span>
                      {expandedSteps.has(idx) ? (
                        <ChevronUp className="w-4 h-4 text-[#8a7f6f]" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[#8a7f6f]" />
                      )}
                    </button>
                    {expandedSteps.has(idx) && (
                      <div className="px-5 pb-5 border-t border-[rgba(217,185,130,0.1)]">
                        <div className="pt-4 text-sm text-[#2C2A25] leading-relaxed">
                          <RenderBody text={step.content} />
                        </div>
                        {step.key_insight && (
                          <div className="mt-3 flex items-start gap-2 px-3 py-2 bg-amber-50/60 border border-amber-200/30 rounded-lg">
                            <Lightbulb className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-amber-800">
                              <RenderInline text={step.key_insight} />
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* "Show next step" / "Show all" buttons */}
              {revealedUpTo < solution.steps.length - 1 && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      const next = revealedUpTo + 1;
                      setRevealedUpTo(next);
                      setExpandedSteps((prev) => new Set([...prev, next]));
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#1a1815] text-white rounded-xl text-sm font-semibold hover:bg-[#2a2825] active:scale-95 transition-all"
                  >
                    Show next step
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      const allIdxs = solution.steps.map((_, i) => i);
                      setRevealedUpTo(solution.steps.length - 1);
                      setExpandedSteps(new Set(allIdxs));
                    }}
                    className="text-sm font-medium text-[#8a7f6f] hover:text-[#1a1815] transition-colors"
                  >
                    Show all steps
                  </button>
                </div>
              )}
            </div>

            {/* Answer — only show after all steps are revealed */}
            {revealedUpTo >= solution.steps.length - 1 && (
              <div
                className="bg-[#0F3D43]/5 rounded-2xl border border-[#0F3D43]/15 p-5"
                style={{ animation: "fadeSlideIn 0.3s ease-out" }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-5 h-5 text-[#0F3D43]" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#0a2e33]">
                    Answer
                  </h3>
                </div>
                <div className="text-[15px] font-semibold text-[#1a1815] leading-relaxed">
                  <RenderBody text={solution.answer} />
                </div>
              </div>
            )}

            {/* Post-answer sections — only visible after all steps revealed */}
            {revealedUpTo >= solution.steps.length - 1 && (
              <>
                {/* Verification */}
                {solution.verification && (
                  <div className="bg-white rounded-2xl border border-[rgba(217,185,130,0.2)] p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-green-700">
                        Verification
                      </h3>
                    </div>
                    <div className="text-sm text-[#2C2A25] leading-relaxed">
                      <RenderBody text={solution.verification} />
                    </div>
                  </div>
                )}

                {/* Common Mistakes */}
                {solution.common_mistakes.length > 0 && (
                  <div className="bg-white rounded-2xl border border-[rgba(217,185,130,0.2)] p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-orange-600">
                        Common Mistakes to Avoid
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {solution.common_mistakes.map((mistake, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-orange-400 mt-0.5 flex-shrink-0">•</span>
                          <p className="text-sm text-[#2C2A25]">
                            <RenderInline text={mistake} />
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lecture Connection */}
                {solution.lecture_connection && (
                  <div className="bg-white rounded-2xl border border-[rgba(217,185,130,0.2)] p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <BookOpen className="w-4 h-4 text-[#0F3D43]" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F3D43]">
                        Connection to Your Lecture
                      </h3>
                    </div>
                    <div className="text-sm text-[#2C2A25] leading-relaxed">
                      <RenderBody text={solution.lecture_connection} />
                    </div>
                  </div>
                )}

                {/* Follow-up */}
                {solution.follow_up && (
                  <div className="bg-[#F7F4EE] rounded-2xl border border-[rgba(217,185,130,0.2)] p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4 text-[#0F3D43]" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F3D43]">
                        Try This Next
                      </h3>
                    </div>
                    <p className="text-sm text-[#2C2A25] leading-relaxed mb-3">
                      <RenderInline text={solution.follow_up} />
                    </p>
                    <button
                      onClick={() => {
                        setProblem(solution.follow_up);
                        setSolution(null);
                        setStudentAttempt("");
                        setSolveError("");
                        setRevealedUpTo(0);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-[#0F3D43] text-white rounded-lg text-sm font-medium hover:bg-[#1a5c64] transition-colors"
                    >
                      <Target className="w-3.5 h-3.5" />
                      Solve this one
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
