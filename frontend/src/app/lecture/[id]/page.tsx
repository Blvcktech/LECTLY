"use client";

import { useState, useEffect, useRef, use } from "react";
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
  MessageCircle,
  Send,
  ChevronDown,
  Code,
} from "lucide-react";
import {
  getLecture,
  explainText,
  downloadNotesPdf,
  askTutor,
  type Lecture,
  type ExplainResult,
  type NoteSection,
  type TutorMessage,
} from "@/lib/api";
import { useToast } from "@/components/Toast";

// ── Tutor message renderer (markdown-aware) ──
function TutorBubble({ content }: { content: string }) {
  const renderInline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) return <strong key={idx} className="font-semibold text-[#1a1815]">{part.slice(2, -2)}</strong>;
      if (part.startsWith("`") && part.endsWith("`")) return <code key={idx} className="px-1 py-0.5 rounded bg-amber-100/60 text-[10px] font-mono text-amber-900">{part.slice(1, -1)}</code>;
      return <span key={idx}>{part}</span>;
    });
  };
  const renderLine = (line: string, key: string) => {
    const t = line.trim();
    if (!t) return null;
    if (/^(Step \d|Given:|Formula:|Answer:|Solution:)/i.test(t)) return <p key={key} className="text-xs leading-relaxed font-semibold text-[#1a1815] mt-1.5 first:mt-0">{renderInline(t)}</p>;
    if (/^[-•*]\s+/.test(t)) return <p key={key} className="text-xs leading-relaxed mb-0.5 flex gap-1.5 pl-0.5"><span className="text-amber-600">•</span><span>{renderInline(t.replace(/^[-•*]\s+/, ""))}</span></p>;
    if (/^\d+[.)]\s+/.test(t)) { const m = t.match(/^(\d+[.)])\s+(.*)/); return m ? <p key={key} className="text-xs leading-relaxed mb-0.5 flex gap-1.5 pl-0.5"><span className="text-purple-600 font-semibold">{m[1]}</span><span>{renderInline(m[2])}</span></p> : null; }
    if (/^---+$/.test(t)) return <hr key={key} className="border-[rgba(217,185,130,0.3)] my-1" />;
    return <p key={key} className="text-xs leading-relaxed text-[#2C2A25]">{renderInline(t)}</p>;
  };
  return (
    <div className="space-y-0.5">
      {content.split(/(```[\s\S]*?```)/g).map((block, bi) => {
        if (block.startsWith("```")) {
          const lines = block.slice(3, -3).split("\n");
          const lang = lines[0]?.trim() || "";
          const code = lang ? lines.slice(1).join("\n") : lines.join("\n");
          return (
            <div key={bi} className="my-1.5 rounded-lg overflow-hidden border border-amber-200/30">
              {lang && <div className="bg-[rgba(26,24,21,0.06)] px-2 py-0.5"><span className="text-[8px] font-bold text-[#8a7f6f] uppercase flex items-center gap-1"><Code className="w-2.5 h-2.5" />{lang}</span></div>}
              <pre className="bg-[#1a1a2e] px-2 py-2 overflow-x-auto"><code className="text-[11px] text-green-400 leading-[1.5] font-mono whitespace-pre">{code.trim()}</code></pre>
            </div>
          );
        }
        const lines = block.split("\n");
        const elements: React.ReactNode[] = [];
        for (let li = 0; li < lines.length; li++) {
          if (!lines[li].trim()) { elements.push(<div key={`${bi}-gap-${li}`} className="h-1" />); continue; }
          const r = renderLine(lines[li], `${bi}-${li}`);
          if (r) elements.push(r);
        }
        return <div key={bi}>{elements}</div>;
      })}
    </div>
  );
}

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
  const { toast } = useToast();

  // Tutor chat state (floating composer)
  const [tutorOpen, setTutorOpen] = useState(false);
  const [tutorMessages, setTutorMessages] = useState<TutorMessage[]>([]);
  const [tutorInput, setTutorInput] = useState("");
  const [tutorLoading, setTutorLoading] = useState(false);
  const tutorEndRef = useRef<HTMLDivElement>(null);
  const tutorInputRef = useRef<HTMLInputElement>(null);

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
      toast("PDF downloaded", "success");
    } catch {
      toast("Failed to download PDF. Please try again.", "error");
    } finally {
      setPdfLoading(false);
    }
  };

  // Scroll tutor chat to bottom when new messages arrive
  useEffect(() => {
    if (tutorEndRef.current) {
      tutorEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [tutorMessages]);

  // Focus tutor input when opened
  useEffect(() => {
    if (tutorOpen && tutorInputRef.current) {
      tutorInputRef.current.focus();
    }
  }, [tutorOpen]);

  const handleTutorSend = async (message?: string) => {
    const text = message || tutorInput.trim();
    if (!text || tutorLoading) return;

    const userMsg: TutorMessage = { role: "user", content: text };
    const updated = [...tutorMessages, userMsg];
    setTutorMessages(updated);
    setTutorInput("");
    setTutorLoading(true);

    try {
      const result = await askTutor(id, text, updated);
      setTutorMessages((prev) => [
        ...prev,
        { role: "tutor", content: result.answer },
      ]);
    } catch {
      setTutorMessages((prev) => [
        ...prev,
        { role: "tutor", content: "Sorry, I couldn't process that. Please try again." },
      ]);
    } finally {
      setTutorLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F4EE]">
        {/* Nav skeleton */}
        <nav className="sticky top-0 z-50 border-b border-[rgba(217,185,130,0.25)] bg-[#FDFCF9]/92 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 bg-[#EDE8DF] rounded" />
              <div className="w-8 h-8 rounded-[10px] bg-[#EDE8DF]" />
              <div className="hidden sm:block w-14 h-4 bg-[#EDE8DF] rounded" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-16 h-9 bg-[#EDE8DF] rounded-[10px]" />
              <div className="w-24 h-9 bg-purple-200/40 rounded-[10px]" />
            </div>
          </div>
        </nav>

        {/* Content skeleton */}
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-pulse">
          {/* Title + summary */}
          <div className="mb-5">
            <div className="h-6 w-72 bg-[#EDE8DF] rounded mb-2" />
            <div className="h-3.5 w-full max-w-lg bg-[#EDE8DF]/60 rounded mb-1.5" />
            <div className="h-3.5 w-64 bg-[#EDE8DF]/60 rounded mb-3" />
            <div className="flex gap-2">
              <div className="h-5 w-16 bg-[#EDE8DF] rounded" />
              <div className="h-5 w-20 bg-[#EDE8DF]/50 rounded" />
            </div>
          </div>

          {/* Tabs skeleton */}
          <div className="flex gap-0 border-b border-[rgba(217,185,130,0.25)] mb-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="px-4 py-2.5">
                <div className="h-4 w-16 bg-[#EDE8DF] rounded" />
              </div>
            ))}
          </div>

          {/* Section cards skeleton */}
          <div className="space-y-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-xl p-4 sm:p-5">
                {/* Heading */}
                <div className="flex items-start justify-between mb-3">
                  <div className="h-5 w-48 bg-[#EDE8DF] rounded" />
                  <div className="h-4 w-16 bg-purple-200/30 rounded-full" />
                </div>
                {/* Content lines */}
                <div className="space-y-2 mb-4">
                  <div className="h-3 w-full bg-[#EDE8DF]/50 rounded" />
                  <div className="h-3 w-full bg-[#EDE8DF]/50 rounded" />
                  <div className="h-3 w-5/6 bg-[#EDE8DF]/50 rounded" />
                  <div className="h-3 w-3/4 bg-[#EDE8DF]/50 rounded" />
                </div>
                {/* Key points skeleton */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-start gap-2.5 px-3 py-2.5 bg-purple-500/[0.03] border-l-[3px] border-purple-200 rounded-r-lg">
                    <div className="h-3 w-3/4 bg-[#EDE8DF]/40 rounded" />
                  </div>
                </div>
                {/* Action buttons skeleton */}
                <div className="flex gap-2 pt-3 border-t border-[rgba(217,185,130,0.2)]">
                  <div className="h-7 w-24 bg-purple-200/30 rounded-lg" />
                  <div className="h-7 w-24 bg-[#EDE8DF] rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (error && !lecture) {
    return (
      <div className="min-h-screen bg-[#F7F4EE] flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-[#1a1815] font-medium mb-2">Error</p>
          <p className="text-[#8a7f6f] text-sm mb-6">{error}</p>
          <Link href="/dashboard" className="text-purple-600 hover:text-purple-700 text-sm">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const notes = lecture?.notes;
  const sections: NoteSection[] = notes?.sections || [];

  return (
    <div className="min-h-screen bg-[#F7F4EE]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-[rgba(217,185,130,0.25)] bg-[#FDFCF9]/92 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link href="/dashboard" className="text-[#8a7f6f] hover:text-[#1a1815] transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-md shadow-purple-500/15">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <span className="hidden sm:inline text-lg font-bold text-[#1a1815] tracking-tight" style={{ fontFamily: "'Georgia', serif" }}>Lectly</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={pdfLoading || !lecture?.notes}
              className="flex items-center gap-1.5 text-xs sm:text-sm text-[#2C2A25] hover:text-[#1a1815] border border-[rgba(217,185,130,0.35)] hover:border-[rgba(217,185,130,0.6)] px-2.5 sm:px-3 py-2 rounded-[10px] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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
              className="flex items-center gap-1.5 text-xs sm:text-sm bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-3 sm:px-4 py-2 rounded-[10px] font-medium transition-all shadow-md shadow-purple-500/15"
            >
              <GraduationCap className="w-4 h-4" />
              <span className="hidden sm:inline">Learn Mode</span>
              <span className="sm:hidden">Learn</span>
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 sm:pb-6">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-xl font-bold text-[#1a1815] mb-1.5" style={{ fontFamily: "'Georgia', serif" }}>
            {notes?.title || lecture?.filename || "Lecture Notes"}
          </h1>
          {notes?.summary && (
            <p className="text-sm text-[#8a7f6f] leading-relaxed max-w-2xl">{notes.summary}</p>
          )}
          <div className="flex items-center gap-3 mt-2.5">
            {lecture?.subject && (
              <span className="text-[11px] font-medium text-[#2C2A25] bg-[#EDE8DF] px-2 py-0.5 rounded border border-[rgba(217,185,130,0.2)]">
                {lecture.subject}
              </span>
            )}
            {lecture?.quality_score && (
              <span className="text-[11px] text-green-700 bg-green-500/8 px-2 py-0.5 rounded">
                {lecture.quality_score}% quality
              </span>
            )}
            <span className="text-[11px] text-[#8a7f6f]">
              {sections.length} sections
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-[rgba(217,185,130,0.25)] mb-6">
          {(["notes", "transcript", "quiz"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 sm:flex-none text-center sm:text-left px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? "text-purple-600 border-purple-500"
                  : "text-[#8a7f6f] border-transparent hover:text-[#2C2A25]"
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
                    className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-xl p-4 sm:p-5 hover:border-[rgba(217,185,130,0.45)] hover:shadow-sm transition-all"
                  >
                    {/* Section Header */}
                    <div className="flex items-start justify-between mb-3">
                      <h2 className="text-base font-semibold text-[#1a1815]" style={{ fontFamily: "'Georgia', serif" }}>
                        {section.heading}
                      </h2>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          section.source_type === "original"
                            ? "bg-purple-500/10 text-purple-700"
                            : "bg-amber-500/10 text-amber-700"
                        }`}
                      >
                        {section.source_type === "original" ? "Original" : "AI Enhanced"}
                      </span>
                    </div>

                    {/* Content */}
                    <p className="text-sm text-[#2C2A25] leading-relaxed mb-4">
                      {section.content}
                    </p>

                    {/* Key Points */}
                    {section.key_points.length > 0 && (
                      <div className="space-y-2 mb-4">
                        {section.key_points.map((point, j) => (
                          <div
                            key={j}
                            className="flex items-start gap-2.5 px-3 py-2.5 bg-purple-500/[0.05] border-l-[3px] border-purple-500 rounded-r-lg"
                          >
                            <span className="text-sm mt-0.5">&#128273;</span>
                            <div>
                              <span className="text-[11px] font-semibold text-purple-700 block mb-0.5">Key Point</span>
                              <span className="text-xs text-[#2C2A25] leading-relaxed">{point}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Definitions */}
                    {section.definitions.length > 0 && (
                      <div className="space-y-2 mb-4">
                        {section.definitions.map((def, j) => (
                          <div
                            key={j}
                            className="px-3 py-2.5 bg-green-500/[0.05] border-l-[3px] border-green-600 rounded-r-lg"
                          >
                            <span className="text-[11px] font-semibold text-green-700 block mb-0.5">
                              Definition: {def.term}
                            </span>
                            <span className="text-xs text-[#2C2A25] leading-relaxed">
                              {def.definition}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[rgba(217,185,130,0.2)]">
                      <button
                        onClick={() => handleExplain(i, section.content)}
                        className="flex items-center gap-1.5 text-xs font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 px-3 py-1.5 rounded-lg transition-all shadow-sm"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {explainSection === i ? "Hide" : "Explain This"}
                      </button>
                      <Link
                        href={`/lecture/${id}/learn?section=${i}`}
                        className="flex items-center gap-1.5 text-xs font-medium text-[#2C2A25] bg-[#EDE8DF] hover:bg-[#e5dfd5] px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <GraduationCap className="w-3.5 h-3.5" />
                        Learn This
                      </Link>
                      <button className="flex items-center gap-1.5 text-xs text-[#8a7f6f] hover:text-[#2C2A25] px-3 py-1.5 rounded-lg border border-[rgba(217,185,130,0.25)] transition-colors">
                        <Flag className="w-3 h-3" />
                        Flag Issue
                      </button>
                    </div>

                    {/* Explain Result */}
                    {explainSection === i && (
                      <div className="mt-4 bg-gradient-to-b from-[#FBF8F1] to-[#F5F0E6] border border-amber-200/40 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-bold text-[#1a1815] flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-amber-600" />
                            Explain This
                          </span>
                          <button
                            onClick={() => {
                              setExplainSection(null);
                              setExplainResult(null);
                            }}
                            className="text-[#8a7f6f] hover:text-[#1a1815] text-xs"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {/* Difficulty selector */}
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
                                  ? "bg-purple-500/10 border-purple-400 text-purple-700"
                                  : "bg-transparent border-[rgba(217,185,130,0.3)] text-[#8a7f6f]"
                              }`}
                            >
                              {level}
                            </button>
                          ))}
                        </div>
                        {explainLoading ? (
                          <div className="flex items-center gap-2 text-sm text-[#2C2A25] py-2">
                            <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                            Generating explanation...
                          </div>
                        ) : explainResult ? (
                          <>
                            <p className="text-xs text-[#2C2A25] leading-relaxed">
                              {explainResult.explanation}
                            </p>
                            {explainResult.analogy && (
                              <p className="text-xs text-[#8a7f6f] mt-2 italic leading-relaxed">
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
                    <FileText className="w-12 h-12 text-[#8a7f6f] mx-auto mb-4" />
                    <p className="text-[#1a1815] font-medium">No notes yet</p>
                    <p className="text-sm text-[#8a7f6f] mt-1">
                      This lecture is still being processed.
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "transcript" && (
              <div className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-xl p-5">
                <p className="text-sm text-[#2C2A25] leading-relaxed whitespace-pre-line">
                  {lecture?.transcript_text || "No transcript available."}
                </p>
              </div>
            )}

            {activeTab === "quiz" && (
              <div className="text-center py-16">
                <GraduationCap className="w-12 h-12 text-[#8a7f6f] mx-auto mb-4" />
                <p className="text-[#1a1815] font-medium">Quiz Mode</p>
                <p className="text-sm text-[#8a7f6f] mt-1 mb-4">
                  Use Learn Mode on any section to generate quiz questions.
                </p>
                <Link
                  href={`/lecture/${id}/learn`}
                  className="inline-block text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white px-5 py-2.5 rounded-[10px] font-medium shadow-md shadow-purple-500/15"
                >
                  Start Learn Mode
                </Link>
              </div>
            )}
          </div>

        </div>
      </main>

      {/* ── Floating Tutor Composer ── */}
      {/* FAB button */}
      {!tutorOpen && (
        <button
          onClick={() => setTutorOpen(true)}
          className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 w-13 h-13 sm:w-14 sm:h-14 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-full shadow-lg shadow-purple-500/25 flex items-center justify-center transition-all hover:scale-105"
          title="Ask Tutor"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Chat panel */}
      {tutorOpen && (
        <div className="fixed bottom-0 left-0 right-0 sm:bottom-6 sm:left-auto sm:right-6 z-50 sm:w-[360px] bg-[#FDFCF9] border-t sm:border border-[rgba(217,185,130,0.35)] sm:rounded-2xl shadow-2xl shadow-black/10 flex flex-col overflow-hidden" style={{ maxHeight: "min(520px, 75vh)" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(217,185,130,0.25)] bg-gradient-to-r from-purple-600 to-blue-600">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-white/80" />
              <span className="text-sm font-semibold text-white">Ask Tutor</span>
            </div>
            <button
              onClick={() => setTutorOpen(false)}
              className="text-white/70 hover:text-white transition-colors"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ minHeight: "200px" }}>
            {tutorMessages.length === 0 && (
              <div className="text-center py-8">
                <MessageCircle className="w-8 h-8 text-[#c4b99a] mx-auto mb-2" />
                <p className="text-xs text-[#8a7f6f]">Ask anything about this lecture</p>
                <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                  {["Summarize this lecture", "What are the key concepts?", "Explain the main topic"].map((chip) => (
                    <button
                      key={chip}
                      onClick={() => handleTutorSend(chip)}
                      className="text-[11px] text-purple-700 bg-purple-500/8 hover:bg-purple-500/15 border border-purple-400/20 px-2.5 py-1 rounded-full transition-colors"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tutorMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-br-md"
                      : "bg-[#EDE8DF] text-[#2C2A25] rounded-bl-md"
                  }`}
                >
                  {msg.role === "tutor" ? <TutorBubble content={msg.content} /> : msg.content}
                </div>
              </div>
            ))}

            {tutorLoading && (
              <div className="flex justify-start">
                <div className="bg-[#EDE8DF] text-[#2C2A25] px-3 py-2 rounded-xl rounded-bl-md text-xs flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin text-purple-500" />
                  Thinking...
                </div>
              </div>
            )}

            <div ref={tutorEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-2.5 border-t border-[rgba(217,185,130,0.25)] bg-[#F7F4EE]">
            <div className="flex items-center gap-2">
              <input
                ref={tutorInputRef}
                type="text"
                value={tutorInput}
                onChange={(e) => setTutorInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleTutorSend(); } }}
                placeholder="Ask about this lecture..."
                className="flex-1 text-xs bg-[#FDFCF9] border border-[rgba(217,185,130,0.35)] rounded-lg px-3 py-2 text-[#1a1815] placeholder:text-[#b5aa94] focus:outline-none focus:border-purple-400 transition-colors"
                disabled={tutorLoading}
              />
              <button
                onClick={() => handleTutorSend()}
                disabled={tutorLoading || !tutorInput.trim()}
                className="w-8 h-8 flex items-center justify-center bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
