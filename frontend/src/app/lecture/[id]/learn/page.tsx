"use client";

import { useState, useEffect, useRef, use } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  ArrowLeft,
  GraduationCap,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Lightbulb,
  Beaker,
  ExternalLink,
  Code,
  Send,
  Sparkles,
  Layers,
  PenTool,
  FileText,
} from "lucide-react";
import {
  getLecture,
  learnMode,
  askTutor,
  saveProgress,
  getLectureProgress,
  type Lecture,
  type LearnResult,
  type NoteSection,
  type TutorMessage,
  type StudyProgress,
  type CardContext,
} from "@/lib/api";
import { useAuth } from "@clerk/nextjs";
import { setAuthToken } from "@/lib/auth";

// ── Helper: render inline formatting (bold, inline code) ──
function RenderInline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-[#1a1815]">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={i}
              className="px-1.5 py-0.5 rounded-md bg-amber-100/60 border border-amber-200/40 text-[13px] font-mono text-amber-900"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ── Helper: render a paragraph that might be a math step ──
function RenderParagraph({ text, index }: { text: string; index: string }) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const isStep = /^(Step \d|Given:|Find:|Formula:|Answer:|Therefore:|Solution:|Result:|Where:)/i.test(trimmed);
  const isCalculation = /^[A-Za-z_]\s*=\s*.+/.test(trimmed) || /^[A-Za-z(].*[=×÷].*\d/.test(trimmed);
  const isBullet = /^[-•]\s/.test(trimmed);
  const isNumberedItem = /^\d+[\.\)]\s/.test(trimmed);

  if (isStep) {
    return (
      <div key={index} className="flex items-start gap-3 my-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[#0F3D43] mt-2 flex-shrink-0" />
        <p className="text-sm font-semibold text-[#1a1815] leading-relaxed">
          <RenderInline text={trimmed} />
        </p>
      </div>
    );
  }

  if (isCalculation) {
    return (
      <div key={index} className="my-2 mx-4 bg-[#1a1a2e] border border-amber-200/20 rounded-lg px-4 py-2">
        <code className="text-[13px] text-green-400 font-mono">
          {trimmed}
        </code>
      </div>
    );
  }

  if (isBullet) {
    const bulletText = trimmed.replace(/^[-•]\s*/, "");
    return (
      <div key={index} className="flex items-start gap-2 my-1 ml-2">
        <span className="text-amber-700 mt-0.5 flex-shrink-0">•</span>
        <p className="text-sm text-[#2C2A25] leading-relaxed">
          <RenderInline text={bulletText} />
        </p>
      </div>
    );
  }

  if (isNumberedItem) {
    const match = trimmed.match(/^(\d+[\.\)])\s*(.*)/);
    return (
      <div key={index} className="flex items-start gap-2 my-1 ml-2">
        <span className="text-amber-700 font-mono text-xs mt-0.5 flex-shrink-0 min-w-[1.2rem]">
          {match?.[1]}
        </span>
        <p className="text-sm text-[#2C2A25] leading-relaxed">
          <RenderInline text={match?.[2] || trimmed} />
        </p>
      </div>
    );
  }

  return (
    <p key={index} className="text-sm text-[#2C2A25] leading-[1.85] mb-4 last:mb-0">
      <RenderInline text={trimmed} />
    </p>
  );
}

// ── Helper: render body text with code blocks, math, and formatting ──
function RenderBody({ text }: { text: string }) {
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          const lines = part.slice(3, -3).split("\n");
          const lang = lines[0]?.trim() || "";
          const code = lang ? lines.slice(1).join("\n") : lines.join("\n");

          return (
            <div key={i} className="my-5 rounded-xl overflow-hidden border border-amber-200/30 shadow-sm">
              <div className="bg-[rgba(26,24,21,0.06)] px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code className="w-3.5 h-3.5 text-[#8a7f6f]" />
                  <span className="text-[10px] font-bold text-[#8a7f6f] uppercase tracking-wider">
                    {lang || "code"}
                  </span>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(code.trim())}
                  className="text-[10px] font-medium text-[#8a7f6f] hover:text-[#1a1815] px-2 py-0.5 rounded hover:bg-amber-100/50 transition-colors"
                >
                  Copy
                </button>
              </div>
              <pre className="bg-[#1a1a2e] px-5 py-4 overflow-x-auto">
                <code className="text-[13px] text-green-400 leading-[1.7] font-mono whitespace-pre">
                  {code.trim()}
                </code>
              </pre>
            </div>
          );
        }

        return part.split(/\n\n+/).map((paragraph, j) => {
          const trimmed = paragraph.trim();
          if (!trimmed) return null;

          // Auto-detect code that wasn't wrapped in backticks
          const codeLinePattern = /^[\s]*(public |private |class |import |int |String |void |System\.|for\s*\(|if\s*\(|while\s*\(|return |var |let |const |function |def |print\(|console\.|#include|using namespace|\}|else\s*\{|try\s*\{|catch\s*\()/;
          const allLines = trimmed.split("\n");
          const hasMultipleCodeLines = allLines.length >= 3;
          const codeLineCount = allLines.filter((l: string) => codeLinePattern.test(l)).length;
          const codeLineRatio = allLines.length > 0 ? codeLineCount / allLines.length : 0;
          const looksLikeCode = hasMultipleCodeLines && codeLineRatio >= 0.5 && (trimmed.includes(";") || trimmed.includes("{")) && !/^[A-Z].*\.\s/.test(trimmed);

          if (looksLikeCode) {
            let detectedLang = "code";
            if (/System\.out|public class|private |void /.test(trimmed)) detectedLang = "java";
            else if (/console\.|const |let |=>/.test(trimmed)) detectedLang = "javascript";
            else if (/def |print\(|import /.test(trimmed) && !trimmed.includes(";")) detectedLang = "python";
            else if (/#include|using namespace|cout/.test(trimmed)) detectedLang = "cpp";

            return (
              <div key={`${i}-${j}`} className="my-5 rounded-xl overflow-hidden border border-amber-200/30 shadow-sm">
                <div className="bg-[rgba(26,24,21,0.06)] px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code className="w-3.5 h-3.5 text-[#8a7f6f]" />
                    <span className="text-[10px] font-bold text-[#8a7f6f] uppercase tracking-wider">{detectedLang}</span>
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(trimmed)}
                    className="text-[10px] font-medium text-[#8a7f6f] hover:text-[#1a1815] px-2 py-0.5 rounded hover:bg-amber-100/50 transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <pre className="bg-[#1a1a2e] px-5 py-4 overflow-x-auto">
                  <code className="text-[13px] text-green-400 leading-[1.7] font-mono whitespace-pre">
                    {trimmed}
                  </code>
                </pre>
              </div>
            );
          }

          const lines = trimmed.split("\n");
          if (lines.length > 1) {
            return (
              <div key={`${i}-${j}`} className="mb-4">
                {lines.map((line, li) => (
                  <RenderParagraph key={`${i}-${j}-${li}`} text={line} index={`${i}-${j}-${li}`} />
                ))}
              </div>
            );
          }

          return <RenderParagraph key={`${i}-${j}`} text={trimmed} index={`${i}-${j}`} />;
        });
      })}
    </>
  );
}

// ── Helper: render tutor message content ──
function TutorMessageContent({ content }: { content: string }) {
  // Render inline markdown: **bold**, `code`
  const renderInline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) return <strong key={idx} className="font-semibold text-[#1a1815]">{part.slice(2, -2)}</strong>;
      if (part.startsWith("`") && part.endsWith("`")) return <code key={idx} className="px-1 py-0.5 rounded bg-amber-100/60 text-[11px] font-mono text-amber-900">{part.slice(1, -1)}</code>;
      return <span key={idx}>{part}</span>;
    });
  };

  // Render a single line with appropriate styling
  const renderLine = (line: string, key: string) => {
    const trimmed = line.trim();
    if (!trimmed) return null;

    // Step headers — bold, with top margin for visual separation
    if (/^(Step \d|Given:|Formula:|Answer:|Solution:)/i.test(trimmed)) {
      return <p key={key} className="text-sm leading-relaxed font-semibold text-[#1a1815] mt-2 first:mt-0">{renderInline(trimmed)}</p>;
    }
    // Bullet points (-, •, *)
    if (/^[-•*]\s+/.test(trimmed)) {
      const bulletText = trimmed.replace(/^[-•*]\s+/, "");
      return <p key={key} className="text-sm leading-relaxed mb-0.5 flex gap-2 pl-1"><span className="text-amber-600 flex-shrink-0">•</span><span>{renderInline(bulletText)}</span></p>;
    }
    // Numbered list items (1., 2., etc.)
    if (/^\d+[.)]\s+/.test(trimmed)) {
      const match = trimmed.match(/^(\d+[.)])\s+(.*)/);
      if (match) {
        return <p key={key} className="text-sm leading-relaxed mb-0.5 flex gap-2 pl-1"><span className="text-[#0F3D43] font-semibold flex-shrink-0 min-w-[1.2rem]">{match[1]}</span><span>{renderInline(match[2])}</span></p>;
      }
    }
    // Equations / formulas (X = something)
    if (/^[A-Za-z_]\s*=\s*.+/.test(trimmed) && trimmed.length < 120) {
      return <div key={key} className="bg-[rgba(26,24,21,0.06)] rounded px-3 py-1.5 my-1"><code className="text-[12px] text-green-700 font-mono">{trimmed}</code></div>;
    }
    // Horizontal rule
    if (/^---+$/.test(trimmed)) {
      return <hr key={key} className="border-[rgba(217,185,130,0.3)] my-2" />;
    }
    // Regular paragraph
    return <p key={key} className="text-sm leading-relaxed text-[#2C2A25]">{renderInline(trimmed)}</p>;
  };

  return (
    <div className="space-y-1.5">
      {content.split(/(```[\s\S]*?```)/g).map((block, bi) => {
        // Code blocks
        if (block.startsWith("```")) {
          const lines = block.slice(3, -3).split("\n");
          const lang = lines[0]?.trim() || "";
          const code = lang ? lines.slice(1).join("\n") : lines.join("\n");
          return (
            <div key={bi} className="my-2 rounded-lg overflow-hidden border border-amber-200/30">
              {lang && (
                <div className="bg-[rgba(26,24,21,0.06)] px-3 py-1 flex items-center gap-1.5">
                  <Code className="w-3 h-3 text-[#8a7f6f]" />
                  <span className="text-[9px] font-bold text-[#8a7f6f] uppercase">{lang}</span>
                </div>
              )}
              <pre className="bg-[#1a1a2e] px-3 py-2.5 overflow-x-auto">
                <code className="text-[12px] text-green-400 leading-[1.6] font-mono whitespace-pre">{code.trim()}</code>
              </pre>
            </div>
          );
        }

        // Text content — split on EVERY newline, not just double newlines
        // This ensures Step 1, Step 2, bullets, etc. each render on their own line
        const lines = block.split("\n");
        const elements: React.ReactNode[] = [];
        let consecutiveEmpty = 0;

        for (let li = 0; li < lines.length; li++) {
          const line = lines[li];
          if (!line.trim()) {
            consecutiveEmpty++;
            // Add spacing for double newlines (paragraph breaks)
            if (consecutiveEmpty >= 2) {
              elements.push(<div key={`${bi}-gap-${li}`} className="h-2" />);
              consecutiveEmpty = 0;
            }
            continue;
          }
          consecutiveEmpty = 0;
          const rendered = renderLine(line, `${bi}-${li}`);
          if (rendered) elements.push(rendered);
        }

        return <div key={bi}>{elements}</div>;
      })}
    </div>
  );
}

// ── Types for unified card flow ──
type FlowCard =
  | { type: "concept"; index: number; subtitle: string; body: string }
  | { type: "analogy"; body: string }
  | { type: "quiz"; questionIndex: number }

export default function LearnModePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const { getToken, isLoaded: authLoaded } = useAuth();
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Learn Mode state
  const [selectedSection, setSelectedSection] = useState<number | null>(null);
  const [learnLevel, setLearnLevel] = useState("intermediate");
  const [learnResult, setLearnResult] = useState<LearnResult | null>(null);
  const [learnLoading, setLearnLoading] = useState(false);

  // Card style preference from settings
  const [cardStyle, setCardStyle] = useState("mixed");

  // Load learning preferences from localStorage (set in Settings > Learning Preferences)
  useEffect(() => {
    try {
      const prefs = localStorage.getItem("lectly_learning_prefs");
      if (prefs) {
        const parsed = JSON.parse(prefs);
        if (parsed.difficulty && ["beginner", "intermediate", "advanced"].includes(parsed.difficulty)) {
          setLearnLevel(parsed.difficulty);
        }
        if (parsed.cardStyle && ["mixed", "explanations", "quizzes"].includes(parsed.cardStyle)) {
          setCardStyle(parsed.cardStyle);
        }
      }
    } catch {
      // ignore — use default
    }
  }, []);

  // Quiz state
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizRevealed, setQuizRevealed] = useState<Record<number, boolean>>({});

  // Reteach state
  const [reteachIndex, setReteachIndex] = useState<number | null>(null);
  const [reteachText, setReteachText] = useState<string>("");
  const [reteachLoading, setReteachLoading] = useState(false);

  // Active mode: 0 = CARDS, 1 = PRACTICE, 2 = NOTES
  const [activeMode, setActiveMode] = useState(0);

  // Unified card flow index (concept cards + analogy + quiz cards)
  const [cardIndex, setCardIndex] = useState(0);

  // Tutor composer state (persistent, not floating)
  const [tutorExpanded, setTutorExpanded] = useState(false);
  const [chatMessages, setChatMessages] = useState<TutorMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const [autoStarted, setAutoStarted] = useState(false);

  // Progress tracking
  const [existingProgress, setExistingProgress] = useState<StudyProgress[]>([]);
  const progressSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Build unified card flow (from a given result, for resume logic) ──
  const buildCardFlowFrom = (result: LearnResult): FlowCard[] => {
    const flow: FlowCard[] = [];
    const concepts = result.explanation;
    const quizQuestions = result.quiz;
    let qIdx = 0;
    for (let i = 0; i < concepts.length; i++) {
      flow.push({ type: "concept", index: i, subtitle: concepts[i].subtitle, body: concepts[i].body });
      if ((i + 1) % 3 === 0 && qIdx < quizQuestions.length) {
        flow.push({ type: "quiz", questionIndex: qIdx });
        qIdx++;
      }
    }
    if (result.analogy) flow.push({ type: "analogy", body: result.analogy });
    while (qIdx < quizQuestions.length) {
      flow.push({ type: "quiz", questionIndex: qIdx });
      qIdx++;
    }
    return flow;
  };

  // ── Build unified card flow ──
  const buildCardFlow = (): FlowCard[] => {
    if (!learnResult) return [];
    const flow: FlowCard[] = [];
    const concepts = learnResult.explanation;
    const quizQuestions = learnResult.quiz;

    // Interleave concept cards with quiz cards
    // Pattern: every 3 concept cards, insert a quiz question (if available)
    let quizIdx = 0;
    for (let i = 0; i < concepts.length; i++) {
      flow.push({
        type: "concept",
        index: i,
        subtitle: concepts[i].subtitle,
        body: concepts[i].body,
      });

      // After every 3rd concept card, insert a quiz if available
      if ((i + 1) % 3 === 0 && quizIdx < quizQuestions.length) {
        flow.push({ type: "quiz", questionIndex: quizIdx });
        quizIdx++;
      }
    }

    // Add analogy card at the end of concept/quiz flow
    if (learnResult.analogy) {
      flow.push({ type: "analogy", body: learnResult.analogy });
    }

    // Add remaining quiz questions
    while (quizIdx < quizQuestions.length) {
      flow.push({ type: "quiz", questionIndex: quizIdx });
      quizIdx++;
    }

    return flow;
  };

  const cardFlow = learnResult ? buildCardFlow() : [];
  const currentFlowCard = cardFlow[cardIndex] || null;
  const totalFlowCards = cardFlow.length;

  useEffect(() => {
    if (!authLoaded) return;

    async function fetchLecture() {
      try {
        const token = await getToken();
        setAuthToken(token);
        const data = await getLecture(id);
        setLecture(data);
      } catch {
        setError("Could not load lecture.");
      } finally {
        setLoading(false);
      }
    }
    fetchLecture();
  }, [id, authLoaded]);

  // Auto-start if ?section= is in the URL
  useEffect(() => {
    if (lecture && !autoStarted) {
      const sectionParam = searchParams.get("section");
      if (sectionParam !== null) {
        const idx = parseInt(sectionParam);
        if (!isNaN(idx)) {
          handleStartLearn(idx);
          setAutoStarted(true);
        }
      }
    }
  }, [lecture, autoStarted, searchParams]);

  // Keyboard navigation for card flow
  useEffect(() => {
    if (activeMode !== 0 || !learnResult) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setCardIndex((prev) => Math.min(prev + 1, totalFlowCards - 1));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setCardIndex((prev) => Math.max(prev - 1, 0));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeMode, learnResult, totalFlowCards]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, chatLoading]);

  // Focus chat input when expanded
  useEffect(() => {
    if (tutorExpanded && chatInputRef.current) {
      chatInputRef.current.focus();
    }
  }, [tutorExpanded]);

  // Build card context for the tutor — tells it exactly what the student is looking at
  const buildCardContext = (): CardContext | undefined => {
    if (!currentFlowCard || !learnResult) return undefined;

    if (currentFlowCard.type === "concept") {
      return {
        card_type: "concept",
        card_title: currentFlowCard.subtitle,
        card_content: currentFlowCard.body,
      };
    }

    if (currentFlowCard.type === "quiz") {
      const q = learnResult.quiz[currentFlowCard.questionIndex];
      if (!q) return undefined;
      const answered = quizRevealed[currentFlowCard.questionIndex];
      const studentIdx = quizAnswers[currentFlowCard.questionIndex];
      const isWrong = answered && studentIdx !== q.correct_index;
      return {
        card_type: "quiz",
        quiz_question: q.question,
        quiz_options: q.options,
        student_answer: isWrong ? q.options[studentIdx] : "",
        correct_answer: answered ? q.options[q.correct_index] : "",
      };
    }

    if (currentFlowCard.type === "analogy") {
      return {
        card_type: "analogy",
        card_content: currentFlowCard.body,
      };
    }

    return undefined;
  };

  const handleSendMessage = async (message?: string) => {
    const text = message || chatInput.trim();
    if (!text || chatLoading) return;

    // Auto-expand tutor when sending
    if (!tutorExpanded) setTutorExpanded(true);

    const userMsg: TutorMessage = { role: "user", content: text };
    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const result = await askTutor(
        id,
        text,
        updatedMessages,
        selectedSection !== null && selectedSection >= 0 ? selectedSection : undefined,
        buildCardContext()
      );
      setChatMessages((prev) => [
        ...prev,
        { role: "tutor", content: result.answer },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: "tutor", content: "Sorry, I couldn't process that. Please try again." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Contextual chips that change based on current card
  const getContextualChips = () => {
    if (!currentFlowCard) return [
      { label: "Explain differently" },
      { label: "Why does this matter?" },
    ];

    if (currentFlowCard.type === "concept") {
      return [
        { label: "Explain differently" },
        { label: "Why does this matter?" },
      ];
    }
    if (currentFlowCard.type === "quiz") {
      return [
        { label: "Give me a hint" },
        { label: "Explain this concept" },
      ];
    }
    if (currentFlowCard.type === "analogy") {
      return [
        { label: "Another analogy" },
        { label: "Quiz me" },
      ];
    }
    return [
      { label: "Explain differently" },
      { label: "Why does this matter?" },
    ];
  };

  // Get contextual placeholder for composer
  const getComposerPlaceholder = () => {
    if (!currentFlowCard) return "Ask your tutor about this lecture...";
    if (currentFlowCard.type === "concept") return "Ask your tutor about this card...";
    if (currentFlowCard.type === "quiz") return "Stuck? Ask the tutor for a hint...";
    if (currentFlowCard.type === "analogy") return "Want a different analogy?";
    return "Ask your tutor anything...";
  };

  // ── Progress tracking helpers ──
  const doSaveProgress = async (overrideCardIndex?: number) => {
    if (!learnResult || selectedSection === null) return;

    const currentIdx = overrideCardIndex ?? cardIndex;
    const quizCards = cardFlow.filter((c) => c.type === "quiz");
    const answeredQuizzes = Object.keys(quizRevealed).length;
    const correctQuizzes = Object.entries(quizRevealed).filter(
      ([qi]) => quizAnswers[parseInt(qi)] === learnResult.quiz[parseInt(qi)]?.correct_index
    ).length;

    // Mastery = weighted: 60% card progress + 40% quiz accuracy
    const cardProgress = totalFlowCards > 0 ? (currentIdx + 1) / totalFlowCards : 0;
    const quizAccuracy = answeredQuizzes > 0 ? correctQuizzes / answeredQuizzes : 0;
    const mastery = Math.round((cardProgress * 60 + quizAccuracy * 40));

    try {
      await saveProgress({
        lecture_id: id,
        section_index: selectedSection,
        total_cards: totalFlowCards,
        completed_cards: currentIdx + 1,
        quiz_correct: correctQuizzes,
        quiz_total: answeredQuizzes,
        last_card_index: currentIdx,
        mastery_pct: Math.min(mastery, 100),
      });
    } catch {
      // Silent fail — progress save is non-critical
    }
  };

  // Debounced progress save on card navigation
  const scheduleSaveProgress = (newCardIndex: number) => {
    if (progressSaveTimer.current) clearTimeout(progressSaveTimer.current);
    progressSaveTimer.current = setTimeout(() => doSaveProgress(newCardIndex), 1500);
  };

  // Load existing progress on mount
  useEffect(() => {
    if (!authLoaded) return;

    async function loadProgress() {
      try {
        const token = await getToken();
        setAuthToken(token);
        const { progress } = await getLectureProgress(id);
        setExistingProgress(progress);
      } catch {
        // No progress yet — that's fine
      }
    }
    loadProgress();
  }, [id, authLoaded]);

  // Save progress when card index changes
  useEffect(() => {
    if (learnResult && selectedSection !== null) {
      scheduleSaveProgress(cardIndex);
    }
    return () => {
      if (progressSaveTimer.current) clearTimeout(progressSaveTimer.current);
    };
  }, [cardIndex, learnResult, selectedSection]);

  // Save progress immediately when quiz is answered
  useEffect(() => {
    if (learnResult && selectedSection !== null && Object.keys(quizRevealed).length > 0) {
      doSaveProgress();
    }
  }, [quizRevealed]);

  // Get existing progress for a section
  const getProgressForSection = (sectionIdx: number): StudyProgress | undefined => {
    return existingProgress.find((p) => p.section_index === sectionIdx);
  };

  const handleReteach = async (questionIndex: number) => {
    if (!learnResult || reteachLoading) return;
    const q = learnResult.quiz[questionIndex];
    if (!q) return;

    setReteachIndex(questionIndex);
    setReteachLoading(true);
    setReteachText("");

    const studentPick = q.options[quizAnswers[questionIndex]] || "unknown";
    const correctAnswer = q.options[q.correct_index];
    const prompt = `I just got this quiz question wrong and need help understanding it.\n\nQuestion: "${q.question}"\nI picked: "${studentPick}"\nCorrect answer: "${correctAnswer}"\n\nExplain why my answer is wrong and why the correct answer is right. Use a different angle or analogy than the original explanation. If it involves any calculation, show ALL the steps.`;

    // Build quiz card context for the reteach
    const reteachCardContext: CardContext = {
      card_type: "quiz",
      quiz_question: q.question,
      quiz_options: q.options,
      student_answer: studentPick,
      correct_answer: correctAnswer,
    };

    try {
      const result = await askTutor(
        id,
        prompt,
        [],
        selectedSection !== null && selectedSection >= 0 ? selectedSection : undefined,
        reteachCardContext
      );
      setReteachText(result.answer);
    } catch {
      setReteachText("Sorry, I couldn't generate a re-explanation right now. Try asking in the tutor chat.");
    } finally {
      setReteachLoading(false);
    }
  };

  const handleStartLearn = async (sectionIndex: number) => {
    if (learnLoading) return;
    setSelectedSection(sectionIndex);
    setLearnLoading(true);
    setLearnResult(null);
    setError("");
    setQuizAnswers({});
    setQuizRevealed({});
    setReteachIndex(null);
    setReteachText("");
    setReteachLoading(false);
    setActiveMode(0);
    setCardIndex(0);
    setTutorExpanded(false);
    setChatMessages([]);
    try {
      const result = await learnMode(id, learnLevel, sectionIndex, cardStyle);
      setLearnResult(result);

      // Resume from last card if there's existing progress
      const existing = getProgressForSection(sectionIndex);
      if (existing && existing.last_card_index > 0) {
        // Don't resume past the end of the new card flow
        const flow = buildCardFlowFrom(result);
        const resumeIdx = Math.min(existing.last_card_index, flow.length - 1);
        setCardIndex(resumeIdx);
      }
    } catch {
      setError("Learn Mode failed. Please try again.");
    } finally {
      setLearnLoading(false);
    }
  };

  const selectQuizAnswer = (qIndex: number, optionIndex: number) => {
    if (quizRevealed[qIndex]) return;
    const newAnswers = { ...quizAnswers, [qIndex]: optionIndex };
    setQuizAnswers(newAnswers);
    setQuizRevealed((prev) => ({ ...prev, [qIndex]: true }));
  };

  const sections: NoteSection[] = lecture?.notes?.sections || [];

  const modeLabels = ["Cards", "Practice", "Notes"];
  const modeIcons = [Layers, PenTool, FileText];

  // Count how many cards are completed (before current index)
  const completedCards = learnResult ? learnResult.explanation.length : 0;
  const conceptCardsDone = cardFlow.filter((c, i) => i < cardIndex && c.type === "concept").length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F4EE] flex flex-col">
        {/* Nav skeleton */}
        <nav className="sticky top-0 z-50 border-b border-[rgba(217,185,130,0.25)] bg-[#FDFCF9]/92 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
            <div className="w-5 h-5 bg-[#EDE8DF] rounded" />
            <div className="h-5 w-44 bg-[#EDE8DF] rounded" />
            <div className="flex gap-2">
              <div className="w-8 h-8 bg-[#EDE8DF] rounded-lg" />
              <div className="w-8 h-8 bg-[#EDE8DF] rounded-lg" />
            </div>
          </div>
        </nav>

        <div className="flex-1 flex max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 gap-6 animate-pulse">
          {/* Sidebar skeleton */}
          <div className="w-72 flex-shrink-0 hidden lg:block">
            <div className="h-2.5 w-14 bg-[#EDE8DF] rounded mb-3" />
            <div className="flex gap-1 mb-4 bg-[#EDE8DF] rounded-xl p-1 h-10" />
            <div className="space-y-1.5">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="p-3 rounded-xl border border-[rgba(217,185,130,0.25)] bg-[#FDFCF9]">
                  <div className="h-3.5 w-full bg-[#EDE8DF] rounded mb-1.5" />
                  <div className="h-3 w-2/3 bg-[#EDE8DF]/50 rounded" />
                </div>
              ))}
            </div>
          </div>

          {/* Main card area skeleton */}
          <div className="flex-1 flex flex-col items-center">
            <div className="w-full max-w-2xl">
              {/* Card skeleton */}
              <div className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-2xl p-6 sm:p-8 min-h-[400px]">
                <div className="h-5 w-3/4 bg-[#EDE8DF] rounded mb-4" />
                <div className="space-y-2.5">
                  <div className="h-3.5 w-full bg-[#EDE8DF]/50 rounded" />
                  <div className="h-3.5 w-full bg-[#EDE8DF]/50 rounded" />
                  <div className="h-3.5 w-5/6 bg-[#EDE8DF]/50 rounded" />
                  <div className="h-3.5 w-full bg-[#EDE8DF]/50 rounded" />
                  <div className="h-3.5 w-4/5 bg-[#EDE8DF]/50 rounded" />
                  <div className="h-3.5 w-full bg-[#EDE8DF]/50 rounded" />
                  <div className="h-3.5 w-2/3 bg-[#EDE8DF]/50 rounded" />
                </div>
                {/* Nav buttons skeleton */}
                <div className="flex items-center justify-between mt-8">
                  <div className="h-9 w-20 bg-[#EDE8DF]/40 rounded-xl" />
                  <div className="h-9 w-24 bg-[#EDE8DF] rounded-xl" />
                </div>
              </div>
              {/* Tutor bar skeleton */}
              <div className="mt-4 flex gap-2">
                <div className="h-7 w-24 bg-[#EDE8DF]/50 rounded-full" />
                <div className="h-7 w-32 bg-[#EDE8DF]/50 rounded-full" />
              </div>
              <div className="mt-2 h-11 w-full bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-xl" />
            </div>
          </div>
        </div>
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
              Try again
            </button>
            <Link href={`/lecture/${id}`} className="text-sm text-[#8a7f6f] hover:text-[#1a1815] transition-colors">
              Back to notes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F4EE] flex flex-col">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 border-b border-[rgba(217,185,130,0.25)] bg-[#FDFCF9]/92 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/lecture/${id}`} className="text-[#8a7f6f] hover:text-[#1a1815] transition-colors" aria-label="Back to lecture notes">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            {lecture?.subject && (
              <span className="text-[11px] font-bold text-[#8a7f6f] uppercase tracking-wider hidden sm:inline">
                {lecture.subject}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-[#1a1815] truncate max-w-[200px] sm:max-w-none" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
              {learnResult?.topic || lecture?.notes?.title || "Learn Mode"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Reserved for future: bookmark, settings */}
          </div>
        </div>
      </nav>

      <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
        <div className="flex-1 flex gap-6 py-6 pb-36 sm:pb-6">
          {/* ── Left sidebar: Topic Picker ── */}
          <div className="w-72 flex-shrink-0 hidden lg:block">
            <div className="sticky top-20">
              <h2 className="text-[11px] font-bold text-[#8a7f6f] uppercase tracking-wider mb-3">
                Topics
              </h2>

              {/* Level selector */}
              <div className="flex gap-1 mb-4 bg-[#EDE8DF] rounded-xl p-1">
                {["beginner", "intermediate", "advanced"].map((level) => (
                  <button
                    key={level}
                    onClick={() => setLearnLevel(level)}
                    disabled={learnLoading}
                    className={`flex-1 text-[11px] font-semibold py-2 rounded-lg transition-all capitalize ${
                      learnLevel === level
                        ? "bg-[#1a1815] text-white shadow-md"
                        : "text-[#8a7f6f] hover:text-[#1a1815]"
                    } ${learnLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {level}
                  </button>
                ))}
              </div>

              {/* Section list */}
              <div className="space-y-1.5">
                {sections.map((section, i) => (
                  (() => {
                    const sectionProgress = getProgressForSection(i);
                    return (
                      <button
                        key={i}
                        onClick={() => handleStartLearn(i)}
                        disabled={learnLoading}
                        className={`w-full text-left p-3 rounded-xl border transition-all group ${
                          selectedSection === i
                            ? "bg-[#FDFCF9] border-[#1a1815]/20 shadow-sm"
                            : "bg-transparent border-transparent hover:bg-[#FDFCF9] hover:border-[rgba(217,185,130,0.25)]"
                        } ${learnLoading ? "opacity-60 cursor-not-allowed" : ""}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-medium ${
                            selectedSection === i ? "text-[#1a1815]" : "text-[#2C2A25] group-hover:text-[#1a1815]"
                          }`}>
                            {section.heading}
                          </span>
                          {learnLoading && selectedSection === i ? (
                            <Loader2 className="w-4 h-4 text-[#8a7f6f] animate-spin flex-shrink-0" />
                          ) : (
                            <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${
                              selectedSection === i ? "text-[#1a1815]" : "text-[#8a7f6f] sm:opacity-0 sm:group-hover:opacity-100"
                            } transition-opacity`} />
                          )}
                        </div>
                        {sectionProgress && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="flex-1 h-1 bg-[#EDE8DF] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 rounded-full transition-all"
                                style={{ width: `${sectionProgress.mastery_pct}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-medium text-[#8a7f6f]">
                              {sectionProgress.mastery_pct}%
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })()
                ))}

                {/* Full lecture option */}
                <button
                  onClick={() => handleStartLearn(-1)}
                  disabled={learnLoading}
                  className={`w-full text-left p-3 rounded-xl border transition-all group ${
                    selectedSection === -1
                      ? "bg-[#FDFCF9] border-[#1a1815]/20 shadow-sm"
                      : "bg-transparent border-transparent hover:bg-[#FDFCF9] hover:border-[rgba(217,185,130,0.25)]"
                  } ${learnLoading ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${
                      selectedSection === -1 ? "text-[#1a1815]" : "text-[#2C2A25]"
                    }`}>
                      Full Lecture Overview
                    </span>
                    <BookOpen className="w-3.5 h-3.5 text-[#8a7f6f]" />
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* ── Main content area ── */}
          <div className="flex-1 min-w-0 flex flex-col">
            {/* Mobile: topic selector */}
            <div className="lg:hidden mb-4">
              <select
                value={selectedSection ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val !== "") handleStartLearn(parseInt(val));
                }}
                disabled={learnLoading}
                className="w-full bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-xl px-4 py-3 text-sm text-[#1a1815] appearance-none disabled:opacity-50"
              >
                <option value="" disabled>Select a topic to learn...</option>
                {sections.map((section, i) => (
                  <option key={i} value={i}>{section.heading}</option>
                ))}
                <option value={-1}>Full Lecture Overview</option>
              </select>
              <div className="flex gap-1 mt-2 bg-[#EDE8DF] rounded-xl p-1">
                {["beginner", "intermediate", "advanced"].map((level) => (
                  <button
                    key={level}
                    onClick={() => setLearnLevel(level)}
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
            </div>

            {/* No section selected */}
            {selectedSection === null && !learnLoading && (
              <div className="flex-1 flex flex-col items-center justify-center py-24 text-center">
                <div className="w-20 h-20 rounded-2xl bg-[#EDE8DF] flex items-center justify-center mb-6">
                  <GraduationCap className="w-10 h-10 text-[#8a7f6f]" />
                </div>
                <h2 className="text-xl font-bold text-[#1a1815] mb-2" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                  Ready to Learn?
                </h2>
                <p className="text-sm text-[#8a7f6f] max-w-md">
                  Pick a topic from the list and your AI tutor will teach it to you with bite-sized cards, quizzes, and examples.
                </p>
              </div>
            )}

            {/* Loading */}
            {learnLoading && (
              <div className="flex-1 flex flex-col items-center justify-center py-24">
                <div className="relative mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-[#1a1815] flex items-center justify-center">
                    <GraduationCap className="w-8 h-8 text-white" />
                  </div>
                  <Loader2 className="w-6 h-6 text-[#8a7f6f] animate-spin absolute -bottom-1 -right-1" />
                </div>
                <h3 className="text-lg font-semibold text-[#1a1815] mb-1" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                  Preparing your lesson...
                </h3>
                <p className="text-sm text-[#8a7f6f]">
                  Building cards, examples, and quiz questions
                </p>
              </div>
            )}

            {/* Error during learn */}
            {error && !learnLoading && selectedSection !== null && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <AlertCircle className="w-10 h-10 text-red-400 mb-4" />
                <p className="text-[#1a1815] font-medium mb-2">Something went wrong</p>
                <p className="text-sm text-[#8a7f6f] mb-4">{error}</p>
                <button
                  onClick={() => handleStartLearn(selectedSection)}
                  className="text-sm text-[#0F3D43] hover:text-[#1a5c64] font-medium"
                >
                  Try again
                </button>
              </div>
            )}

            {/* ═══ LESSON CONTENT ═══ */}
            {learnResult && !learnLoading && (
              <div className="flex-1 flex flex-col">
                {/* ── Mode tabs: CARDS | PRACTICE | NOTES ── */}
                <div className="mb-6">
                  {/* Progress info line */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[10px] font-bold text-[#8a7f6f] uppercase tracking-widest">
                      {learnResult.topic}
                    </span>
                    <span className="text-[10px] text-[#8a7f6f]">·</span>
                    <span className="text-[10px] font-medium text-[#8a7f6f]">
                      {conceptCardsDone} of {completedCards}
                    </span>
                  </div>

                  {/* Mode switcher: CARDS | PRACTICE | NOTES */}
                  <div className="flex gap-1 bg-[#EDE8DF] rounded-xl p-1">
                    {modeLabels.map((label, i) => {
                      const Icon = modeIcons[i];
                      return (
                        <button
                          key={label}
                          onClick={() => setActiveMode(i)}
                          className={`flex items-center justify-center gap-1.5 text-xs font-bold px-5 py-2.5 rounded-lg transition-all flex-1 uppercase tracking-wider ${
                            activeMode === i
                              ? "bg-[#1a1815] text-white shadow-md"
                              : "text-[#8a7f6f] hover:text-[#1a1815] hover:bg-[#FDFCF9]"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ═══ MODE 0: CARDS (unified card flow) ═══ */}
                {activeMode === 0 && currentFlowCard && (() => {
                  const isFirst = cardIndex === 0;
                  const isLast = cardIndex >= totalFlowCards - 1;

                  return (
                    <div className="flex-1 flex flex-col">
                      {/* Progress dots */}
                      <div className="flex items-center justify-center gap-1.5 mb-5 overflow-x-auto px-2 scrollbar-hide">
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {cardFlow.map((card, i) => {
                            const isQuiz = card.type === "quiz";
                            const isAnalogy = card.type === "analogy";
                            return (
                              <button
                                key={i}
                                onClick={() => setCardIndex(i)}
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
                          {cardIndex + 1} / {totalFlowCards}
                        </span>
                      </div>

                      {/* ── CONCEPT CARD ── */}
                      {currentFlowCard.type === "concept" && (
                        <div
                          key={`concept-${cardIndex}`}
                          className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-2xl shadow-sm overflow-hidden"
                          style={{ animation: "fadeSlideIn 0.3s ease-out" }}
                        >
                          {/* Concept label */}
                          <div className="px-6 sm:px-8 pt-5 flex items-center gap-3">
                            <span className="text-[10px] font-bold text-green-700 uppercase tracking-widest">Concept</span>
                            <span className="text-[10px] text-[#8a7f6f]">·</span>
                            <span className="text-[10px] text-[#8a7f6f]">30 sec read</span>
                          </div>

                          <div className="p-6 sm:p-8 pt-4">
                            {/* Card title */}
                            {currentFlowCard.subtitle && (
                              <h2 className="text-xl font-bold text-[#1a1815] leading-snug mb-4" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                                {currentFlowCard.subtitle}
                              </h2>
                            )}

                            {/* Card body */}
                            <div className="prose max-w-none">
                              <RenderBody text={currentFlowCard.body} />
                            </div>
                          </div>

                          {/* Card navigation footer */}
                          <div className="px-6 sm:px-8 pb-6 pt-2 flex items-center justify-between border-t border-[rgba(217,185,130,0.15)]">
                            <button
                              onClick={() => setCardIndex(Math.max(0, cardIndex - 1))}
                              disabled={isFirst}
                              className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 rounded-xl transition-all ${
                                isFirst
                                  ? "text-[#8a7f6f]/40 cursor-not-allowed"
                                  : "text-[#8a7f6f] hover:bg-[#EDE8DF] active:scale-95"
                              }`}
                            >
                              <ChevronLeft className="w-4 h-4" />
                              Back
                            </button>

                            <button
                              onClick={() => {
                                if (isLast) {
                                  setActiveMode(2); // Go to Notes
                                } else {
                                  setCardIndex(cardIndex + 1);
                                }
                              }}
                              className="flex items-center gap-1.5 text-sm font-semibold px-5 py-2.5 rounded-xl bg-[#1a1815] text-white shadow-sm hover:shadow-md active:scale-95 transition-all"
                            >
                              {isLast ? (
                                <>View Notes <ChevronRight className="w-4 h-4" /></>
                              ) : (
                                <>I got it <ChevronRight className="w-4 h-4" /></>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ── QUICK CHECK (Quiz) CARD ── */}
                      {currentFlowCard.type === "quiz" && (() => {
                        const qi = currentFlowCard.questionIndex;
                        const q = learnResult.quiz[qi];
                        if (!q) return null;

                        const isRevealed = quizRevealed[qi];
                        const isCorrect = isRevealed && quizAnswers[qi] === q.correct_index;

                        return (
                          <div
                            key={`quiz-${cardIndex}`}
                            className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-2xl shadow-sm overflow-hidden"
                            style={{ animation: "fadeSlideIn 0.3s ease-out" }}
                          >
                            {/* Quiz label */}
                            <div className="px-6 sm:px-8 pt-5">
                              <span className="text-[10px] font-bold text-green-700 uppercase tracking-widest">Quick Check</span>
                            </div>

                            <div className="p-6 sm:p-8 pt-4">
                              <div className="text-lg font-bold text-[#1a1815] leading-snug mb-5" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                                <RenderBody text={q.question} />
                              </div>

                              {/* Options */}
                              <div className="space-y-2.5">
                                {q.options.map((opt, oi) => {
                                  const isSelected = quizAnswers[qi] === oi;
                                  const isCorrectOpt = oi === q.correct_index;

                                  let style = "border-[rgba(217,185,130,0.3)] text-[#2C2A25] hover:border-[rgba(217,185,130,0.5)] hover:bg-[#EDE8DF]/50";
                                  if (isRevealed) {
                                    if (isCorrectOpt) {
                                      style = "border-green-400/50 bg-green-50 text-green-800";
                                    } else if (isSelected && !isCorrectOpt) {
                                      style = "border-red-400/50 bg-red-50 text-red-700";
                                    } else {
                                      style = "border-[rgba(217,185,130,0.15)] text-[#8a7f6f]";
                                    }
                                  } else if (isSelected) {
                                    style = "border-[#1a1815]/30 bg-[#EDE8DF] text-[#1a1815]";
                                  }

                                  return (
                                    <button
                                      key={oi}
                                      onClick={() => selectQuizAnswer(qi, oi)}
                                      disabled={isRevealed}
                                      className={`w-full flex items-center gap-3 text-left text-sm p-4 rounded-xl border transition-all ${style}`}
                                    >
                                      <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                                        isRevealed && isCorrectOpt ? "border-green-500 bg-green-500 text-white" :
                                        isRevealed && isSelected ? "border-red-400 bg-red-400 text-white" :
                                        isSelected ? "border-[#1a1815] bg-[#1a1815] text-white" : "border-[#8a7f6f]/40 text-[#8a7f6f]"
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
                                        <div className="mt-3 rounded-xl overflow-hidden border border-amber-300/40 bg-[#FDFCF9]">
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
                                          onClick={() => handleReteach(qi)}
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
                                onClick={() => setCardIndex(Math.max(0, cardIndex - 1))}
                                disabled={isFirst}
                                className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 rounded-xl transition-all ${
                                  isFirst ? "text-[#8a7f6f]/40 cursor-not-allowed" : "text-[#8a7f6f] hover:bg-[#EDE8DF] active:scale-95"
                                }`}
                              >
                                <ChevronLeft className="w-4 h-4" />
                                Back
                              </button>
                              <button
                                onClick={() => {
                                  if (isLast) setActiveMode(2);
                                  else setCardIndex(cardIndex + 1);
                                }}
                                className="flex items-center gap-1.5 text-sm font-semibold px-5 py-2.5 rounded-xl bg-[#1a1815] text-white shadow-sm hover:shadow-md active:scale-95 transition-all"
                              >
                                {isLast ? <>View Notes <ChevronRight className="w-4 h-4" /></> : <>Next card <ChevronRight className="w-4 h-4" /></>}
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      {/* ── ANALOGY CARD ── */}
                      {currentFlowCard.type === "analogy" && (
                        <div
                          key={`analogy-${cardIndex}`}
                          className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-2xl shadow-sm overflow-hidden"
                          style={{ animation: "fadeSlideIn 0.3s ease-out" }}
                        >
                          <div className="px-6 sm:px-8 pt-5 flex items-center gap-2">
                            <Lightbulb className="w-4 h-4 text-amber-600" />
                            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Real-World Analogy</span>
                          </div>

                          <div className="p-6 sm:p-8 pt-4">
                            <div className="prose max-w-none">
                              {currentFlowCard.body.split("\n\n").map((p, i) => (
                                <p key={i} className="text-sm text-[#2C2A25] leading-[1.85] mb-4 last:mb-0 italic">
                                  {p.trim()}
                                </p>
                              ))}
                            </div>
                          </div>

                          <div className="px-6 sm:px-8 pb-6 pt-2 border-t border-[rgba(217,185,130,0.15)]">
                            {/* "Need more?" hint on last card */}
                            {cardIndex >= totalFlowCards - 1 && (
                              <div className="flex items-center justify-center gap-2 mb-3">
                                <button
                                  onClick={() => {
                                    setTutorExpanded(true);
                                    handleSendMessage("Can you explain this topic in more depth with additional examples?");
                                  }}
                                  className="text-xs text-[#0F3D43] hover:text-[#1a5c64] transition-colors"
                                >
                                  Need more detail? Ask the tutor
                                </button>
                              </div>
                            )}
                            <div className="flex items-center justify-between">
                              <button
                                onClick={() => setCardIndex(Math.max(0, cardIndex - 1))}
                                className="flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 rounded-xl text-[#8a7f6f] hover:bg-[#EDE8DF] active:scale-95 transition-all"
                              >
                                <ChevronLeft className="w-4 h-4" />
                                Back
                              </button>
                              <button
                                onClick={() => {
                                  if (cardIndex >= totalFlowCards - 1) setActiveMode(2);
                                  else setCardIndex(cardIndex + 1);
                                }}
                                className="flex items-center gap-1.5 text-sm font-semibold px-5 py-2.5 rounded-xl bg-[#1a1815] text-white shadow-sm hover:shadow-md active:scale-95 transition-all"
                              >
                                {cardIndex >= totalFlowCards - 1 ? <>View Notes <ChevronRight className="w-4 h-4" /></> : <>Next <ChevronRight className="w-4 h-4" /></>}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Keyboard hint — desktop only */}
                      <p className="text-center text-[11px] text-[#8a7f6f] mt-4 hidden sm:block">
                        Use arrow keys to navigate cards
                      </p>
                      {/* Swipe hint — mobile only */}
                      <p className="text-center text-[11px] text-[#8a7f6f] mt-4 sm:hidden">
                        Tap the buttons or dots to navigate
                      </p>
                    </div>
                  );
                })()}

                {/* ═══ MODE 1: PRACTICE (placeholder) ═══ */}
                {activeMode === 1 && (
                  <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-[#EDE8DF] flex items-center justify-center mb-5">
                      <PenTool className="w-8 h-8 text-[#8a7f6f]" />
                    </div>
                    <h2 className="text-lg font-bold text-[#1a1815] mb-2" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                      Practice — Coming Soon
                    </h2>
                    <p className="text-sm text-[#8a7f6f] max-w-sm">
                      AI-generated practice problems based on your lesson. Work through progressively harder questions with guided hints and step-by-step feedback.
                    </p>
                    <button
                      onClick={() => setActiveMode(0)}
                      className="mt-6 text-sm font-medium text-[#1a1815] px-5 py-2.5 rounded-xl border border-[rgba(217,185,130,0.3)] hover:bg-[#FDFCF9] transition-colors"
                    >
                      Back to Cards
                    </button>
                  </div>
                )}

                {/* ═══ MODE 2: NOTES (examples + resources + reference) ═══ */}
                {activeMode === 2 && (
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
                            onClick={() => {
                              setTutorExpanded(true);
                              handleSendMessage(chip);
                            }}
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
                        onClick={() => { setActiveMode(0); setCardIndex(0); }}
                        className="flex items-center gap-1.5 text-sm font-medium text-[#8a7f6f] hover:text-[#1a1815] transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4" /> Back to Cards
                      </button>
                      <Link
                        href={`/lecture/${id}`}
                        className="flex items-center gap-1.5 text-sm font-medium text-[#0F3D43] hover:text-[#1a5c64] transition-colors"
                      >
                        Full Notes <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ PERSISTENT TUTOR COMPOSER BAR ═══ */}
      {learnResult && !learnLoading && (
        <div className="sticky bottom-0 z-40 bg-[#FDFCF9] border-t border-[rgba(217,185,130,0.3)]">
          {/* Expanded conversation area */}
          {tutorExpanded && (
            <div className="max-w-3xl mx-auto px-4 sm:px-6" style={{ maxHeight: "45vh", overflowY: "auto" }}>
              {/* Collapse handle */}
              <div className="sticky top-0 z-10 bg-[#FDFCF9] pt-2 pb-1 flex items-center justify-between border-b border-[rgba(217,185,130,0.15)]">
                <span className="text-[10px] font-bold text-[#8a7f6f] uppercase tracking-widest">Tutor</span>
                <button
                  onClick={() => setTutorExpanded(false)}
                  className="flex items-center gap-1 text-[11px] font-medium text-[#8a7f6f] hover:text-[#1a1815] px-2 py-1 rounded-lg hover:bg-[#EDE8DF] transition-colors"
                  aria-label="Minimize tutor chat"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  Minimize
                </button>
              </div>
              <div className="py-3 space-y-3">
                {chatMessages.length === 0 && !chatLoading && (
                  <div className="text-center py-4">
                    <p className="text-sm text-[#8a7f6f]">Your tutor is ready to help. Ask anything about this lesson.</p>
                  </div>
                )}

                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[#1a1815] text-white rounded-br-md"
                        : "bg-[#EDE8DF] border border-[rgba(217,185,130,0.3)] text-[#2C2A25] rounded-bl-md"
                    }`}>
                      {msg.role === "tutor" ? (
                        <TutorMessageContent content={msg.content} />
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                ))}

                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-[#EDE8DF] border border-[rgba(217,185,130,0.3)] rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-[#8a7f6f] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 bg-[#8a7f6f] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 bg-[#8a7f6f] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </div>
          )}

          {/* Resume conversation bar (shows when minimized with existing messages) */}
          {!tutorExpanded && chatMessages.length > 0 && (
            <div className="max-w-3xl mx-auto px-4 sm:px-6">
              <button
                onClick={() => setTutorExpanded(true)}
                className="w-full flex items-center gap-2 py-2 px-3 text-left hover:bg-[#EDE8DF]/50 rounded-lg transition-colors group"
              >
                <MessageCircle className="w-3.5 h-3.5 text-[#8a7f6f] flex-shrink-0" />
                <span className="text-[11px] text-[#8a7f6f] truncate flex-1">
                  {chatMessages[chatMessages.length - 1]?.role === "tutor" ? "Tutor replied" : "You asked"}: {chatMessages[chatMessages.length - 1]?.content.substring(0, 60)}{chatMessages[chatMessages.length - 1]?.content.length > 60 ? "..." : ""}
                </span>
                <ChevronUp className="w-3.5 h-3.5 text-[#8a7f6f] group-hover:text-[#1a1815] flex-shrink-0" />
                <span className="text-[10px] font-medium text-[#8a7f6f] group-hover:text-[#1a1815] flex-shrink-0">Show</span>
              </button>
            </div>
          )}

          {/* Suggested chips */}
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <div className="flex items-center gap-2 pt-2 pb-1.5 overflow-x-auto">
              <span className="text-[10px] font-bold text-[#8a7f6f] uppercase tracking-wider flex-shrink-0">Suggest:</span>
              {getContextualChips().map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => handleSendMessage(chip.label)}
                  className="text-[11px] font-medium px-3 py-1.5 rounded-lg bg-[#EDE8DF] border border-[rgba(217,185,130,0.3)] text-[#2C2A25] hover:bg-[rgba(217,185,130,0.3)] hover:border-[rgba(217,185,130,0.5)] transition-all whitespace-nowrap flex-shrink-0"
                >
                  {chip.label}
                </button>
              ))}
              {chatMessages.length > 0 && (
                <button
                  onClick={() => { setChatMessages([]); setChatInput(""); setTutorExpanded(false); }}
                  className="text-[10px] font-medium text-[#8a7f6f] hover:text-red-500 px-2 py-1 rounded-lg transition-colors ml-auto flex-shrink-0"
                >
                  Clear
                </button>
              )}
              <span className={`text-[10px] text-[#8a7f6f] ${chatMessages.length === 0 ? "ml-auto" : ""} flex-shrink-0`}>
                Card {cardIndex + 1}/{totalFlowCards}
              </span>
            </div>
          </div>

          {/* Composer input */}
          <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-4 pt-1">
            <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 bg-[#EDE8DF] border border-[rgba(217,185,130,0.3)] rounded-xl px-4 py-2.5 focus-within:border-[#1a1815]/30 focus-within:ring-1 focus-within:ring-[#1a1815]/10 transition-all">
                <Sparkles className="w-4 h-4 text-[#8a7f6f] flex-shrink-0" />
                <input
                  ref={chatInputRef}
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onFocus={() => { if (chatMessages.length > 0) setTutorExpanded(true); }}
                  placeholder={getComposerPlaceholder()}
                  disabled={chatLoading}
                  className="flex-1 bg-transparent text-sm text-[#1a1815] placeholder:text-[#8a7f6f] focus:outline-none disabled:opacity-50"
                />
              </div>
              <button
                type="submit"
                disabled={!chatInput.trim() || chatLoading}
                className="w-10 h-10 rounded-xl bg-[#1a1815] hover:bg-[#2C2A25] disabled:bg-[#EDE8DF] disabled:text-[#8a7f6f] text-white flex items-center justify-center transition-colors flex-shrink-0"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
