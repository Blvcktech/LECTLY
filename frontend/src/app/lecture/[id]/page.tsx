"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  BookOpen,
  ArrowLeft,
  GraduationCap,
  Sparkles,
  Loader2,
  AlertCircle,
  FileText,
  X,
  Flag,
  Download,
} from "lucide-react";
import {
  getLecture,
  explainText,
  downloadNotesPdf,
  type Lecture,
  type ExplainResult,
  type NoteSection,
} from "@/lib/api";

export default function LecturePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"notes" | "transcript" | "quiz">("notes");

  // Explain This state
  const [explainSection, setExplainSection] = useState<number | null>(null);
  const [explainLevel, setExplainLevel] = useState("intermediate");
  const [explainResult, setExplainResult] = useState<ExplainResult | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);

  // PDF Download state
  const [pdfLoading, setPdfLoading] = useState(false);


  useEffect(() => {
    async function fetchLecture() {
      try {
        const data = await getLecture(id);
        setLecture(data);
      } catch {
        setError("Could not load lecture. Make sure the backend is running.");
      } finally {
        setLoading(false);
      }
    }
    fetchLecture();
  }, [id]);

  const handleExplain = async (index: number, content: string) => {
    if (explainSection === index && explainResult) {
      setExplainSection(null);
      setExplainResult(null);
      return;
    }
    setExplainSection(index);
    setExplainLoading(true);
    setExplainResult(null);
    try {
      const result = await explainText(content, explainLevel);
      setExplainResult(result);
    } catch {
      setExplainResult({
        original_text: content,
        explanation: "Could not generate explanation. Check your API key and try again.",
        level: explainLevel,
      });
    } finally {
      setExplainLoading(false);
    }
  };


  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      await downloadNotesPdf(id);
    } catch {
      alert("Failed to download PDF. Please try again.");
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (error && !lecture) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-white font-medium mb-2">Error</p>
          <p className="text-slate-400 text-sm mb-6">{error}</p>
          <Link href="/dashboard" className="text-blue-400 hover:text-blue-300 text-sm">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const notes = lecture?.notes;
  const sections: NoteSection[] = notes?.sections || [];

  return (
    <div className="min-h-screen bg-[#0F172A]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-slate-800/60 bg-[#0F172A]/92 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link href="/dashboard" className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-blue-600 to-green-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <span className="hidden sm:inline text-lg font-bold text-white tracking-tight">Lectly</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={pdfLoading || !lecture?.notes}
              className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 px-2.5 sm:px-3 py-2 rounded-[10px] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {pdfLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">{pdfLoading ? "Generating..." : "PDF"}</span>
            </button>
            <Link
              href={`/lecture/${id}/learn`}
              className="flex items-center gap-1.5 text-xs sm:text-sm bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-3 sm:px-4 py-2 rounded-[10px] font-medium transition-all shadow-md shadow-purple-500/20"
            >
              <GraduationCap className="w-4 h-4" />
              <span className="hidden sm:inline">Learn Mode</span>
              <span className="sm:hidden">Learn</span>
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-xl font-bold text-white mb-1.5">
            {notes?.title || lecture?.filename || "Lecture Notes"}
          </h1>
          {notes?.summary && (
            <p className="text-sm text-slate-400 leading-relaxed max-w-2xl">{notes.summary}</p>
          )}
          <div className="flex items-center gap-3 mt-2.5">
            {lecture?.subject && (
              <span className="text-[11px] font-medium text-slate-300 bg-slate-700/50 px-2 py-0.5 rounded">
                {lecture.subject}
              </span>
            )}
            {lecture?.quality_score && (
              <span className="text-[11px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded">
                {lecture.quality_score}% quality
              </span>
            )}
            <span className="text-[11px] text-slate-500">
              {sections.length} sections
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-slate-800/60 mb-6">
          {(["notes", "transcript", "quiz"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 sm:flex-none text-center sm:text-left px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? "text-blue-400 border-blue-500"
                  : "text-slate-500 border-transparent hover:text-slate-300"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex gap-6">
          {/* Notes Column */}
          <div className="flex-1 min-w-0">
            {activeTab === "notes" && (
              <div className="space-y-5">
                {sections.map((section, i) => (
                  <div
                    key={i}
                    className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4 sm:p-5 hover:border-slate-600 transition-all"
                  >
                    {/* Section Header */}
                    <div className="flex items-start justify-between mb-3">
                      <h2 className="text-base font-semibold text-white">
                        {section.heading}
                      </h2>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          section.source_type === "original"
                            ? "bg-blue-500/15 text-blue-300"
                            : "bg-yellow-500/15 text-yellow-300"
                        }`}
                      >
                        {section.source_type === "original" ? "Original" : "AI Enhanced"}
                      </span>
                    </div>

                    {/* Content */}
                    <p className="text-sm text-slate-300/90 leading-relaxed mb-4">
                      {section.content}
                    </p>

                    {/* Key Points — blue left border */}
                    {section.key_points.length > 0 && (
                      <div className="space-y-2 mb-4">
                        {section.key_points.map((point, j) => (
                          <div
                            key={j}
                            className="flex items-start gap-2.5 px-3 py-2.5 bg-blue-500/[0.06] border-l-[3px] border-blue-500 rounded-r-lg"
                          >
                            <span className="text-sm mt-0.5">&#128273;</span>
                            <div>
                              <span className="text-[11px] font-semibold text-blue-400 block mb-0.5">Key Point</span>
                              <span className="text-xs text-slate-300 leading-relaxed">{point}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Definitions — green left border */}
                    {section.definitions.length > 0 && (
                      <div className="space-y-2 mb-4">
                        {section.definitions.map((def, j) => (
                          <div
                            key={j}
                            className="px-3 py-2.5 bg-green-500/[0.06] border-l-[3px] border-green-500 rounded-r-lg"
                          >
                            <span className="text-[11px] font-semibold text-green-400 block mb-0.5">
                              Definition: {def.term}
                            </span>
                            <span className="text-xs text-slate-300 leading-relaxed">
                              {def.definition}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-700/40">
                      <button
                        onClick={() => handleExplain(i, section.content)}
                        className="flex items-center gap-1.5 text-xs font-medium text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 px-3 py-1.5 rounded-lg transition-all shadow-sm"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {explainSection === i ? "Hide" : "Explain This"}
                      </button>
                      <Link
                        href={`/lecture/${id}/learn?section=${i}`}
                        className="flex items-center gap-1.5 text-xs font-medium text-slate-300 bg-slate-700/50 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <GraduationCap className="w-3.5 h-3.5" />
                        Learn This
                      </Link>
                      <button className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700/40 transition-colors">
                        <Flag className="w-3 h-3" />
                        Flag Issue
                      </button>
                    </div>

                    {/* Explain Result — popup card style */}
                    {explainSection === i && (
                      <div className="mt-4 bg-slate-800 border border-slate-700/60 rounded-xl p-4 shadow-lg shadow-black/20">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-bold text-white flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-yellow-400" />
                            Explain This
                          </span>
                          <button
                            onClick={() => {
                              setExplainSection(null);
                              setExplainResult(null);
                            }}
                            className="text-slate-500 hover:text-white text-xs"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {/* Difficulty selector — pill buttons */}
                        <div className="flex gap-1.5 mb-3">
                          {["beginner", "intermediate", "advanced"].map((level) => (
                            <button
                              key={level}
                              onClick={() => {
                                setExplainLevel(level);
                                handleExplain(i, section.content);
                              }}
                              className={`text-[11px] font-semibold px-3 py-1 rounded-lg border transition-colors capitalize ${
                                explainLevel === level
                                  ? "bg-blue-500/15 border-blue-500 text-blue-400"
                                  : "bg-transparent border-slate-700 text-slate-400"
                              }`}
                            >
                              {level}
                            </button>
                          ))}
                        </div>
                        {explainLoading ? (
                          <div className="flex items-center gap-2 text-sm text-slate-300 py-2">
                            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                            Generating explanation...
                          </div>
                        ) : explainResult ? (
                          <>
                            <p className="text-xs text-slate-200 leading-relaxed">
                              {explainResult.explanation}
                            </p>
                            {explainResult.analogy && (
                              <p className="text-xs text-slate-400 mt-2 italic leading-relaxed">
                                Analogy: {explainResult.analogy}
                              </p>
                            )}
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>
                ))}

                {sections.length === 0 && (
                  <div className="text-center py-16">
                    <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-white font-medium">No notes yet</p>
                    <p className="text-sm text-slate-400 mt-1">
                      This lecture is still being processed.
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "transcript" && (
              <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-5">
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                  {lecture?.transcript_text || "No transcript available."}
                </p>
              </div>
            )}

            {activeTab === "quiz" && (
              <div className="text-center py-16">
                <GraduationCap className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-white font-medium">Quiz Mode</p>
                <p className="text-sm text-slate-400 mt-1 mb-4">
                  Use Learn Mode on any section to generate quiz questions.
                </p>
                <Link
                  href={`/lecture/${id}/learn`}
                  className="inline-block text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white px-5 py-2.5 rounded-[10px] font-medium shadow-md shadow-purple-500/20"
                >
                  Start Learn Mode
                </Link>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
