"use client";

import { useState, useEffect, useRef, use, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  GraduationCap,
  Loader2,
  AlertCircle,
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

import type { FlowCard } from "./components/types";
import { SectionSidebar } from "./components/SectionSidebar";
import { ProgressDots } from "./components/ProgressDots";
import { ConceptCard } from "./components/ConceptCard";
import { QuizCard } from "./components/QuizCard";
import { AnalogyCard } from "./components/AnalogyCard";
import { NotesView } from "./components/NotesView";
import { TutorComposer } from "./components/TutorComposer";
import { useSwipe } from "./components/useSwipe";
import { MobileTopicPills } from "./components/MobileTopicPills";

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

  // ── Build unified card flow from a learn result (shared helper) ──
  const buildCardFlowFrom = useCallback((result: LearnResult): FlowCard[] => {
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
  }, []);

  // Memoize card flow — only recomputes when learnResult changes, not every render
  const cardFlow = useMemo(
    () => (learnResult ? buildCardFlowFrom(learnResult) : []),
    [learnResult, buildCardFlowFrom]
  );
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

  // Stable navigation callbacks for swipe + keyboard
  const goNext = useCallback(() => {
    setCardIndex((prev) => Math.min(prev + 1, totalFlowCards - 1));
  }, [totalFlowCards]);

  const goPrev = useCallback(() => {
    setCardIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  // Swipe gestures — left swipe = next card, right swipe = previous card
  const swipeHandlers = useSwipe({
    onSwipeLeft: goNext,
    onSwipeRight: goPrev,
  });

  // Keyboard navigation for card flow
  useEffect(() => {
    if (activeMode !== 0 || !learnResult) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goPrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeMode, learnResult, goNext, goPrev]);

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
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Learn Mode failed. Please try again.";
      setError(msg);
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
          <SectionSidebar
            sections={sections}
            selectedSection={selectedSection}
            learnLevel={learnLevel}
            learnLoading={learnLoading}
            onSelectLevel={setLearnLevel}
            onStartLearn={handleStartLearn}
            getProgressForSection={getProgressForSection}
          />

          {/* ── Main content area ── */}
          <div className="flex-1 min-w-0 flex flex-col">
            {/* Mobile: scrollable topic pills */}
            <MobileTopicPills
              sections={sections}
              selectedSection={selectedSection}
              learnLevel={learnLevel}
              learnLoading={learnLoading}
              onSelectLevel={setLearnLevel}
              onStartLearn={handleStartLearn}
              getProgressForSection={getProgressForSection}
            />

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
                    <div className="flex-1 flex flex-col" {...swipeHandlers}>
                      {/* Progress dots */}
                      <ProgressDots
                        cardFlow={cardFlow}
                        cardIndex={cardIndex}
                        totalCards={totalFlowCards}
                        onSelectCard={setCardIndex}
                      />

                      {/* ── CONCEPT CARD ── */}
                      {currentFlowCard.type === "concept" && (
                        <ConceptCard
                          card={currentFlowCard}
                          cardIndex={cardIndex}
                          isFirst={isFirst}
                          isLast={isLast}
                          onNext={() => setCardIndex(cardIndex + 1)}
                          onPrev={() => setCardIndex(Math.max(0, cardIndex - 1))}
                          onViewNotes={() => setActiveMode(2)}
                        />
                      )}

                      {/* ── QUICK CHECK (Quiz) CARD ── */}
                      {currentFlowCard.type === "quiz" && (() => {
                        const qi = currentFlowCard.questionIndex;
                        const q = learnResult.quiz[qi];
                        if (!q) return null;

                        return (
                          <QuizCard
                            question={q}
                            questionIndex={qi}
                            isFirst={isFirst}
                            isLast={isLast}
                            cardIndex={cardIndex}
                            selectedAnswer={quizAnswers[qi]}
                            isRevealed={!!quizRevealed[qi]}
                            onSelectAnswer={selectQuizAnswer}
                            onNext={() => setCardIndex(cardIndex + 1)}
                            onPrev={() => setCardIndex(Math.max(0, cardIndex - 1))}
                            onViewNotes={() => setActiveMode(2)}
                            reteachIndex={reteachIndex}
                            reteachLoading={reteachLoading}
                            reteachText={reteachText}
                            onReteach={handleReteach}
                          />
                        );
                      })()}

                      {/* ── ANALOGY CARD ── */}
                      {currentFlowCard.type === "analogy" && (
                        <AnalogyCard
                          body={currentFlowCard.body}
                          cardIndex={cardIndex}
                          totalCards={totalFlowCards}
                          isFirst={isFirst}
                          isLast={isLast}
                          onNext={() => setCardIndex(cardIndex + 1)}
                          onPrev={() => setCardIndex(Math.max(0, cardIndex - 1))}
                          onViewNotes={() => setActiveMode(2)}
                          onAskTutor={(msg) => {
                            setTutorExpanded(true);
                            handleSendMessage(msg);
                          }}
                        />
                      )}

                      {/* Keyboard hint — desktop only */}
                      <p className="text-center text-[11px] text-[#8a7f6f] mt-4 hidden sm:block">
                        Use arrow keys to navigate cards
                      </p>
                      {/* Swipe hint — mobile only */}
                      <p className="text-center text-[11px] text-[#8a7f6f] mt-4 sm:hidden">
                        Swipe left/right or tap buttons to navigate
                      </p>
                    </div>
                  );
                })()}

                {/* ═══ MODE 1: PRACTICE (rapid-fire quiz) ═══ */}
                {activeMode === 1 && (() => {
                  const quizCards = cardFlow.filter((c) => c.type === "quiz");
                  if (quizCards.length === 0) {
                    return (
                      <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-[#EDE8DF] flex items-center justify-center mb-5">
                          <PenTool className="w-8 h-8 text-[#8a7f6f]" />
                        </div>
                        <h2 className="text-lg font-bold text-[#1a1815] mb-2" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                          No practice questions yet
                        </h2>
                        <p className="text-sm text-[#8a7f6f] max-w-sm">
                          Go through the Cards first — quizzes will appear here for focused practice.
                        </p>
                        <button
                          onClick={() => setActiveMode(0)}
                          className="mt-6 text-sm font-medium text-[#1a1815] px-5 py-2.5 rounded-xl border border-[rgba(217,185,130,0.3)] hover:bg-[#FDFCF9] transition-colors"
                        >
                          Back to Cards
                        </button>
                      </div>
                    );
                  }

                  // Show all quiz questions in a scrollable list for rapid practice
                  const answeredCount = quizCards.filter((c) => c.type === "quiz" && quizRevealed[c.questionIndex]).length;
                  const correctCount = quizCards.filter((c) => c.type === "quiz" && quizRevealed[c.questionIndex] && quizAnswers[c.questionIndex] === learnResult.quiz[c.questionIndex]?.correct_index).length;

                  return (
                    <div className="flex-1 flex flex-col">
                      {/* Practice header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold text-[#8a7f6f] uppercase tracking-widest">
                            Practice Quiz
                          </span>
                          <span className="text-[10px] text-[#8a7f6f]">
                            {answeredCount}/{quizCards.length} answered
                          </span>
                        </div>
                        {answeredCount > 0 && (
                          <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                            correctCount === answeredCount
                              ? "bg-green-100 text-green-700"
                              : correctCount >= answeredCount * 0.7
                              ? "bg-amber-100 text-amber-700"
                              : "bg-red-100 text-red-700"
                          }`}>
                            {correctCount}/{answeredCount} correct
                          </span>
                        )}
                      </div>

                      {/* All quiz questions stacked */}
                      <div className="space-y-4">
                        {quizCards.map((card) => {
                          if (card.type !== "quiz") return null;
                          const qi = card.questionIndex;
                          const q = learnResult.quiz[qi];
                          if (!q) return null;

                          return (
                            <QuizCard
                              key={`practice-${qi}`}
                              question={q}
                              questionIndex={qi}
                              isFirst={true}
                              isLast={true}
                              cardIndex={qi}
                              selectedAnswer={quizAnswers[qi]}
                              isRevealed={!!quizRevealed[qi]}
                              onSelectAnswer={selectQuizAnswer}
                              onNext={() => {}}
                              onPrev={() => {}}
                              onViewNotes={() => setActiveMode(2)}
                              reteachIndex={reteachIndex}
                              reteachLoading={reteachLoading}
                              reteachText={reteachText}
                              onReteach={handleReteach}
                            />
                          );
                        })}
                      </div>

                      {/* Summary when all answered */}
                      {answeredCount === quizCards.length && (
                        <div className="mt-6 p-5 bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-2xl text-center">
                          <p className="text-lg font-bold text-[#1a1815] mb-1" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                            {correctCount === quizCards.length
                              ? "Perfect score!"
                              : correctCount >= quizCards.length * 0.7
                              ? "Good job!"
                              : "Keep practicing!"}
                          </p>
                          <p className="text-sm text-[#8a7f6f] mb-4">
                            You got {correctCount} out of {quizCards.length} correct
                          </p>
                          <button
                            onClick={() => setActiveMode(0)}
                            className="text-sm font-medium text-[#1a1815] px-5 py-2.5 rounded-xl border border-[rgba(217,185,130,0.3)] hover:bg-[#EDE8DF] transition-colors"
                          >
                            Back to Cards
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ═══ MODE 2: NOTES (examples + resources + reference) ═══ */}
                {activeMode === 2 && (
                  <NotesView
                    learnResult={learnResult}
                    lectureId={id}
                    onBackToCards={() => { setActiveMode(0); setCardIndex(0); }}
                    onAskTutor={(msg) => {
                      setTutorExpanded(true);
                      handleSendMessage(msg);
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ PERSISTENT TUTOR COMPOSER BAR ═══ */}
      {learnResult && !learnLoading && (
        <TutorComposer
          expanded={tutorExpanded}
          onToggleExpanded={setTutorExpanded}
          messages={chatMessages}
          input={chatInput}
          onInputChange={setChatInput}
          loading={chatLoading}
          onSend={handleSendMessage}
          onClear={() => { setChatMessages([]); setChatInput(""); setTutorExpanded(false); }}
          placeholder={getComposerPlaceholder()}
          chips={getContextualChips()}
          cardIndex={cardIndex}
          totalCards={totalFlowCards}
          chatEndRef={chatEndRef}
          chatInputRef={chatInputRef}
        />
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
