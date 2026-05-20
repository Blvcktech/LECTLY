"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  GraduationCap,
  Target,
  BookOpen,
  Zap,
  User,
  Home,
  FileText,
  Upload,
  Check,
} from "lucide-react";

type Difficulty = "beginner" | "intermediate" | "advanced";
type DailyGoal = 5 | 10 | 15 | 30;
type CardStyle = "mixed" | "explanations" | "quizzes";

export default function LearningPreferencesPage() {
  const router = useRouter();
  const [saved, setSaved] = useState(false);

  // Load from localStorage
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate");
  const [dailyGoal, setDailyGoal] = useState<DailyGoal>(10);
  const [cardStyle, setCardStyle] = useState<CardStyle>("mixed");
  const [autoPlay, setAutoPlay] = useState(true);

  useEffect(() => {
    try {
      const prefs = localStorage.getItem("lectly_learning_prefs");
      if (prefs) {
        const parsed = JSON.parse(prefs);
        if (parsed.difficulty) setDifficulty(parsed.difficulty);
        if (parsed.dailyGoal) setDailyGoal(parsed.dailyGoal);
        if (parsed.cardStyle) setCardStyle(parsed.cardStyle);
        if (parsed.autoPlay !== undefined) setAutoPlay(parsed.autoPlay);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSave = () => {
    const prefs = { difficulty, dailyGoal, cardStyle, autoPlay };
    localStorage.setItem("lectly_learning_prefs", JSON.stringify(prefs));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const difficultyOptions: { value: Difficulty; label: string; desc: string }[] = [
    { value: "beginner", label: "Beginner", desc: "Simpler language, more analogies" },
    { value: "intermediate", label: "Intermediate", desc: "Balanced depth and clarity" },
    { value: "advanced", label: "Advanced", desc: "Technical detail, less hand-holding" },
  ];

  const goalOptions: { value: DailyGoal; label: string }[] = [
    { value: 5, label: "5 cards" },
    { value: 10, label: "10 cards" },
    { value: 15, label: "15 cards" },
    { value: 30, label: "30 cards" },
  ];

  const styleOptions: { value: CardStyle; label: string; desc: string }[] = [
    { value: "mixed", label: "Mixed", desc: "Explanations, examples, and quizzes" },
    { value: "explanations", label: "Explanations first", desc: "Focus on understanding concepts" },
    { value: "quizzes", label: "Quiz heavy", desc: "More practice questions and recall" },
  ];

  return (
    <div className="min-h-screen bg-cream">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-[rgba(217,185,130,0.25)] bg-paper/92 backdrop-blur-xl">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/profile")}
              className="text-ink-m hover:text-ink transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-semibold text-ink">Learning Preferences</span>
          </div>
          <button
            onClick={handleSave}
            className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition-all ${
              saved
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-ink text-white hover:bg-ink-h"
            }`}
          >
            {saved ? (
              <span className="flex items-center gap-1">
                <Check className="w-3 h-3" /> Saved
              </span>
            ) : (
              "Save"
            )}
          </button>
        </div>
      </nav>

      <main className="max-w-lg mx-auto px-4 py-6 pb-24">
        {/* Difficulty Level */}
        <div className="bg-paper border border-[rgba(217,185,130,0.25)] rounded-xl overflow-hidden mb-4">
          <div className="px-4 pt-4 pb-2 flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-accent" />
            <p className="text-[10px] font-bold text-ink-m uppercase tracking-widest">
              Difficulty Level
            </p>
          </div>
          <p className="text-[11px] text-ink-f px-4 mb-3">
            Controls how Learn Mode explains concepts to you
          </p>
          <div className="px-4 pb-4 space-y-2">
            {difficultyOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDifficulty(opt.value)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all text-left ${
                  difficulty === opt.value
                    ? "border-accent/40 bg-accent-l/[0.05]"
                    : "border-[rgba(217,185,130,0.2)] hover:border-[rgba(217,185,130,0.4)]"
                }`}
              >
                <div>
                  <p className={`text-sm font-medium ${difficulty === opt.value ? "text-accent-d" : "text-ink"}`}>
                    {opt.label}
                  </p>
                  <p className="text-[10px] text-ink-f">{opt.desc}</p>
                </div>
                {difficulty === opt.value && (
                  <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Daily Goal */}
        <div className="bg-paper border border-[rgba(217,185,130,0.25)] rounded-xl overflow-hidden mb-4">
          <div className="px-4 pt-4 pb-2 flex items-center gap-2">
            <Target className="w-4 h-4 text-amber-600" />
            <p className="text-[10px] font-bold text-ink-m uppercase tracking-widest">
              Daily Goal
            </p>
          </div>
          <p className="text-[11px] text-ink-f px-4 mb-3">
            How many cards you aim to complete each day
          </p>
          <div className="px-4 pb-4 flex gap-2">
            {goalOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDailyGoal(opt.value)}
                className={`flex-1 text-center px-2 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                  dailyGoal === opt.value
                    ? "border-amber-500/40 bg-amber-500/[0.06] text-amber-700"
                    : "border-[rgba(217,185,130,0.2)] text-ink-m hover:border-[rgba(217,185,130,0.4)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Card Style */}
        <div className="bg-paper border border-[rgba(217,185,130,0.25)] rounded-xl overflow-hidden mb-4">
          <div className="px-4 pt-4 pb-2 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-accent" />
            <p className="text-[10px] font-bold text-ink-m uppercase tracking-widest">
              Learn Mode Style
            </p>
          </div>
          <p className="text-[11px] text-ink-f px-4 mb-3">
            What kind of cards you prefer in Learn Mode
          </p>
          <div className="px-4 pb-4 space-y-2">
            {styleOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setCardStyle(opt.value)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all text-left ${
                  cardStyle === opt.value
                    ? "border-accent/40 bg-accent-l/[0.05]"
                    : "border-[rgba(217,185,130,0.2)] hover:border-[rgba(217,185,130,0.4)]"
                }`}
              >
                <div>
                  <p className={`text-sm font-medium ${cardStyle === opt.value ? "text-accent-d" : "text-ink"}`}>
                    {opt.label}
                  </p>
                  <p className="text-[10px] text-ink-f">{opt.desc}</p>
                </div>
                {cardStyle === opt.value && (
                  <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Auto-advance toggle */}
        <div className="bg-paper border border-[rgba(217,185,130,0.25)] rounded-xl overflow-hidden mb-4">
          <div className="px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="w-4 h-4 text-emerald-600" />
              <div>
                <p className="text-sm text-ink font-medium">Auto-advance cards</p>
                <p className="text-[10px] text-ink-f">
                  Automatically move to the next card after answering
                </p>
              </div>
            </div>
            <button
              onClick={() => setAutoPlay(!autoPlay)}
              className={`w-10 h-6 rounded-full transition-colors relative ${
                autoPlay ? "bg-emerald-500" : "bg-muted-bg"
              }`}
            >
              <div
                className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm ${
                  autoPlay ? "left-5" : "left-1"
                }`}
              />
            </button>
          </div>
        </div>

        <p className="text-[11px] text-ink-f text-center px-4">
          These preferences are saved locally and apply to all your lectures.
        </p>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-paper border-t border-[rgba(217,185,130,0.25)] backdrop-blur-xl safe-bottom pwa-standalone-bottom">
        <div className="flex items-center justify-around h-14">
          <Link href="/dashboard" className="flex flex-col items-center gap-0.5 text-ink-m hover:text-ink">
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-medium">Home</span>
          </Link>
          <Link href="/lectures" className="flex flex-col items-center gap-0.5 text-ink-m hover:text-ink">
            <FileText className="w-5 h-5" />
            <span className="text-[10px] font-medium">Lectures</span>
          </Link>
          <Link href="/upload" className="flex flex-col items-center gap-0.5 text-ink-m hover:text-ink">
            <Upload className="w-5 h-5" />
            <span className="text-[10px] font-medium">Upload</span>
          </Link>
          <Link href="/profile" className="flex flex-col items-center gap-0.5 text-accent">
            <User className="w-5 h-5" />
            <span className="text-[10px] font-medium">You</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
