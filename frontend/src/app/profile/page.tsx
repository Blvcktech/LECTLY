"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Settings,
  ChevronRight,
  LogOut,
  User,
  GraduationCap,
  Flame,
  Target,
  Zap,
  Clock,
} from "lucide-react";
import { useUser, useClerk, useAuth } from "@clerk/nextjs";
import { setAuthToken } from "@/lib/auth";
import { getLectures, getAllProgress, type Lecture, type StudyProgress } from "@/lib/api";

export default function ProfilePage() {
  const router = useRouter();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { getToken } = useAuth();

  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [allProgress, setAllProgress] = useState<StudyProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const token = await getToken();
        setAuthToken(token);
        const [lectureData, progressData] = await Promise.all([
          getLectures(),
          getAllProgress().catch(() => ({ progress: [], last_studied: null })),
        ]);
        if (!cancelled) {
          setLectures(lectureData.lectures);
          setAllProgress(progressData.progress);
        }
      } catch {
        // silently handle
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [getToken]);

  // Compute study stats
  const stats = useMemo(() => {
    const totalLectures = lectures.length;
    const totalCards = allProgress.reduce((s, p) => s + p.completed_cards, 0);

    // Average mastery across all progress records
    const masteryRecords = allProgress.filter((p) => p.mastery_pct > 0);
    const avgMastery = masteryRecords.length > 0
      ? Math.round(masteryRecords.reduce((s, p) => s + p.mastery_pct, 0) / masteryRecords.length)
      : 0;

    // Estimate study time: ~30 sec per completed card
    const totalMinutes = Math.round((totalCards * 0.5));
    let studyTimeLabel = "0m";
    if (totalMinutes >= 60) {
      const hours = (totalMinutes / 60).toFixed(1);
      studyTimeLabel = `${hours}h`;
    } else {
      studyTimeLabel = `${totalMinutes}m`;
    }

    // Calculate streak (days with activity)
    const studyDates = new Set<string>();
    allProgress.forEach((p) => {
      if (p.last_studied_at) {
        const date = new Date(p.last_studied_at).toISOString().split("T")[0];
        studyDates.add(date);
      }
    });

    // Count consecutive days ending today
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const dateStr = checkDate.toISOString().split("T")[0];
      if (studyDates.has(dateStr)) {
        streak++;
      } else if (i > 0) {
        break; // gap found
      }
    }

    // Build week view (Mon-Sun)
    const weekDays = ["M", "T", "W", "T", "F", "S", "S"];
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStatus = weekDays.map((label, i) => {
      const date = new Date(now);
      date.setDate(now.getDate() - mondayOffset + i);
      const dateStr = date.toISOString().split("T")[0];
      const todayStr = now.toISOString().split("T")[0];
      const isFuture = dateStr > todayStr;
      const isActive = studyDates.has(dateStr);
      return { label, isActive, isFuture };
    });

    return { totalLectures, totalCards, avgMastery, studyTimeLabel, streak, weekStatus };
  }, [lectures, allProgress]);

  const initials = user
    ? `${(user.firstName || "")[0] || ""}${(user.lastName || "")[0] || ""}`.toUpperCase() || "U"
    : "U";

  return (
    <div className="min-h-screen bg-[#F7F4EE]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-[rgba(217,185,130,0.25)] bg-[#FDFCF9]/92 backdrop-blur-xl">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-[#8a7f6f] hover:text-[#1a1815] transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-semibold text-[#1a1815]">You</span>
          </div>
          <Link href="/dashboard" className="text-[#8a7f6f] hover:text-[#1a1815] transition-colors">
            <Settings className="w-5 h-5" />
          </Link>
        </div>
      </nav>

      <main className="max-w-lg mx-auto px-4 py-6 pb-24">
        {/* Loading skeleton */}
        {loading && (
          <div className="animate-pulse">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-[#EDE8DF]" />
              <div>
                <div className="h-4 w-28 bg-[#EDE8DF] rounded mb-2" />
                <div className="h-3 w-16 bg-[#EDE8DF]/60 rounded" />
              </div>
            </div>
            <div className="h-32 bg-[#1a1815]/80 rounded-2xl mb-4" />
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-xl" />)}
            </div>
            <div className="h-44 bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-xl" />
          </div>
        )}

        {!loading && (
          <>
            {/* Profile header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white font-semibold text-base shadow-md shadow-purple-500/15">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-[#1a1815]" style={{ fontFamily: "'Georgia', serif" }}>
                  {user?.fullName || "Student"}
                </p>
                <p className="text-xs text-[#8a7f6f]">Free Plan</p>
              </div>
              <button
                onClick={() => router.push("/dashboard")}
                className="text-xs text-[#8a7f6f] border border-[rgba(217,185,130,0.35)] hover:border-[rgba(217,185,130,0.6)] px-3 py-1.5 rounded-lg transition-colors"
              >
                Edit
              </button>
            </div>

            {/* Streak card (dark) */}
            <div className="bg-[#1a1815] rounded-2xl p-5 mb-3 shadow-lg">
              <div className="text-center">
                <p className="text-4xl font-bold text-white" style={{ fontFamily: "'Georgia', serif" }}>
                  {stats.streak}
                </p>
                <p className="text-[11px] text-white/40 mt-1 uppercase tracking-wider font-medium">
                  Day streak
                </p>
                <div className="flex justify-center gap-1.5 mt-4">
                  {stats.weekStatus.map((day, i) => (
                    <div
                      key={i}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-semibold transition-all ${
                        day.isActive
                          ? "bg-green-500 text-white"
                          : day.isFuture
                          ? "bg-white/[0.04] text-white/15"
                          : "bg-white/[0.08] text-white/25"
                      }`}
                    >
                      {day.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-xl p-4 text-center">
                <div className="w-8 h-8 rounded-lg bg-purple-500/8 flex items-center justify-center mx-auto mb-2">
                  <Target className="w-4 h-4 text-purple-600" />
                </div>
                <p className="text-xl font-bold text-[#1a1815]" style={{ fontFamily: "'Georgia', serif" }}>
                  {stats.avgMastery}%
                </p>
                <p className="text-[11px] text-[#8a7f6f] mt-0.5">Avg mastery</p>
              </div>
              <div className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-xl p-4 text-center">
                <div className="w-8 h-8 rounded-lg bg-amber-500/8 flex items-center justify-center mx-auto mb-2">
                  <Zap className="w-4 h-4 text-amber-600" />
                </div>
                <p className="text-xl font-bold text-[#1a1815]" style={{ fontFamily: "'Georgia', serif" }}>
                  {stats.totalCards}
                </p>
                <p className="text-[11px] text-[#8a7f6f] mt-0.5">Cards learned</p>
              </div>
              <div className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-xl p-4 text-center">
                <div className="w-8 h-8 rounded-lg bg-blue-500/8 flex items-center justify-center mx-auto mb-2">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-xl font-bold text-[#1a1815]" style={{ fontFamily: "'Georgia', serif" }}>
                  {stats.totalLectures}
                </p>
                <p className="text-[11px] text-[#8a7f6f] mt-0.5">Lectures</p>
              </div>
              <div className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-xl p-4 text-center">
                <div className="w-8 h-8 rounded-lg bg-green-500/8 flex items-center justify-center mx-auto mb-2">
                  <Clock className="w-4 h-4 text-green-600" />
                </div>
                <p className="text-xl font-bold text-[#1a1815]" style={{ fontFamily: "'Georgia', serif" }}>
                  {stats.studyTimeLabel}
                </p>
                <p className="text-[11px] text-[#8a7f6f] mt-0.5">Study time</p>
              </div>
            </div>

            {/* Settings list */}
            <div className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-xl overflow-hidden mb-4">
              <p className="text-[10px] font-bold text-[#8a7f6f] uppercase tracking-widest px-4 pt-4 pb-2">
                Settings
              </p>

              <button className="flex items-center justify-between w-full px-4 py-3 hover:bg-[#F7F4EE] transition-colors">
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-[#8a7f6f]" />
                  <span className="text-sm text-[#1a1815]">Account</span>
                </div>
                <ChevronRight className="w-4 h-4 text-[#8a7f6f]" />
              </button>

              <div className="border-t border-[rgba(217,185,130,0.15)] mx-4" />

              <button className="flex items-center justify-between w-full px-4 py-3 hover:bg-[#F7F4EE] transition-colors">
                <div className="flex items-center gap-3">
                  <GraduationCap className="w-4 h-4 text-[#8a7f6f]" />
                  <span className="text-sm text-[#1a1815]">Learning preferences</span>
                </div>
                <ChevronRight className="w-4 h-4 text-[#8a7f6f]" />
              </button>

              <div className="border-t border-[rgba(217,185,130,0.15)] mx-4" />

              <button className="flex items-center justify-between w-full px-4 py-3 hover:bg-[#F7F4EE] transition-colors">
                <div className="flex items-center gap-3">
                  <Flame className="w-4 h-4 text-[#8a7f6f]" />
                  <span className="text-sm text-[#1a1815]">Subscription</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-purple-600 bg-purple-500/8 px-2 py-0.5 rounded font-medium">
                    Free
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#8a7f6f]" />
                </div>
              </button>
            </div>

            {/* Sign out */}
            <button
              onClick={() => signOut({ redirectUrl: "/" })}
              className="w-full flex items-center justify-center gap-2 text-sm text-red-500 border border-red-200 hover:bg-red-50 rounded-xl py-3 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </>
        )}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#FDFCF9] border-t border-[rgba(217,185,130,0.25)] backdrop-blur-xl">
        <div className="flex items-center justify-around h-14">
          <Link href="/dashboard" className="flex flex-col items-center gap-0.5 text-[#8a7f6f] hover:text-[#1a1815]">
            <BookOpen className="w-5 h-5" />
            <span className="text-[10px] font-medium">Home</span>
          </Link>
          <Link href="/upload" className="flex flex-col items-center gap-0.5 text-[#8a7f6f] hover:text-[#1a1815]">
            <Zap className="w-5 h-5" />
            <span className="text-[10px] font-medium">Upload</span>
          </Link>
          <Link href="/profile" className="flex flex-col items-center gap-0.5 text-purple-600">
            <User className="w-5 h-5" />
            <span className="text-[10px] font-medium">You</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
