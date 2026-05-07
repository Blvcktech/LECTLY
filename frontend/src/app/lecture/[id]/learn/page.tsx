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
  Lightbulb,
  BookMarked,
  Beaker,
  HelpCircle,
  ExternalLink,
  Code,
  MessageCircle,
  Send,
  X,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import {
  getLecture,
  learnMode,
  askTutor,
  type Lecture,
  type LearnResult,
  type NoteSection,
  type TutorMessage,
} from "@/lib/api";

// ── Helper: render inline formatting (bold, inline code) ──
function RenderInline({ text }: { text: string }) {
  // Split on **bold** and `inline code` patterns
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-white">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={i}
              className="px-1.5 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/50 text-[13px] font-mono text-purple-300"
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

  // Detect step-by-step math/calculation patterns
  const isStep = /^(Step \d|Given:|Find:|Formula:|Answer:|Therefore:|Solution:|Result:|Where:)/i.test(trimmed);
  const isCalculation = /^[A-Za-z_]\s*=\s*.+/.test(trimmed) || /^[A-Za-z(].*[=×÷].*\d/.test(trimmed);
  const isBullet = /^[-•]\s/.test(trimmed);
  const isNumberedItem = /^\d+[\.\)]\s/.test(trimmed);

  // Step header (like "Step 1: Find the force")
  if (isStep) {
    return (
      <div key={index} className="flex items-start gap-3 my-2">
        <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-2 flex-shrink-0" />
        <p className="text-sm font-semibold text-white leading-relaxed">
          <RenderInline text={trimmed} />
        </p>
      </div>
    );
  }

  // Calculation/formula line
  if (isCalculation) {
    return (
      <div key={index} className="my-2 mx-4 bg-slate-900/60 border border-slate-700/40 rounded-lg px-4 py-2">
        <code className="text-[13px] text-green-300 font-mono">
          {trimmed}
        </code>
      </div>
    );
  }

  // Bullet point
  if (isBullet) {
    const bulletText = trimmed.replace(/^[-•]\s*/, "");
    return (
      <div key={index} className="flex items-start gap-2 my-1 ml-2">
        <span className="text-purple-400 mt-0.5 flex-shrink-0">•</span>
        <p className="text-sm text-slate-200 leading-relaxed">
          <RenderInline text={bulletText} />
        </p>
      </div>
    );
  }

  // Numbered item
  if (isNumberedItem) {
    const match = trimmed.match(/^(\d+[\.\)])\s*(.*)/);
    return (
      <div key={index} className="flex items-start gap-2 my-1 ml-2">
        <span className="text-purple-400 font-mono text-xs mt-0.5 flex-shrink-0 min-w-[1.2rem]">
          {match?.[1]}
        </span>
        <p className="text-sm text-slate-200 leading-relaxed">
          <RenderInline text={match?.[2] || trimmed} />
        </p>
      </div>
    );
  }

  // Normal paragraph
  return (
    <p key={index} className="text-sm text-slate-200 leading-[1.85] mb-4 last:mb-0">
      <RenderInline text={trimmed} />
    </p>
  );
}

// ── Helper: render body text with code blocks, math, and formatting ──
function RenderBody({ text }: { text: string }) {
  // Split on triple-backtick code blocks
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          // Extract language hint and code
          const lines = part.slice(3, -3).split("\n");
          const lang = lines[0]?.trim() || "";
          const code = lang ? lines.slice(1).join("\n") : lines.join("\n");

          return (
            <div key={i} className="my-5 rounded-xl overflow-hidden border border-slate-700/60 shadow-lg shadow-black/10">
              {/* Language header bar */}
              <div className="bg-slate-700/60 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {lang || "code"}
                  </span>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(code.trim())}
                  className="text-[10px] font-medium text-slate-500 hover:text-white px-2 py-0.5 rounded hover:bg-slate-600/50 transition-colors"
                >
                  Copy
                </button>
              </div>
              {/* Code content */}
              <pre className="bg-[#0D1117] px-5 py-4 overflow-x-auto">
                <code className="text-[13px] text-green-300 leading-[1.7] font-mono whitespace-pre">
                  {code.trim()}
                </code>
              </pre>
            </div>
          );
        }

        // Regular text — split by double newlines into paragraphs
        return part.split(/\n\n+/).map((paragraph, j) => {
          const trimmed = paragraph.trim();
          if (!trimmed) return null;

          // Auto-detect code that wasn't wrapped in backticks by the LLM
          // Only trigger when MOST lines look like code (not prose that mentions keywords)
          const codeLinePattern = /^[\s]*(public |private |class |import |int |String |void |System\.|for\s*\(|if\s*\(|while\s*\(|return |var |let |const |function |def |print\(|console\.|#include|using namespace|\}|else\s*\{|try\s*\{|catch\s*\()/;
          const allLines = trimmed.split("\n");
          const hasMultipleCodeLines = allLines.length >= 3;
          const codeLineCount = allLines.filter((l: string) => codeLinePattern.test(l)).length;
          const codeLineRatio = allLines.length > 0 ? codeLineCount / allLines.length : 0;
          // At least 50% of lines must look like code AND must have braces/semicolons
          const looksLikeCode = hasMultipleCodeLines && codeLineRatio >= 0.5 && (trimmed.includes(";") || trimmed.includes("{")) && !/^[A-Z].*\.\s/.test(trimmed);

          if (looksLikeCode) {
            // Detect language from patterns
            let detectedLang = "code";
            if (/System\.out|public class|private |void /.test(trimmed)) detectedLang = "java";
            else if (/console\.|const |let |=>/.test(trimmed)) detectedLang = "javascript";
            else if (/def |print\(|import /.test(trimmed) && !trimmed.includes(";")) detectedLang = "python";
            else if (/#include|using namespace|cout/.test(trimmed)) detectedLang = "cpp";

            return (
              <div key={`${i}-${j}`} className="my-5 rounded-xl overflow-hidden border border-slate-700/60 shadow-lg shadow-black/10">
                <div className="bg-slate-700/60 px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{detectedLang}</span>
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(trimmed)}
                    className="text-[10px] font-medium text-slate-500 hover:text-white px-2 py-0.5 rounded hover:bg-slate-600/50 transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <pre className="bg-[#0D1117] px-5 py-4 overflow-x-auto">
                  <code className="text-[13px] text-green-300 leading-[1.7] font-mono whitespace-pre">
                    {trimmed}
                  </code>
                </pre>
              </div>
            );
          }

          // Check if this paragraph contains a mix of lines (steps, calculations, text)
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

          // Single line — render as formatted paragraph
          return <RenderParagraph key={`${i}-${j}`} text={trimmed} index={`${i}-${j}`} />;
        });
      })}
    </>
  );
}

export default function LearnModePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Learn Mode state
  const [selectedSection, setSelectedSection] = useState<number | null>(null);
  const [learnLevel, setLearnLevel] = useState("intermediate");
  const [learnResult, setLearnResult] = useState<LearnResult | null>(null);
  const [learnLoading, setLearnLoading] = useState(false);

  // Quiz state
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizRevealed, setQuizRevealed] = useState<Record<number, boolean>>({});
  const [quizScore, setQuizScore] = useState<number | null>(null);

  // Reteach state — triggered when student gets a quiz answer wrong
  const [reteachIndex, setReteachIndex] = useState<number | null>(null);
  const [reteachText, setReteachText] = useState<string>("");
  const [reteachLoading, setReteachLoading] = useState(false);

  // Active teaching tab
  const [activeStep, setActiveStep] = useState(0);

  // Bite-sized card navigation for Lesson tab
  const [lessonCardIndex, setLessonCardIndex] = useState(0);

  // Ask Tutor chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<TutorMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const [autoStarted, setAutoStarted] = useState(false);

  useEffect(() => {
    async function fetchLecture() {
      try {
        const data = await getLecture(id);
        setLecture(data);
      } catch {
        setError("Could not load lecture.");
      } finally {
        setLoading(false);
      }
    }
    fetchLecture();
  }, [id]);

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

  // Keyboard navigation for lesson cards
  useEffect(() => {
    if (activeStep !== 0 || !learnResult) return;
    const totalCards = learnResult.explanation.length;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture keys when typing in chat input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setLessonCardIndex((prev) => Math.min(prev + 1, totalCards - 1));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setLessonCardIndex((prev) => Math.max(prev - 1, 0));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeStep, learnResult]);

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, chatLoading]);

  // Focus chat input when chat opens
  useEffect(() => {
    if (chatOpen && chatInputRef.current) {
      chatInputRef.current.focus();
    }
  }, [chatOpen]);

  const handleSendMessage = async (message?: string) => {
    const text = message || chatInput.trim();
    if (!text || chatLoading) return;

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
        selectedSection !== null && selectedSection >= 0 ? selectedSection : undefined
      );
      setChatMessages((prev) => [
        ...prev,
        { role: "tutor", content: result.answer },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "tutor",
          content: "Sorry, I couldn't process that. Please try again.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const quickChips = [
    { label: "Explain differently", icon: "🔄" },
    { label: "Why does this matter?", icon: "🤔" },
    { label: "Give me an example", icon: "💡" },
    { label: "Solve step by step", icon: "📝" },
  ];

  const handleReteach = async (questionIndex: number) => {
    if (!learnResult || reteachLoading) return;
    const q = learnResult.quiz[questionIndex];
    if (!q) return;

    setReteachIndex(questionIndex);
    setReteachLoading(true);
    setReteachText("");

    const studentPick = q.options[quizAnswers[questionIndex]] || "unknown";
    const correctAnswer = q.options[q.correct_index];
    const prompt = `I just got this quiz question wrong and need help understanding it.\n\nQuestion: "${q.question}"\nI picked: "${studentPick}"\nCorrect answer: "${correctAnswer}"\n\nExplain why my answer is wrong and why the correct answer is right. Use a different angle or analogy than the original explanation. Keep it short and clear.`;

    try {
      const result = await askTutor(
        id,
        prompt,
        [],
        selectedSection !== null && selectedSection >= 0 ? selectedSection : undefined
      );
      setReteachText(result.answer);
    } catch {
      setReteachText("Sorry, I couldn't generate a re-explanation right now. Try asking in the tutor chat.");
    } finally {
      setReteachLoading(false);
    }
  };

  const handleStartLearn = async (sectionIndex: number) => {
    if (learnLoading) return; // Prevent double-clicks
    setSelectedSection(sectionIndex);
    setLearnLoading(true);
    setLearnResult(null);
    setError("");
    setQuizAnswers({});
    setQuizRevealed({});
    setQuizScore(null);
    setReteachIndex(null);
    setReteachText("");
    setReteachLoading(false);
    setActiveStep(0);
    setLessonCardIndex(0);
    try {
      const result = await learnMode(id, learnLevel, sectionIndex);
      setLearnResult(result);
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

    // Calculate score if all questions answered
    if (learnResult?.quiz) {
      const totalQs = learnResult.quiz.length;
      const answeredCount = Object.keys(newAnswers).length;
      if (answeredCount === totalQs) {
        let correct = 0;
        for (let i = 0; i < totalQs; i++) {
          if (newAnswers[i] === learnResult.quiz[i].correct_index) correct++;
        }
        setQuizScore(correct);
      }
    }
  };

  const sections: NoteSection[] = lecture?.notes?.sections || [];
  const steps = ["explanation", "analogy", "examples", "quiz", "resources"];
  const stepLabels = ["Lesson", "Analogy", "Examples", "Quiz", "Resources"];
  const stepIcons = [BookMarked, Lightbulb, Beaker, HelpCircle, ExternalLink];

  // ── Chat button helper (rendered in ALL states) ──
  const chatButton = (
    <>
      <button
        onClick={() => setChatOpen(!chatOpen)}
        className={`fixed bottom-6 right-6 z-[60] w-14 h-14 rounded-full text-white shadow-lg flex items-center justify-center transition-all duration-200 group ${
          chatOpen
            ? "bg-slate-700 hover:bg-slate-600 shadow-black/30 scale-90"
            : "bg-gradient-to-br from-purple-600 to-blue-600 shadow-purple-500/30 hover:scale-105"
        }`}
        aria-label={chatOpen ? "Close tutor chat" : "Ask your tutor"}
      >
        {chatOpen ? (
          <ChevronUp className="w-5 h-5" />
        ) : (
          <MessageCircle className="w-6 h-6" />
        )}
        {!chatOpen && (
          <span className="absolute -top-10 right-0 bg-slate-800 text-white text-xs font-medium px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg border border-slate-700/60 pointer-events-none">
            Ask your tutor
          </span>
        )}
        {!chatOpen && chatMessages.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-[#0F172A] animate-pulse" />
        )}
      </button>

      {chatOpen && (
        <div className="fixed bottom-0 right-0 z-50 w-full sm:w-[420px] sm:right-6 sm:bottom-[88px] flex flex-col bg-[#0F172A] border border-slate-700/60 sm:rounded-2xl shadow-2xl shadow-black/40 overflow-hidden"
          style={{ maxHeight: "min(550px, 65vh)" }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60 bg-slate-800/50 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white leading-tight">Ask Tutor</p>
                <p className="text-[10px] text-slate-400">
                  {selectedSection !== null && selectedSection >= 0 && sections[selectedSection]
                    ? `Viewing: ${sections[selectedSection].heading}`
                    : "Ask anything about your lecture"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {chatMessages.length > 0 && (
                <button
                  onClick={() => { setChatMessages([]); setChatInput(""); }}
                  className="text-slate-500 hover:text-slate-300 text-[10px] font-medium px-2 py-1 rounded-lg hover:bg-slate-700/50 transition-colors"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setChatOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
            {chatMessages.length === 0 && !chatLoading && (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-3">
                  <MessageCircle className="w-6 h-6 text-purple-400" />
                </div>
                <p className="text-sm font-medium text-white mb-1">Your AI tutor is here</p>
                <p className="text-xs text-slate-400 max-w-[260px] mx-auto leading-relaxed">
                  Ask anything about your lecture — explanations, examples, practice problems, or clarifications.
                </p>
              </div>
            )}

            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-purple-600 text-white rounded-br-md"
                    : "bg-slate-800/80 border border-slate-700/50 text-slate-200 rounded-bl-md"
                }`}>
                  {msg.role === "tutor" ? (
                    <div className="space-y-2">
                      {msg.content.split(/(```[\s\S]*?```)/g).map((block, bi) => {
                        if (block.startsWith("```")) {
                          const lines = block.slice(3, -3).split("\n");
                          const lang = lines[0]?.trim() || "";
                          const code = lang ? lines.slice(1).join("\n") : lines.join("\n");
                          return (
                            <div key={bi} className="my-2 rounded-lg overflow-hidden border border-slate-600/50">
                              {lang && (
                                <div className="bg-slate-700/60 px-3 py-1 flex items-center gap-1.5">
                                  <Code className="w-3 h-3 text-slate-400" />
                                  <span className="text-[9px] font-bold text-slate-400 uppercase">{lang}</span>
                                </div>
                              )}
                              <pre className="bg-[#0D1117] px-3 py-2.5 overflow-x-auto">
                                <code className="text-[12px] text-green-300 leading-[1.6] font-mono whitespace-pre">{code.trim()}</code>
                              </pre>
                            </div>
                          );
                        }
                        return block.split("\n\n").map((paragraph, pi) => {
                          const trimmed = paragraph.trim();
                          if (!trimmed) return null;
                          const renderInline = (text: string) => {
                            const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
                            return parts.map((part, idx) => {
                              if (part.startsWith("**") && part.endsWith("**")) return <strong key={idx} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
                              if (part.startsWith("`") && part.endsWith("`")) return <code key={idx} className="px-1 py-0.5 rounded bg-slate-700/60 text-[11px] font-mono text-purple-300">{part.slice(1, -1)}</code>;
                              return <span key={idx}>{part}</span>;
                            });
                          };
                          if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
                            return (<div key={`${bi}-${pi}`} className="pl-1">{trimmed.split("\n").map((line, li) => {
                              const bulletText = line.replace(/^[-•]\s*/, "");
                              return <p key={li} className="text-sm leading-relaxed mb-1 flex gap-2"><span className="text-purple-400 flex-shrink-0">•</span><span>{renderInline(bulletText)}</span></p>;
                            })}</div>);
                          }
                          if (/^(Step \d|Given:|Formula:|Answer:)/i.test(trimmed)) return <p key={`${bi}-${pi}`} className="text-sm leading-relaxed font-semibold text-white">{renderInline(trimmed)}</p>;
                          if (/^[A-Za-z_]\s*=\s*.+/.test(trimmed)) return <div key={`${bi}-${pi}`} className="bg-slate-700/40 rounded px-3 py-1.5 my-1"><code className="text-[12px] text-green-300 font-mono">{trimmed}</code></div>;
                          return <p key={`${bi}-${pi}`} className="text-sm leading-relaxed">{renderInline(trimmed)}</p>;
                        });
                      })}
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {chatMessages.length === 0 && !chatLoading && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
              {quickChips.map((chip) => (
                <button key={chip.label} onClick={() => handleSendMessage(chip.label)}
                  className="text-xs font-medium px-3 py-1.5 rounded-full bg-slate-800/60 border border-slate-700/50 text-slate-300 hover:text-white hover:border-purple-500/40 hover:bg-purple-500/10 transition-all"
                >{chip.icon} {chip.label}</button>
              ))}
            </div>
          )}

          <div className="border-t border-slate-700/60 px-3 py-3 bg-slate-800/30 flex-shrink-0">
            <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex items-center gap-2">
              <input ref={chatInputRef} type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask your tutor anything..." disabled={chatLoading}
                className="flex-1 bg-slate-900/60 border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 disabled:opacity-50 transition-colors"
              />
              <button type="submit" disabled={!chatInput.trim() || chatLoading}
                className="w-10 h-10 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white flex items-center justify-center transition-colors flex-shrink-0"
              ><Send className="w-4 h-4" /></button>
            </form>
          </div>
        </div>
      )}
    </>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F4EE] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
        {chatButton}
      </div>
    );
  }

  if (error && !lecture) {
    return (
      <div className="min-h-screen bg-[#F7F4EE] flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-[#1a1815] font-medium mb-2">Error</p>
          <p className="text-[#8a7f6f] text-sm mb-6">{error}</p>
          <Link href={`/lecture/${id}`} className="text-purple-600 hover:text-purple-700 text-sm">
            Back to Notes
          </Link>
        </div>
        {chatButton}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F4EE]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-[rgba(217,185,130,0.25)] bg-[#FDFCF9]/92 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/lecture/${id}`} className="text-[#8a7f6f] hover:text-[#1a1815] transition-colors flex items-center gap-2">
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm hidden sm:inline">Back to Notes</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-md shadow-purple-500/15">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-[#1a1815] tracking-tight" style={{ fontFamily: "'Georgia', serif" }}>Learn Mode</span>
          </div>
          <div className="w-24" />
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* Left: Topic Picker */}
          <div className="w-80 flex-shrink-0 hidden lg:block">
            <div className="sticky top-20">
              <h2 className="text-sm font-semibold text-[#8a7f6f] uppercase tracking-wider mb-3">
                Choose a Topic
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
                        ? "bg-purple-600 text-white shadow-md"
                        : "text-[#8a7f6f] hover:text-[#1a1815]"
                    } ${learnLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {level}
                  </button>
                ))}
              </div>

              {/* Section list */}
              <div className="space-y-2">
                {sections.map((section, i) => (
                  <button
                    key={i}
                    onClick={() => handleStartLearn(i)}
                    disabled={learnLoading}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all group ${
                      selectedSection === i
                        ? "bg-purple-500/8 border-purple-400/40 shadow-sm"
                        : "bg-[#FDFCF9] border-[rgba(217,185,130,0.25)] hover:border-[rgba(217,185,130,0.5)]"
                    } ${learnLoading ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${
                        selectedSection === i ? "text-purple-700" : "text-[#2C2A25] group-hover:text-[#1a1815]"
                      }`}>
                        {section.heading}
                      </span>
                      {learnLoading && selectedSection === i ? (
                        <Loader2 className="w-4 h-4 text-purple-500 animate-spin flex-shrink-0" />
                      ) : (
                        <ChevronRight className={`w-4 h-4 flex-shrink-0 ${
                          selectedSection === i ? "text-purple-500" : "text-[#8a7f6f] group-hover:text-[#2C2A25]"
                        }`} />
                      )}
                    </div>
                    {section.key_points.length > 0 && (
                      <p className="text-[11px] text-[#8a7f6f] mt-1 line-clamp-1">
                        {section.key_points[0]}
                      </p>
                    )}
                  </button>
                ))}

                {/* Full lecture option */}
                <button
                  onClick={() => handleStartLearn(-1)}
                  disabled={learnLoading}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all group ${
                    selectedSection === -1
                      ? "bg-purple-500/8 border-purple-400/40 shadow-sm"
                      : "bg-[#FDFCF9] border-[rgba(217,185,130,0.25)] hover:border-[rgba(217,185,130,0.5)]"
                  } ${learnLoading ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${
                      selectedSection === -1 ? "text-purple-700" : "text-[#2C2A25]"
                    }`}>
                      Full Lecture Overview
                    </span>
                    {learnLoading && selectedSection === -1 ? (
                      <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
                    ) : (
                      <BookOpen className="w-4 h-4 text-[#8a7f6f]" />
                    )}
                  </div>
                  <p className="text-[11px] text-[#8a7f6f] mt-1">
                    Learn all topics from this lecture
                  </p>
                </button>
              </div>
            </div>
          </div>

          {/* Right: Lesson Content */}
          <div className="flex-1 min-w-0">
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
                        ? "bg-purple-600 text-white shadow-md"
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
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-20 h-20 rounded-2xl bg-purple-500/8 border border-purple-400/20 flex items-center justify-center mb-6">
                  <GraduationCap className="w-10 h-10 text-purple-500" />
                </div>
                <h2 className="text-xl font-bold text-[#1a1815] mb-2" style={{ fontFamily: "'Georgia', serif" }}>
                  Ready to Learn?
                </h2>
                <p className="text-sm text-[#8a7f6f] max-w-md">
                  Pick a topic from the list and your AI tutor will teach it to you
                  step by step — with examples, analogies, and a quiz to test your understanding.
                </p>
              </div>
            )}

            {/* Loading */}
            {learnLoading && (
              <div className="flex flex-col items-center justify-center py-24">
                <div className="relative mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center animate-pulse">
                    <GraduationCap className="w-8 h-8 text-white" />
                  </div>
                  <Loader2 className="w-6 h-6 text-purple-300 animate-spin absolute -bottom-1 -right-1" />
                </div>
                <h3 className="text-lg font-semibold text-[#1a1815] mb-1" style={{ fontFamily: "'Georgia', serif" }}>
                  Preparing Your Lesson...
                </h3>
                <p className="text-sm text-[#8a7f6f]">
                  Your AI tutor is building a personalized lesson for you
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
                  className="text-sm text-purple-400 hover:text-purple-300 font-medium"
                >
                  Try again
                </button>
              </div>
            )}

            {/* Lesson Content */}
            {learnResult && !learnLoading && (
              <div>
                {/* Topic Header */}
                <div className="mb-6">
                  <span className="text-[10px] font-bold text-purple-600 uppercase tracking-widest">
                    {learnLevel} Level
                  </span>
                  <h1 className="text-2xl font-bold text-[#1a1815] mt-1" style={{ fontFamily: "'Georgia', serif" }}>
                    {learnResult.topic}
                  </h1>
                </div>

                {/* Tab navigation */}
                <div className="flex gap-1 bg-[#EDE8DF] rounded-xl p-1 mb-6 overflow-x-auto">
                  {steps.map((step, i) => {
                    const Icon = stepIcons[i];
                    return (
                      <button
                        key={step}
                        onClick={() => setActiveStep(i)}
                        className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-lg transition-all whitespace-nowrap ${
                          activeStep === i
                            ? "bg-purple-600 text-white shadow-md"
                            : "text-[#8a7f6f] hover:text-[#1a1815] hover:bg-[#FDFCF9]"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {stepLabels[i]}
                      </button>
                    );
                  })}
                </div>

                {/* ═══ Tab 0: Lesson (Bite-sized Cards) ═══ */}
                {activeStep === 0 && (() => {
                  const cards = learnResult.explanation;
                  const totalCards = cards.length;
                  const currentCard = cards[lessonCardIndex] || cards[0];
                  const isFirst = lessonCardIndex === 0;
                  const isLast = lessonCardIndex >= totalCards - 1;

                  return (
                    <div className="space-y-5">
                      {/* Progress dots */}
                      <div className="flex items-center justify-center gap-2">
                        {cards.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setLessonCardIndex(i)}
                            className={`transition-all duration-300 rounded-full ${
                              i === lessonCardIndex
                                ? "w-8 h-2.5 bg-gradient-to-r from-purple-500 to-blue-500"
                                : i < lessonCardIndex
                                ? "w-2.5 h-2.5 bg-purple-400/60"
                                : "w-2.5 h-2.5 bg-slate-600/60"
                            }`}
                            aria-label={`Go to card ${i + 1}`}
                          />
                        ))}
                        <span className="ml-3 text-[11px] font-medium text-slate-500">
                          {lessonCardIndex + 1} / {totalCards}
                        </span>
                      </div>

                      {/* Card */}
                      <div
                        key={lessonCardIndex}
                        className="relative bg-gradient-to-b from-[#FBF8F1] to-[#F5F0E6] border border-amber-200/40 rounded-2xl shadow-lg shadow-amber-900/5 overflow-hidden"
                        style={{ animation: "fadeSlideIn 0.3s ease-out" }}
                      >
                        {/* Card header accent */}
                        <div className="h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500" />

                        <div className="p-6 sm:p-8">
                          {/* Card number + subtitle */}
                          <div className="flex items-start gap-3 mb-5">
                            <span className="w-9 h-9 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-sm font-bold text-purple-700 flex-shrink-0">
                              {lessonCardIndex + 1}
                            </span>
                            <div>
                              {currentCard.subtitle && (
                                <h2 className="text-lg font-bold text-[#1a1815] leading-snug" style={{ fontFamily: "'Georgia', serif" }}>
                                  {currentCard.subtitle}
                                </h2>
                              )}
                              <p className="text-[11px] text-amber-700/60 font-medium mt-0.5">
                                Concept {lessonCardIndex + 1} of {totalCards}
                              </p>
                            </div>
                          </div>

                          {/* Card body — Direction A warm styling */}
                          <div className="prose max-w-none lesson-card-body">
                            <style>{`
                              .lesson-card-body p { color: #2C2A25; }
                              .lesson-card-body strong { color: #1a1815; }
                              .lesson-card-body code:not(pre code) {
                                background: rgba(217, 185, 130, 0.2);
                                color: #7c5c1f;
                                border-radius: 6px;
                                padding: 2px 6px;
                                font-size: 13px;
                              }
                              .lesson-card-body .text-white { color: #1a1815 !important; }
                              .lesson-card-body .text-slate-200,
                              .lesson-card-body .text-slate-300 { color: #2C2A25 !important; }
                              .lesson-card-body .text-purple-300 { color: #7c5c1f !important; }
                              .lesson-card-body .text-purple-400 { color: #a07d3a !important; }
                              .lesson-card-body .text-green-300 { color: #22c55e !important; }
                              .lesson-card-body .bg-slate-800\\/80,
                              .lesson-card-body .bg-slate-900\\/60 {
                                background: rgba(26, 24, 21, 0.06) !important;
                                border-color: rgba(217, 185, 130, 0.3) !important;
                              }
                              .lesson-card-body .bg-\\[\\#0D1117\\] {
                                background: #1a1a2e !important;
                              }
                              .lesson-card-body .border-slate-700\\/60,
                              .lesson-card-body .border-slate-700\\/40 {
                                border-color: rgba(217, 185, 130, 0.3) !important;
                              }
                              .lesson-card-body .bg-slate-700\\/60 {
                                background: rgba(26, 24, 21, 0.08) !important;
                              }
                              .lesson-card-body .text-slate-400 { color: #8a7f6f !important; }
                              .lesson-card-body .text-slate-500 { color: #8a7f6f !important; }
                              @keyframes fadeSlideIn {
                                from { opacity: 0; transform: translateX(16px); }
                                to   { opacity: 1; transform: translateX(0); }
                              }
                            `}</style>
                            <RenderBody text={currentCard.body} />
                          </div>
                        </div>

                        {/* Card navigation footer */}
                        <div className="px-6 sm:px-8 pb-6 pt-2 flex items-center justify-between">
                          <button
                            onClick={() => setLessonCardIndex(Math.max(0, lessonCardIndex - 1))}
                            disabled={isFirst}
                            className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 rounded-xl transition-all ${
                              isFirst
                                ? "text-amber-400/40 cursor-not-allowed"
                                : "text-amber-800 hover:bg-amber-100/60 active:scale-95"
                            }`}
                          >
                            <ChevronLeft className="w-4 h-4" />
                            Back
                          </button>

                          <button
                            onClick={() => {
                              if (isLast) {
                                setActiveStep(1); // Move to Analogy
                              } else {
                                setLessonCardIndex(lessonCardIndex + 1);
                              }
                            }}
                            className="flex items-center gap-1.5 text-sm font-semibold px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md shadow-purple-500/20 hover:shadow-lg hover:shadow-purple-500/30 active:scale-95 transition-all"
                          >
                            {isLast ? (
                              <>Next: Analogy <ChevronRight className="w-4 h-4" /></>
                            ) : (
                              <>I got it <ChevronRight className="w-4 h-4" /></>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Keyboard hint */}
                      <p className="text-center text-[11px] text-slate-600">
                        Use arrow keys or swipe to navigate cards
                      </p>
                    </div>
                  );
                })()}

                {/* ═══ Tab 1: Analogy ═══ */}
                {activeStep === 1 && (
                  <div className="bg-gradient-to-b from-[#FBF8F1] to-[#F5F0E6] border border-amber-200/40 rounded-2xl p-6 sm:p-8">
                    <div className="flex items-center gap-2 mb-4">
                      <Lightbulb className="w-5 h-5 text-amber-600" />
                      <h2 className="text-lg font-bold text-[#1a1815]" style={{ fontFamily: "'Georgia', serif" }}>Real-World Analogy</h2>
                    </div>
                    <div className="prose max-w-none">
                      {learnResult.analogy.split("\n\n").map((p, i) => (
                        <p key={i} className="text-sm text-[#2C2A25] leading-[1.85] mb-4 last:mb-0 italic">
                          {p.trim()}
                        </p>
                      ))}
                    </div>
                    <div className="mt-6 pt-4 border-t border-amber-200/30 flex justify-between">
                      <button
                        onClick={() => setActiveStep(0)}
                        className="flex items-center gap-1.5 text-sm font-medium text-[#8a7f6f] hover:text-[#1a1815] transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4" /> Lesson
                      </button>
                      <button
                        onClick={() => setActiveStep(2)}
                        className="flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
                      >
                        Next: Examples <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ═══ Tab 2: Examples ═══ */}
                {activeStep === 2 && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Beaker className="w-5 h-5 text-blue-600" />
                      <h2 className="text-lg font-bold text-[#1a1815]" style={{ fontFamily: "'Georgia', serif" }}>Worked Examples</h2>
                    </div>
                    <div className="space-y-5">
                      {learnResult.examples.map((example, i) => {
                        const problemText = example.problem || example.description || "";
                        const solutionText = example.solution || "";

                        return (
                          <div
                            key={i}
                            className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-xl overflow-hidden"
                          >
                            {/* Example header */}
                            <div className="px-5 pt-5 pb-3 flex items-start gap-3">
                              <span className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-sm font-bold text-blue-600 flex-shrink-0">{i + 1}</span>
                              <h3 className="text-sm font-semibold text-[#1a1815] pt-1">{example.title}</h3>
                            </div>

                            {/* Problem */}
                            {problemText && (
                              <div className="mx-5 mb-3 p-4 bg-slate-900/40 border border-slate-700/30 rounded-xl">
                                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Problem</p>
                                <p className="text-sm text-slate-200 leading-relaxed">{problemText}</p>
                              </div>
                            )}

                            {/* Solution */}
                            {solutionText && (
                              <div className="mx-5 mb-4 p-4 bg-green-500/[0.04] border border-green-500/15 rounded-xl">
                                <p className="text-[10px] font-bold text-green-400 uppercase tracking-widest mb-3">Solution</p>
                                <div className="space-y-2">
                                  {solutionText.split("\n").map((line, li) => {
                                    const trimmed = line.trim();
                                    if (!trimmed) return <div key={li} className="h-2" />;

                                    // Detect step headers (Step 1:, Step 2:, etc.)
                                    const isStep = /^(Step \d|Given:|Find:|Formula:|Answer:|Therefore:)/i.test(trimmed);
                                    // Detect calculation/formula lines
                                    const isCalc = /[=×÷]/.test(trimmed) && /\d/.test(trimmed);

                                    if (isStep) {
                                      return (
                                        <p key={li} className="text-sm font-semibold text-white mt-1">
                                          {trimmed}
                                        </p>
                                      );
                                    }

                                    if (isCalc) {
                                      return (
                                        <div key={li} className="bg-slate-900/60 border border-slate-700/40 rounded-lg px-4 py-2 my-1">
                                          <code className="text-[13px] text-green-300 font-mono">{trimmed}</code>
                                        </div>
                                      );
                                    }

                                    return (
                                      <p key={li} className="text-sm text-slate-300 leading-relaxed">{trimmed}</p>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Code block (for programming examples) */}
                            {example.code && (
                              <div className="border-t border-slate-700/40">
                                <pre className="bg-slate-900/80 px-5 py-4 overflow-x-auto">
                                  <code className="text-[13px] text-green-300 leading-relaxed font-mono whitespace-pre">
                                    {example.code}
                                  </code>
                                </pre>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-6 flex justify-between">
                      <button
                        onClick={() => setActiveStep(1)}
                        className="flex items-center gap-1.5 text-sm font-medium text-[#8a7f6f] hover:text-[#1a1815] transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4" /> Analogy
                      </button>
                      <button
                        onClick={() => setActiveStep(3)}
                        className="flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
                      >
                        Next: Quiz <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ═══ Tab 3: Quiz ═══ */}
                {activeStep === 3 && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <HelpCircle className="w-5 h-5 text-green-600" />
                        <h2 className="text-lg font-bold text-[#1a1815]" style={{ fontFamily: "'Georgia', serif" }}>Test Your Understanding</h2>
                      </div>
                      {quizScore !== null && (
                        <span className={`text-sm font-bold px-3 py-1 rounded-lg ${
                          quizScore === learnResult.quiz.length
                            ? "bg-green-500/15 text-green-400"
                            : quizScore >= learnResult.quiz.length / 2
                            ? "bg-yellow-500/15 text-yellow-400"
                            : "bg-red-500/15 text-red-400"
                        }`}>
                          {quizScore}/{learnResult.quiz.length} correct
                        </span>
                      )}
                    </div>
                    <div className="space-y-4">
                      {learnResult.quiz.map((q, qi) => (
                        <div
                          key={qi}
                          className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-xl p-5"
                        >
                          <p className="text-sm text-[#1a1815] font-semibold mb-3">
                            <span className="text-purple-600 mr-1.5">Q{qi + 1}.</span>
                            {q.question}
                          </p>
                          <div className="space-y-2">
                            {q.options.map((opt, oi) => {
                              const isSelected = quizAnswers[qi] === oi;
                              const isRevealed = quizRevealed[qi];
                              const isCorrect = oi === q.correct_index;

                              let style = "border-[rgba(217,185,130,0.3)] text-[#2C2A25] hover:border-purple-400/40 hover:bg-purple-500/5";
                              if (isRevealed) {
                                if (isCorrect) {
                                  style = "border-green-400/50 bg-green-50 text-green-800";
                                } else if (isSelected && !isCorrect) {
                                  style = "border-red-400/50 bg-red-50 text-red-600 line-through";
                                } else {
                                  style = "border-[rgba(217,185,130,0.2)] text-[#8a7f6f]";
                                }
                              } else if (isSelected) {
                                style = "border-purple-400/50 bg-purple-50 text-purple-700";
                              }

                              return (
                                <button
                                  key={oi}
                                  onClick={() => selectQuizAnswer(qi, oi)}
                                  disabled={isRevealed}
                                  className={`w-full flex items-center gap-3 text-left text-sm p-3.5 rounded-xl border transition-all ${style}`}
                                >
                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                    isRevealed && isCorrect ? "border-green-400" :
                                    isRevealed && isSelected ? "border-red-400" :
                                    isSelected ? "border-purple-400" : "border-slate-500"
                                  }`}>
                                    {isRevealed && isCorrect && <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />}
                                    {isRevealed && isSelected && !isCorrect && <XCircle className="w-3.5 h-3.5 text-red-400" />}
                                    {!isRevealed && isSelected && <div className="w-2.5 h-2.5 rounded-full bg-purple-400" />}
                                  </div>
                                  <span>{opt}</span>
                                </button>
                              );
                            })}
                          </div>
                          {/* Correct answer feedback */}
                          {quizRevealed[qi] && quizAnswers[qi] === q.correct_index && (
                            <div className="mt-3 p-3 rounded-lg text-xs leading-relaxed bg-green-500/[0.07] text-green-300 border border-green-500/20">
                              Correct! {q.explanation}
                            </div>
                          )}

                          {/* Wrong answer — reteach flow (Direction A style) */}
                          {quizRevealed[qi] && quizAnswers[qi] !== q.correct_index && (
                            <div className="mt-4 space-y-3">
                              {/* Brief explanation */}
                              <div className="p-3 rounded-lg text-xs leading-relaxed bg-red-500/[0.07] text-red-300 border border-red-500/20">
                                Not quite. {q.explanation}
                              </div>

                              {/* Reteach card — warm paper style */}
                              {reteachIndex === qi && (reteachLoading || reteachText) ? (
                                <div className="rounded-xl overflow-hidden border border-amber-500/20 bg-gradient-to-b from-[#FBF8F1] to-[#F5F0E6]">
                                  <div className="px-4 py-2 flex items-center gap-2">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">
                                      Let&apos;s try that differently
                                    </span>
                                  </div>
                                  <div className="px-4 pb-4">
                                    {reteachLoading ? (
                                      <div className="flex items-center gap-2 py-3">
                                        <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
                                        <span className="text-sm text-amber-800">Thinking of a better way to explain this...</span>
                                      </div>
                                    ) : (
                                      <div className="space-y-2">
                                        {reteachText.split(/(```[\s\S]*?```)/g).map((block, bi) => {
                                          if (block.startsWith("```")) {
                                            const lines = block.slice(3, -3).split("\n");
                                            const lang = lines[0]?.trim() || "";
                                            const code = lang ? lines.slice(1).join("\n") : lines.join("\n");
                                            return (
                                              <div key={bi} className="my-2 rounded-lg overflow-hidden border border-amber-300/40">
                                                <pre className="bg-[#1a1a1a] px-3 py-2.5 overflow-x-auto">
                                                  <code className="text-[12px] text-green-300 leading-[1.6] font-mono whitespace-pre">{code.trim()}</code>
                                                </pre>
                                              </div>
                                            );
                                          }
                                          return block.split("\n\n").map((p, pi) => {
                                            const trimmed = p.trim();
                                            if (!trimmed) return null;
                                            // Render bold and inline code
                                            const parts = trimmed.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
                                            return (
                                              <p key={`${bi}-${pi}`} className="text-sm text-[#2C2A25] leading-relaxed">
                                                {parts.map((part, idx) => {
                                                  if (part.startsWith("**") && part.endsWith("**")) return <strong key={idx} className="font-semibold text-[#1a1815]">{part.slice(2, -2)}</strong>;
                                                  if (part.startsWith("`") && part.endsWith("`")) return <code key={idx} className="px-1 py-0.5 rounded bg-amber-100 text-[12px] font-mono text-amber-900">{part.slice(1, -1)}</code>;
                                                  return <span key={idx}>{part}</span>;
                                                })}
                                              </p>
                                            );
                                          });
                                        })}
                                      </div>
                                    )}
                                  </div>
                                  {reteachText && !reteachLoading && (
                                    <div className="px-4 pb-3 flex gap-2">
                                      <button
                                        onClick={() => {
                                          setChatOpen(true);
                                          setChatInput(`I still don't understand: "${q.question}" — can you explain further?`);
                                        }}
                                        className="text-[11px] font-medium text-amber-700 hover:text-amber-900 underline underline-offset-2 transition-colors"
                                      >
                                        Still confused? Ask your tutor →
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                /* Button to trigger reteach */
                                <button
                                  onClick={() => handleReteach(qi)}
                                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-amber-500/30 bg-gradient-to-b from-[#FBF8F1] to-[#F5F0E6] text-sm font-medium text-amber-800 hover:border-amber-500/50 hover:shadow-md transition-all"
                                >
                                  <Sparkles className="w-4 h-4 text-amber-600" />
                                  Teach me this differently
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Score summary */}
                    {quizScore !== null && (
                      <div className="mt-6 bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-xl p-5 text-center">
                        <p className="text-2xl font-bold text-[#1a1815] mb-1">
                          {Math.round((quizScore / learnResult.quiz.length) * 100)}%
                        </p>
                        <p className="text-sm text-[#8a7f6f] mb-3">
                          You got {quizScore} out of {learnResult.quiz.length} questions right
                        </p>
                        {quizScore < learnResult.quiz.length && (
                          <button
                            onClick={() => {
                              setActiveStep(0);
                              setQuizAnswers({});
                              setQuizRevealed({});
                              setQuizScore(null);
                            }}
                            className="text-sm text-purple-400 hover:text-purple-300 font-medium"
                          >
                            Review the lesson and try again
                          </button>
                        )}
                      </div>
                    )}

                    <div className="mt-6 flex justify-between">
                      <button
                        onClick={() => setActiveStep(2)}
                        className="flex items-center gap-1.5 text-sm font-medium text-[#8a7f6f] hover:text-[#1a1815] transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4" /> Examples
                      </button>
                      <button
                        onClick={() => setActiveStep(4)}
                        className="flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
                      >
                        Next: Resources <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ═══ Tab 4: Resources ═══ */}
                {activeStep === 4 && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <ExternalLink className="w-5 h-5 text-purple-600" />
                      <h2 className="text-lg font-bold text-[#1a1815]" style={{ fontFamily: "'Georgia', serif" }}>Further Learning</h2>
                    </div>
                    <div className="space-y-3">
                      {learnResult.resources && learnResult.resources.length > 0 ? (
                        learnResult.resources.map((resource, i) => (
                          <div
                            key={i}
                            className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-xl p-5"
                          >
                            <div className="flex items-start gap-3">
                              <span className="text-purple-600 text-lg mt-0.5 flex-shrink-0">&#8594;</span>
                              <div className="min-w-0">
                                <h3 className="text-sm font-semibold text-[#1a1815] mb-1">{resource.title}</h3>
                                {resource.description && (
                                  <p className="text-[13px] text-[#8a7f6f] leading-relaxed mb-2">{resource.description}</p>
                                )}
                                {resource.url && (
                                  <a
                                    href={resource.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 transition-colors"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    {resource.url.length > 60
                                      ? resource.url.substring(0, 60) + "..."
                                      : resource.url}
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-[#8a7f6f]">No additional resources available.</p>
                      )}
                    </div>
                    <div className="mt-6 flex justify-between">
                      <button
                        onClick={() => setActiveStep(3)}
                        className="flex items-center gap-1.5 text-sm font-medium text-[#8a7f6f] hover:text-[#1a1815] transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4" /> Quiz
                      </button>
                      <Link
                        href={`/lecture/${id}`}
                        className="flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
                      >
                        Back to Notes <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {chatButton}
    </div>
  );
}
