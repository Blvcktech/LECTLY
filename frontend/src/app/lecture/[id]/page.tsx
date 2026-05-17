"use client";

import { useState, useEffect, useRef, use, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  GraduationCap,
  Sparkles,
  Loader2,
  AlertCircle,
  FileText,
  X,
  Trash2,
  Pencil,
  Check,
  Download,
  MessageCircle,
  Send,
  ChevronDown,
  Code,
  RotateCcw,
  WifiOff,
  Zap,
} from "lucide-react";
import {
  getLecture,
  explainText,
  downloadNotesPdf,
  askTutor,
  getLectureProgress,
  renameLecture,
  deleteLecture,
  type Lecture,
  type ExplainResult,
  type NoteSection,
  type TutorMessage,
  type StudyProgress,
} from "@/lib/api";
import { useAuth } from "@clerk/nextjs";
import { setAuthToken } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import StratumLogo from "@/components/StratumLogo";

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
    if (/^\d+[.)]\s+/.test(t)) { const m = t.match(/^(\d+[.)])\s+(.*)/); return m ? <p key={key} className="text-xs leading-relaxed mb-0.5 flex gap-1.5 pl-0.5"><span className="text-[#0F3D43] font-semibold">{m[1]}</span><span>{renderInline(m[2])}</span></p> : null; }
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

// ── Flashcard component ──
function FlashCard({ front, back, type }: { front: string; back: string; type: "definition" | "key_point" }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      onClick={() => setFlipped(!flipped)}
      className="w-full text-left bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-xl p-5 hover:border-[rgba(217,185,130,0.45)] hover:shadow-sm transition-all cursor-pointer group"
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
          type === "definition" ? "bg-green-500/10 text-green-700" : "bg-[#0F3D43]/10 text-[#0a2e33]"
        }`}>
          {type === "definition" ? "Definition" : "Key Concept"}
        </span>
        <span className="text-[10px] text-[#8a7f6f] group-hover:text-[#2C2A25] transition-colors">
          {flipped ? "showing answer" : "tap to reveal"}
        </span>
      </div>
      <p className="text-sm font-semibold text-[#1a1815] mb-2" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
        {front}
      </p>
      {flipped && (
        <div className="pt-3 border-t border-[rgba(217,185,130,0.2)]">
          <p className="text-sm text-[#2C2A25] leading-relaxed">{back}</p>
        </div>
      )}
    </button>
  );
}

export default function LecturePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { getToken, isLoaded: authLoaded } = useAuth();
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"notes" | "transcript" | "flashcards">("notes");

  // Rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Delete state
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Explain This state
  const [explainSection, setExplainSection] = useState<number | null>(null);
  const [explainLevel, setExplainLevel] = useState("intermediate");
  const [explainResult, setExplainResult] = useState<ExplainResult | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);

  // Section refs for scroll tracking
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeSection, setActiveSection] = useState(0);

  // Study progress
  const [studyProgress, setStudyProgress] = useState<StudyProgress[]>([]);

  // PDF Download state
  const [pdfLoading, setPdfLoading] = useState(false);
  const { toast, confirm: showConfirm } = useToast();

  // Tutor chat state (floating composer)
  const [tutorOpen, setTutorOpen] = useState(false);
  const [tutorMessages, setTutorMessages] = useState<TutorMessage[]>([]);
  const [tutorInput, setTutorInput] = useState("");
  const [tutorLoading, setTutorLoading] = useState(false);
  const tutorEndRef = useRef<HTMLDivElement>(null);
  const tutorInputRef = useRef<HTMLInputElement>(null);

  const notes = lecture?.notes;
  const sections: NoteSection[] = notes?.sections || [];

  // Build flashcards from definitions + key points
  const flashcards = useMemo(() => {
    const cards: { front: string; back: string; type: "definition" | "key_point"; section: string }[] = [];
    sections.forEach((section) => {
      section.definitions.forEach((def) => {
        cards.push({ front: def.term, back: def.definition, type: "definition", section: section.heading });
      });
      section.key_points.forEach((point) => {
        // Use first ~8 words as "front", full text as back
        const words = point.split(" ");
        const front = words.length > 8 ? words.slice(0, 8).join(" ") + "..." : point;
        cards.push({ front, back: point, type: "key_point", section: section.heading });
      });
    });
    return cards;
  }, [sections]);

  // Compute aggregate study stats
  const studyStats = useMemo(() => {
    if (studyProgress.length === 0) return null;
    const totalCards = studyProgress.reduce((sum, p) => sum + p.total_cards, 0);
    const completedCards = studyProgress.reduce((sum, p) => sum + p.completed_cards, 0);
    const avgMastery = totalCards > 0 ? Math.round(studyProgress.reduce((sum, p) => sum + p.mastery_pct * p.total_cards, 0) / totalCards) : 0;
    const lastStudied = studyProgress.reduce((latest, p) => {
      if (!p.last_studied_at) return latest;
      return !latest || new Date(p.last_studied_at) > new Date(latest) ? p.last_studied_at : latest;
    }, "" as string);

    // Per-section completion map
    const sectionDone = new Map<number, boolean>();
    studyProgress.forEach((p) => {
      sectionDone.set(p.section_index, p.completed_cards >= p.total_cards && p.total_cards > 0);
    });

    return { totalCards, completedCards, avgMastery, lastStudied, sectionDone };
  }, [studyProgress]);

  // Track active section via scroll
  useEffect(() => {
    if (sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = sectionRefs.current.indexOf(entry.target as HTMLDivElement);
            if (idx !== -1) setActiveSection(idx);
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0.1 }
    );
    sectionRefs.current.forEach((ref) => { if (ref) observer.observe(ref); });
    return () => observer.disconnect();
  }, [sections.length]);

  useEffect(() => {
    if (!authLoaded) return;

    async function fetchLecture() {
      try {
        const token = await getToken();
        setAuthToken(token);
        const data = await getLecture(id);
        setLecture(data);
      } catch {
        setError("Could not load lecture. Make sure the backend is running.");
      } finally {
        setLoading(false);
      }
    }
    fetchLecture();
  }, [id, authLoaded]);

  // Fetch study progress
  useEffect(() => {
    if (!authLoaded) return;

    async function fetchProgress() {
      try {
        const token = await getToken();
        setAuthToken(token);
        const data = await getLectureProgress(id);
        setStudyProgress(data.progress || []);
      } catch {
        // Silently fail — progress is optional
      }
    }
    fetchProgress();
  }, [id, authLoaded]);

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

  // Rename handlers
  const startRename = () => {
    setRenameValue(notes?.title || lecture?.filename || "");
    setIsRenaming(true);
    setTimeout(() => renameInputRef.current?.focus(), 50);
  };

  const handleRename = async () => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === (notes?.title || lecture?.filename)) {
      setIsRenaming(false);
      return;
    }
    setRenameLoading(true);
    try {
      await renameLecture(id, trimmed);
      // Update local state
      setLecture((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          notes: prev.notes ? { ...prev.notes, title: trimmed } : prev.notes,
        };
      });
      toast("Title updated", "success");
    } catch {
      toast("Failed to rename. Please try again.", "error");
    } finally {
      setRenameLoading(false);
      setIsRenaming(false);
    }
  };

  // Delete handler
  const handleDelete = () => {
    const title = notes?.title || lecture?.filename || "this lecture";
    showConfirm(`Delete "${title}"? This cannot be undone.`, async () => {
      setDeleteLoading(true);
      try {
        await deleteLecture(id);
        toast("Lecture deleted", "success");
        router.push("/dashboard");
      } catch {
        toast("Failed to delete. Please try again.", "error");
        setDeleteLoading(false);
      }
    });
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

  const scrollToSection = (index: number) => {
    setActiveTab("notes");
    setTimeout(() => {
      sectionRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return null;
    const m = Math.floor(seconds / 60);
    return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
  };

  const formatRelativeTime = (dateStr: string) => {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
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
              <div className="w-24 h-9 bg-[#0F3D43]/20 rounded-[10px]" />
            </div>
          </div>
        </nav>

        {/* Content skeleton */}
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-pulse">
          <div className="mb-5">
            <div className="h-6 w-72 bg-[#EDE8DF] rounded mb-2" />
            <div className="h-3.5 w-full max-w-lg bg-[#EDE8DF]/60 rounded mb-1.5" />
            <div className="h-3.5 w-64 bg-[#EDE8DF]/60 rounded mb-3" />
            <div className="flex gap-2">
              <div className="h-5 w-16 bg-[#EDE8DF] rounded" />
              <div className="h-5 w-20 bg-[#EDE8DF]/50 rounded" />
            </div>
          </div>
          <div className="flex gap-0 border-b border-[rgba(217,185,130,0.25)] mb-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="px-4 py-2.5">
                <div className="h-4 w-16 bg-[#EDE8DF] rounded" />
              </div>
            ))}
          </div>
          <div className="space-y-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-xl p-4 sm:p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="h-5 w-48 bg-[#EDE8DF] rounded" />
                  <div className="h-4 w-16 bg-[#0F3D43]/15 rounded-full" />
                </div>
                <div className="space-y-2 mb-4">
                  <div className="h-3 w-full bg-[#EDE8DF]/50 rounded" />
                  <div className="h-3 w-full bg-[#EDE8DF]/50 rounded" />
                  <div className="h-3 w-5/6 bg-[#EDE8DF]/50 rounded" />
                  <div className="h-3 w-3/4 bg-[#EDE8DF]/50 rounded" />
                </div>
                <div className="space-y-2 mb-4">
                  <div className="flex items-start gap-2.5 px-3 py-2.5 bg-[#0F3D43]/[0.03] border-l-[3px] border-[#0F3D43]/20 rounded-r-lg">
                    <div className="h-3 w-3/4 bg-[#EDE8DF]/40 rounded" />
                  </div>
                </div>
                <div className="flex gap-2 pt-3 border-t border-[rgba(217,185,130,0.2)]">
                  <div className="h-7 w-24 bg-[#0F3D43]/15 rounded-lg" />
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
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <p className="text-[#1a1815] font-semibold mb-1" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
            Something went wrong
          </p>
          <p className="text-[#8a7f6f] text-sm mb-5">
            {error.includes("fetch") || error.includes("NetworkError")
              ? "Can't reach the server. Check your internet connection."
              : error}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 text-sm font-semibold bg-[#1a1815] hover:bg-[#2a2520] text-white px-5 py-2.5 rounded-xl transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Try again
            </button>
            <Link href="/dashboard" className="text-sm text-[#8a7f6f] hover:text-[#1a1815] transition-colors">
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F4EE]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-[rgba(217,185,130,0.25)] bg-[#FDFCF9]/92 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link href="/dashboard" className="text-[#8a7f6f] hover:text-[#1a1815] transition-colors" aria-label="Back to dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Link href="/" className="flex items-center gap-2">
              <StratumLogo size={32} />
              <span className="hidden sm:inline text-lg font-bold text-[#1a1815] tracking-tight" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>Lectly</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              disabled={deleteLoading}
              className="flex items-center gap-1.5 text-xs sm:text-sm text-[#8a7f6f] hover:text-red-500 border border-[rgba(217,185,130,0.35)] hover:border-red-300 px-2.5 sm:px-3 py-2 rounded-[10px] font-medium transition-all disabled:opacity-40"
              title="Delete lecture"
              aria-label="Delete lecture"
            >
              {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={pdfLoading || !lecture?.notes}
              className="flex items-center gap-1.5 text-xs sm:text-sm text-[#2C2A25] hover:text-[#1a1815] border border-[rgba(217,185,130,0.35)] hover:border-[rgba(217,185,130,0.6)] px-2.5 sm:px-3 py-2 rounded-[10px] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label={pdfLoading ? "Generating PDF" : "Download PDF"}
            >
              {pdfLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">{pdfLoading ? "Generating..." : "PDF"}</span>
            </button>
            <Link
              href={`/lecture/${id}/solve`}
              className="flex items-center gap-1.5 text-xs sm:text-sm bg-[#0F3D43] hover:bg-[#1a5c65] text-white px-3 sm:px-4 py-2 rounded-[10px] font-medium transition-all shadow-md shadow-[#0F3D43]/15"
            >
              <Zap className="w-4 h-4" />
              <span className="hidden sm:inline">Solve Mode</span>
              <span className="sm:hidden">Solve</span>
            </Link>
            <Link
              href={`/lecture/${id}/learn`}
              className="flex items-center gap-1.5 text-xs sm:text-sm bg-[#0F3D43] hover:bg-[#1a5c65] text-white px-3 sm:px-4 py-2 rounded-[10px] font-medium transition-all shadow-md shadow-[#0F3D43]/15"
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
          <div className="flex items-center gap-2 mb-1.5 group">
            {isRenaming ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  ref={renameInputRef}
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setIsRenaming(false); }}
                  className="text-xl font-bold text-[#1a1815] bg-[#FDFCF9] border border-[#3a9aa5] rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#0F3D43]/20 flex-1"
                  style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}
                  disabled={renameLoading}
                />
                <button onClick={handleRename} disabled={renameLoading} className="p-1.5 rounded-lg bg-[#0F3D43] text-white hover:bg-[#1a5c65] transition-colors disabled:opacity-40" aria-label="Confirm rename">
                  {renameLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </button>
                <button onClick={() => setIsRenaming(false)} className="p-1.5 rounded-lg text-[#8a7f6f] hover:text-[#1a1815] transition-colors" aria-label="Cancel rename">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <h1 className="text-xl font-bold text-[#1a1815]" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                  {notes?.title || lecture?.filename || "Lecture Notes"}
                </h1>
                <button
                  onClick={startRename}
                  className="p-1 rounded-lg text-[#8a7f6f] hover:text-[#0F3D43] sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                  title="Rename lecture"
                  aria-label="Rename lecture"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
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
            {lecture?.duration_seconds && (
              <span className="text-[11px] text-[#8a7f6f]">
                {formatDuration(lecture.duration_seconds)}
              </span>
            )}
            <span className="text-[11px] text-[#8a7f6f]">
              {sections.length} sections
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-[rgba(217,185,130,0.25)] mb-6">
          {(["notes", "transcript", "flashcards"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 sm:flex-none text-center sm:text-left px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? "text-[#0F3D43] border-[#0F3D43]"
                  : "text-[#8a7f6f] border-transparent hover:text-[#2C2A25]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex gap-6">
          {/* Main Content Column */}
          <div className="flex-1 min-w-0">
            {activeTab === "notes" && (
              <div className="space-y-5">
                {sections.map((section, i) => (
                  <div
                    key={i}
                    ref={(el) => { sectionRefs.current[i] = el; }}
                    className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-xl p-4 sm:p-5 hover:border-[rgba(217,185,130,0.45)] hover:shadow-sm transition-all scroll-mt-20"
                  >
                    {/* Section Header */}
                    <div className="flex items-start justify-between mb-3">
                      <h2 className="text-base font-semibold text-[#1a1815]" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                        {section.heading}
                      </h2>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ml-3 ${
                          section.source_type === "original"
                            ? "bg-[#0F3D43]/10 text-[#0a2e33]"
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
                            className="flex items-start gap-2.5 px-3 py-2.5 bg-[#0F3D43]/[0.05] border-l-[3px] border-[#0F3D43] rounded-r-lg"
                          >
                            <span className="text-sm mt-0.5">&#128273;</span>
                            <div>
                              <span className="text-[11px] font-semibold text-[#0a2e33] block mb-0.5">Key Point</span>
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
                        className="flex items-center gap-1.5 text-xs font-medium text-white bg-[#0F3D43] hover:bg-[#1a5c64] px-3 py-1.5 rounded-lg transition-all shadow-sm"
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
                      <Link
                        href={`/lecture/${id}/solve?section=${i}`}
                        className="flex items-center gap-1.5 text-xs font-medium text-[#0a2e33] bg-[#0F3D43]/10 hover:bg-[#0F3D43]/15 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        Solve
                      </Link>
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
                            aria-label="Close explanation"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
                                  ? "bg-[#0F3D43]/10 border-[#0F3D43] text-[#0a2e33]"
                                  : "bg-transparent border-[rgba(217,185,130,0.3)] text-[#8a7f6f]"
                              }`}
                            >
                              {level}
                            </button>
                          ))}
                        </div>
                        {explainLoading ? (
                          <div className="flex items-center gap-2 text-sm text-[#2C2A25] py-2">
                            <Loader2 className="w-4 h-4 animate-spin text-[#0F3D43]" />
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

            {activeTab === "flashcards" && (
              <div>
                {flashcards.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm text-[#8a7f6f]">
                        {flashcards.length} cards from definitions and key concepts
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {flashcards.map((card, i) => (
                        <FlashCard key={i} front={card.front} back={card.back} type={card.type} />
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-16">
                    <RotateCcw className="w-12 h-12 text-[#8a7f6f] mx-auto mb-4" />
                    <p className="text-[#1a1815] font-medium">No flashcards yet</p>
                    <p className="text-sm text-[#8a7f6f] mt-1">
                      Flashcards are generated from definitions and key points in your notes.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Sidebar — unified panel (desktop only) */}
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-20 space-y-3">
              {/* Study progress card */}
              <div className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-xl p-4">
                <p className="text-[10px] font-bold text-[#8a7f6f] uppercase tracking-widest mb-3">Your Progress</p>
                {studyStats ? (
                  <>
                    <div className="flex items-baseline gap-1.5 mb-2">
                      <span className="text-2xl font-bold text-[#1a1815]">{studyStats.avgMastery}%</span>
                      <span className="text-[11px] text-[#8a7f6f]">mastery</span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 bg-[#EDE8DF] rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full bg-[#0F3D43] rounded-full transition-all"
                        style={{ width: `${studyStats.avgMastery}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-[#8a7f6f] mb-3">
                      {studyStats.completedCards} of {studyStats.totalCards} cards · {formatRelativeTime(studyStats.lastStudied)}
                    </p>
                    <Link
                      href={`/lecture/${id}/learn`}
                      className="flex items-center justify-center gap-1.5 w-full text-xs font-semibold text-white bg-[#0F3D43] hover:bg-[#1a5c64] py-2 rounded-lg transition-all shadow-sm"
                    >
                      <GraduationCap className="w-3.5 h-3.5" />
                      Continue Learning
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-[#8a7f6f] mb-3">You haven&apos;t started studying this lecture yet.</p>
                    <Link
                      href={`/lecture/${id}/learn`}
                      className="flex items-center justify-center gap-1.5 w-full text-xs font-semibold text-white bg-[#0F3D43] hover:bg-[#1a5c64] py-2 rounded-lg transition-all shadow-sm"
                    >
                      <GraduationCap className="w-3.5 h-3.5" />
                      Start Learning
                    </Link>
                  </>
                )}
              </div>

              {/* Section map with progress dots */}
              {sections.length > 0 && (
                <div className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-xl p-4">
                  <p className="text-[10px] font-bold text-[#8a7f6f] uppercase tracking-widest mb-3">Sections</p>
                  <nav className="space-y-0.5">
                    {sections.map((section, i) => {
                      const isDone = studyStats?.sectionDone.get(i) || false;
                      const isActive = activeTab === "notes" && activeSection === i;
                      return (
                        <button
                          key={i}
                          onClick={() => scrollToSection(i)}
                          className={`flex items-start gap-2 w-full text-left py-1.5 px-2 rounded-lg transition-all ${
                            isActive ? "bg-[#0F3D43]/8" : "hover:bg-[#EDE8DF]/50"
                          }`}
                        >
                          <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${
                            isDone ? "bg-[#0F3D43]" : isActive ? "bg-[#0F3D43] ring-2 ring-[#0F3D43]/20" : "bg-[rgba(217,185,130,0.35)]"
                          }`} />
                          <span className={`text-[11px] leading-snug ${
                            isActive ? "text-[#0a2e33] font-semibold" : "text-[#8a7f6f]"
                          }`}>
                            {section.heading}
                          </span>
                        </button>
                      );
                    })}
                  </nav>
                </div>
              )}

              {/* Quick actions */}
              <div className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-xl p-4">
                <div className="space-y-1">
                  <button
                    onClick={handleDownloadPdf}
                    disabled={pdfLoading || !lecture?.notes}
                    className="flex items-center gap-2 w-full text-xs text-[#2C2A25] hover:text-[#1a1815] py-1.5 transition-colors disabled:opacity-40"
                  >
                    {pdfLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    Download PDF
                  </button>
                  <button
                    onClick={() => setTutorOpen(true)}
                    className="flex items-center gap-2 w-full text-xs text-[#2C2A25] hover:text-[#1a1815] py-1.5 transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Ask Tutor
                  </button>
                  <button
                    onClick={startRename}
                    className="flex items-center gap-2 w-full text-xs text-[#2C2A25] hover:text-[#1a1815] py-1.5 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Rename
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleteLoading}
                    className="flex items-center gap-2 w-full text-xs text-[#8a7f6f] hover:text-red-500 py-1.5 transition-colors disabled:opacity-40"
                  >
                    {deleteLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Delete Lecture
                  </button>
                </div>
              </div>

              {/* Lecture info */}
              <div className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-xl p-4">
                <p className="text-[10px] font-bold text-[#8a7f6f] uppercase tracking-widest mb-3">Lecture Info</p>
                <div className="space-y-2">
                  {lecture?.duration_seconds && (
                    <div className="flex justify-between">
                      <span className="text-[11px] text-[#8a7f6f]">Duration</span>
                      <span className="text-[11px] font-medium text-[#1a1815]">{formatDuration(lecture.duration_seconds)}</span>
                    </div>
                  )}
                  {lecture?.quality_score && (
                    <div className="flex justify-between">
                      <span className="text-[11px] text-[#8a7f6f]">Quality</span>
                      <span className="text-[11px] font-medium text-green-700">{lecture.quality_score}%</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </aside>

        </div>
      </main>

      {/* ── Floating Tutor Composer ── */}
      {!tutorOpen && (
        <button
          onClick={() => setTutorOpen(true)}
          className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 w-13 h-13 sm:w-14 sm:h-14 bg-[#0F3D43] hover:bg-[#1a5c64] text-white rounded-full shadow-lg shadow-black/10 flex items-center justify-center transition-all hover:scale-105"
          title="Ask Tutor"
          aria-label="Ask Tutor"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {tutorOpen && (
        <div className="fixed bottom-0 left-0 right-0 sm:bottom-6 sm:left-auto sm:right-6 z-50 sm:w-[360px] bg-[#FDFCF9] border-t sm:border border-[rgba(217,185,130,0.35)] sm:rounded-2xl shadow-2xl shadow-black/10 flex flex-col overflow-hidden" style={{ maxHeight: "min(520px, 75vh)" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(217,185,130,0.25)] bg-[#0F3D43]">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-white/80" />
              <span className="text-sm font-semibold text-white">Ask Tutor</span>
            </div>
            <button
              onClick={() => setTutorOpen(false)}
              className="text-white/70 hover:text-white transition-colors"
              aria-label="Minimize tutor chat"
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
                      className="text-[11px] text-[#0a2e33] bg-[#0F3D43]/8 hover:bg-[#0F3D43]/15 border border-[#0F3D43]/20 px-2.5 py-1 rounded-full transition-colors"
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
                      ? "bg-[#0F3D43] text-white rounded-br-md"
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
                  <Loader2 className="w-3 h-3 animate-spin text-[#0F3D43]" />
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
                className="flex-1 text-xs bg-[#FDFCF9] border border-[rgba(217,185,130,0.35)] rounded-lg px-3 py-2 text-[#1a1815] placeholder:text-[#b5aa94] focus:outline-none focus:border-[#0F3D43] transition-colors"
                disabled={tutorLoading}
              />
              <button
                onClick={() => handleTutorSend()}
                disabled={tutorLoading || !tutorInput.trim()}
                className="w-8 h-8 flex items-center justify-center bg-[#0F3D43] hover:bg-[#1a5c64] text-white rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Send message"
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
