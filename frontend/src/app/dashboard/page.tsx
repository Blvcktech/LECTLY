"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Upload,
  Search,
  FileText,
  Clock,
  Plus,
  GraduationCap,
  Loader2,
  Home,
  User,
  Trash2,
  ChevronRight,
  Pencil,
  Check,
  X,
  AlertCircle,
} from "lucide-react";
import StratumLogo from "@/components/StratumLogo";
import { getLectures, deleteLecture, renameLecture, getAllProgress, getUserLimits, Lecture, type StudyProgress } from "@/lib/api";
import { useUser, useAuth } from "@clerk/nextjs";
import { setAuthToken } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import OnboardingModal from "@/components/OnboardingModal";

function formatDuration(seconds?: number): string {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoaded: userLoaded } = useUser();
  const { getToken } = useAuth();
  const [search, setSearch] = useState("");
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);
  const [allProgress, setAllProgress] = useState<StudyProgress[]>([]);
  const [lastStudied, setLastStudied] = useState<StudyProgress | null>(null);
  const [lectureLimit, setLectureLimit] = useState(3);
  const [userTier, setUserTier] = useState("free");
  const { toast, confirm: showConfirm } = useToast();

  useEffect(() => {
    // Wait for Clerk to fully load user before fetching — prevents
    // unauthenticated requests that would return 401
    if (!userLoaded) return;

    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Ensure auth token is set before API calls
        const token = await getToken();
        setAuthToken(token);

        // Fetch lectures and progress in parallel
        const [lectureData, progressData, limitsData] = await Promise.all([
          getLectures(),
          getAllProgress().catch(() => ({ progress: [], last_studied: null })),
          getUserLimits().catch(() => ({ lectures_limit: 3, lectures_used: 0, lectures_remaining: 3, tier: "free" })),
        ]);

        if (!cancelled) {
          setLectures(lectureData.lectures);
          setAllProgress(progressData.progress);
          setLastStudied(progressData.last_studied);
          setLectureLimit(limitsData.lectures_limit || 3);
          setUserTier(limitsData.tier || "free");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to fetch lectures");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoaded]);

  // Get rich progress stats for a lecture
  const getLectureStats = (lectureId: string) => {
    const records = allProgress.filter((p) => p.lecture_id === lectureId);
    if (records.length === 0) return null;
    const totalCards = records.reduce((s, r) => s + r.total_cards, 0);
    const completedCards = records.reduce((s, r) => s + r.completed_cards, 0);
    const avgMastery = Math.round(records.reduce((s, r) => s + r.mastery_pct, 0) / records.length);
    const lastStudiedAt = records.sort((a, b) => b.last_studied_at.localeCompare(a.last_studied_at))[0]?.last_studied_at;
    const quizTotal = records.reduce((s, r) => s + r.quiz_total, 0);
    const quizCorrect = records.reduce((s, r) => s + r.quiz_correct, 0);
    const quizFailed = quizTotal - quizCorrect;
    const cardsRemaining = totalCards - completedCards;
    const estimatedMinLeft = Math.max(1, Math.round(cardsRemaining * 0.5)); // ~30sec per card
    const isComplete = totalCards > 0 && completedCards >= totalCards;
    return { totalCards, completedCards, avgMastery, lastStudiedAt, sectionCount: records.length, quizTotal, quizCorrect, quizFailed, cardsRemaining, estimatedMinLeft, isComplete };
  };

  // Generate contextual status line for a lecture
  const getStatusText = (lectureId: string, lecture: Lecture) => {
    const stats = getLectureStats(lectureId);
    const isReady = lecture.status === "ready";

    if (!isReady) return { text: "Processing...", color: "text-amber-700" };

    if (!stats) {
      // No progress — check how new it is
      const ageHours = (Date.now() - new Date(lecture.created_at).getTime()) / 3600000;
      if (ageHours < 24) return { text: `New · ${formatDuration(lecture.duration_seconds)}`, color: "text-green-700" };
      return { text: `Not started · ${formatDuration(lecture.duration_seconds)}`, color: "text-ink-m" };
    }

    if (stats.isComplete && stats.avgMastery >= 90) return { text: `Mastered · ${stats.avgMastery}%`, color: "text-green-700" };
    if (stats.isComplete) return { text: `Completed · ${stats.avgMastery}% mastery`, color: "text-green-700" };
    if (stats.quizFailed > 0) return { text: `Quiz failed ${stats.quizFailed}× · re-teach ready`, color: "text-amber-700" };
    return { text: `${stats.completedCards} of ${stats.totalCards} cards · ${formatRelativeTime(stats.lastStudiedAt)}`, color: "text-ink-m" };
  };

  // Format relative time
  const formatRelativeTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "yesterday";
    return `${days}d ago`;
  };

  const handleDelete = (lectureId: string, title: string) => {
    showConfirm(`Delete "${title}"? This cannot be undone.`, async () => {
      setDeletingId(lectureId);
      try {
        await deleteLecture(lectureId);
        setLectures((prev) => prev.filter((l) => l.id !== lectureId));
        toast("Lecture deleted", "success");
      } catch {
        toast("Failed to delete lecture. Please try again.", "error");
      } finally {
        setDeletingId(null);
      }
    });
  };

  const startRename = (lectureId: string, currentTitle: string) => {
    setRenamingId(lectureId);
    setRenameValue(currentTitle);
  };

  const handleRename = async (lectureId: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenamingId(null);
      return;
    }
    setRenameLoading(true);
    try {
      await renameLecture(lectureId, trimmed);
      setLectures((prev) =>
        prev.map((l) =>
          l.id === lectureId
            ? { ...l, notes: l.notes ? { ...l.notes, title: trimmed } : l.notes }
            : l
        )
      );
      toast("Title updated", "success");
    } catch {
      toast("Failed to rename. Please try again.", "error");
    } finally {
      setRenameLoading(false);
      setRenamingId(null);
    }
  };

  const filtered = lectures.filter(
    (l) =>
      l.filename.toLowerCase().includes(search.toLowerCase()) ||
      (l.notes?.title || "").toLowerCase().includes(search.toLowerCase()) ||
      (l.subject || "").toLowerCase().includes(search.toLowerCase())
  );

  const usagePercent = Math.min((lectures.length / lectureLimit) * 100, 100);

  return (
    <div className="flex min-h-screen bg-cream">
      {/* Onboarding modal for email sign-ups without a name */}
      <OnboardingModal />

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-60 border-r border-[rgba(217,185,130,0.25)] bg-paper">
        <div className="px-5 py-4 flex items-center gap-2.5">
          <StratumLogo size={32} />
          <span className="text-lg font-bold text-ink tracking-tight" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>Lectly</span>
        </div>
        <nav className="flex-1 mt-2 px-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-accent-d bg-accent-l/8 border-r-2 border-accent rounded-l-lg mb-0.5"
          >
            <Home className="w-4 h-4 text-accent" />
            Dashboard
          </Link>
          <Link
            href="/upload"
            className="flex items-center gap-3 px-3 py-2.5 text-sm text-ink-m hover:text-ink rounded-lg transition-colors mb-0.5"
          >
            <Upload className="w-4 h-4" />
            Upload
          </Link>
          <Link
            href="/lectures"
            className="flex items-center gap-3 px-3 py-2.5 text-sm text-ink-m hover:text-ink rounded-lg transition-colors mb-0.5"
          >
            <FileText className="w-4 h-4" />
            Lectures
          </Link>
          <Link
            href="/profile"
            className="flex items-center gap-3 px-3 py-2.5 text-sm text-ink-m hover:text-ink rounded-lg transition-colors"
          >
            <User className="w-4 h-4" />
            Profile
          </Link>
        </nav>

        {/* Usage meter */}
        <div className="px-5 pb-5">
          <div className="bg-cream border border-[rgba(217,185,130,0.25)] rounded-xl p-3.5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-ink-m font-medium">{userTier === "free" ? "Free Plan" : `${userTier.charAt(0).toUpperCase() + userTier.slice(1)} Plan`}</span>
              <span className="text-xs text-accent font-semibold">{lectures.length}/{lectureLimit}</span>
            </div>
            <div className="w-full h-2 bg-cream-d rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500"
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <p className="text-[10px] text-ink-m mt-1.5">Lectures this month</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-40 border-b border-[rgba(217,185,130,0.25)] bg-paper/92 backdrop-blur-xl">
          <div className="flex items-center justify-between h-14 px-4 sm:px-6 lg:px-8">
            {/* Mobile logo */}
            <div className="flex items-center gap-2 lg:hidden">
              <StratumLogo size={28} />
              <span className="text-lg font-bold text-ink" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>Lectly</span>
            </div>

            {/* Search */}
            <div className="hidden sm:flex items-center gap-2 bg-cream border border-[rgba(217,185,130,0.25)] rounded-[10px] px-3 py-2 w-64">
              <Search className="w-4 h-4 text-ink-m" />
              <input
                type="text"
                placeholder="Search lectures..."
                aria-label="Search lectures"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-sm text-ink placeholder:text-ink-m focus:outline-none w-full"
              />
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/upload"
                className="flex items-center gap-2 text-sm bg-accent hover:bg-accent-l text-white px-4 py-2 rounded-[10px] font-medium shadow-md shadow-accent/15 transition-all hover:shadow-lg"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New Lecture</span>
              </Link>
              <Link
                href="/profile"
                title="Profile & settings"
                className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs text-white font-bold hover:opacity-80 transition-opacity cursor-pointer"
              >
                {user?.firstName?.charAt(0).toUpperCase() || "U"}
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 pb-20 lg:pb-6">
          {/* Mobile search */}
          <div className="sm:hidden mb-5">
            <div className="flex items-center gap-2 bg-paper border border-[rgba(217,185,130,0.25)] rounded-[10px] px-3 py-2.5">
              <Search className="w-4 h-4 text-ink-m" />
              <input
                type="text"
                placeholder="Search lectures..."
                aria-label="Search lectures"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-sm text-ink placeholder:text-ink-m focus:outline-none w-full"
              />
            </div>
          </div>

          {/* Header with greeting */}
          <div className="mb-5">
            <h1 className="text-xl font-bold text-ink leading-snug" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
              {!loading && user?.firstName ? `Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, ${user.firstName}` : "Your dashboard"}
            </h1>
            {!loading && lectures.length > 0 && (
              <p className="text-sm text-ink-m mt-1">
                {lectures.length} lecture{lectures.length !== 1 ? "s" : ""} uploaded. {Math.max(0, lectureLimit - lectures.length)} remaining on {userTier === "free" ? "free" : userTier} plan.
              </p>
            )}
          </div>

          {/* Quick stats row */}
          {!loading && lectures.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-5">
              <div className="bg-paper border border-[rgba(217,185,130,0.25)] rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-ink" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                  {lectures.length}
                </p>
                <p className="text-[11px] text-ink-m mt-0.5">Lectures</p>
              </div>
              <div className="bg-paper border border-[rgba(217,185,130,0.25)] rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-ink" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                  {allProgress.length > 0
                    ? `${Math.round(allProgress.filter(p => p.mastery_pct > 0).reduce((s, p) => s + p.mastery_pct, 0) / Math.max(1, allProgress.filter(p => p.mastery_pct > 0).length))}%`
                    : "—"}
                </p>
                <p className="text-[11px] text-ink-m mt-0.5">Avg mastery</p>
              </div>
              <div className="bg-paper border border-[rgba(217,185,130,0.25)] rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-ink" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                  {(() => {
                    const studyDates = new Set<string>();
                    allProgress.forEach(p => {
                      if (p.last_studied_at) studyDates.add(new Date(p.last_studied_at).toISOString().split("T")[0]);
                    });
                    let streak = 0;
                    const today = new Date();
                    for (let i = 0; i < 365; i++) {
                      const d = new Date(today);
                      d.setDate(today.getDate() - i);
                      if (studyDates.has(d.toISOString().split("T")[0])) streak++;
                      else if (i > 0) break;
                    }
                    return streak;
                  })()}
                </p>
                <p className="text-[11px] text-ink-m mt-0.5">Day streak</p>
              </div>
            </div>
          )}

          {/* ── Continuity Card: Last studied ── */}
          {lastStudied && !loading && (() => {
            const lecture = lectures.find((l) => l.id === lastStudied.lecture_id);
            if (!lecture) return null;
            const title = lecture.notes?.title || lecture.filename;
            const stats = getLectureStats(lecture.id);
            const sections = lecture.notes?.sections || [];
            const sectionName = lastStudied.section_index >= 0 && lastStudied.section_index < sections.length
              ? sections[lastStudied.section_index].heading
              : null;

            return (
              <Link
                href={`/lecture/${lecture.id}/learn?section=${lastStudied.section_index}`}
                className="block mb-6 bg-ink text-white rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
                      {lecture.subject ? `${lecture.subject} · ` : ""}In Progress
                    </span>
                    <h2 className="text-lg font-bold mt-1 leading-snug" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                      {title}
                    </h2>
                    {sectionName && (
                      <p className="text-xs text-white/50 mt-0.5 truncate">{sectionName}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span className="text-[11px] font-bold bg-white/15 px-2.5 py-1 rounded-lg">
                        {lastStudied.completed_cards}/{lastStudied.total_cards} cards
                      </span>
                      {stats && !stats.isComplete && stats.estimatedMinLeft > 0 && (
                        <span className="text-[11px] font-bold bg-white/15 px-2.5 py-1 rounded-lg">
                          {stats.estimatedMinLeft} MIN LEFT
                        </span>
                      )}
                      {stats && stats.isComplete && (
                        <span className="text-[11px] font-bold bg-green-500/25 text-green-300 px-2.5 py-1 rounded-lg">
                          {stats.avgMastery}% mastery
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 ml-4 bg-white/10 hover:bg-white/15 rounded-xl px-4 py-2.5 text-sm font-semibold text-white group-hover:bg-white/20 transition-colors">
                    Continue →
                  </div>
                </div>
              </Link>
            );
          })()}

          {/* Section header */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-bold text-ink-m uppercase tracking-widest">
              Recent Lectures
            </h2>
            {lectures.length > 0 && (
              <Link href="/lectures" className="text-[11px] font-semibold text-accent hover:text-accent-d transition-colors">
                View all
              </Link>
            )}
          </div>

          {/* Loading Skeleton */}
          {loading && (
            <div className="animate-pulse">
              {/* Continuity card skeleton */}
              <div className="mb-6 bg-ink/80 rounded-2xl p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="h-2.5 w-28 bg-white/10 rounded mb-3" />
                    <div className="h-5 w-52 bg-white/15 rounded mb-3" />
                    <div className="flex gap-2 mt-2">
                      <div className="h-7 w-24 bg-white/10 rounded-lg" />
                      <div className="h-7 w-28 bg-white/10 rounded-lg" />
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-white/10 flex-shrink-0 ml-4" />
                </div>
              </div>

              {/* Section header skeleton */}
              <div className="flex items-center justify-between mb-3">
                <div className="h-2.5 w-28 bg-cream-d rounded" />
                <div className="h-2.5 w-12 bg-cream-d rounded" />
              </div>

              {/* Lecture card skeletons */}
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-paper border border-[rgba(217,185,130,0.25)] rounded-xl px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-cream-d flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="h-4 bg-cream-d rounded w-3/4 mb-2" />
                        <div className="h-2.5 bg-cream-d/60 rounded w-1/3" />
                      </div>
                      <div className="w-10 h-10 rounded-full bg-cream-d/50 flex-shrink-0" />
                    </div>
                    <div className="flex items-center gap-2 mt-2 pl-[52px]">
                      <div className="h-7 w-28 bg-cream-d/50 rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="text-center py-14">
              <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7 text-red-500" />
              </div>
              <p className="text-ink font-semibold mb-1" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                Something went wrong
              </p>
              <p className="text-sm text-ink-m mb-5">
                {error.includes("fetch") || error.includes("NetworkError")
                  ? "Can't reach the server. Check your internet connection."
                  : error}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 text-sm font-semibold bg-ink hover:bg-ink-h text-white px-5 py-2.5 rounded-xl transition-colors mx-auto"
              >
                Try again
              </button>
            </div>
          )}

          {/* Lectures List — show max 4 on dashboard */}
          {!loading && !error && (
            <div className="space-y-2">
              {filtered.slice(0, 4).map((lecture) => {
                const isReady = lecture.status === "ready";
                const title = lecture.notes?.title || lecture.filename;
                const stats = getLectureStats(lecture.id);
                const status = getStatusText(lecture.id, lecture);

                // Color-coded subject dot
                const subjectColors: Record<string, string> = {
                  "Computer Science & Media": "bg-accent",
                  "Engineering": "bg-orange-500",
                  "Sciences": "bg-green-500",
                  "Medicine & Pharmacy": "bg-red-500",
                  "Law": "bg-accent-l",
                  "Business & Economics": "bg-amber-500",
                  "Arts & Humanities": "bg-pink-500",
                };
                const dotColor = lecture.subject ? (subjectColors[lecture.subject] || "bg-ink-m") : "";

                return (
                  <Link
                    key={lecture.id}
                    href={`/lecture/${lecture.id}`}
                    className={`block bg-paper border border-[rgba(217,185,130,0.25)] rounded-xl px-4 py-3.5 hover:border-[rgba(217,185,130,0.5)] hover:shadow-sm transition-all group ${!isReady ? "opacity-75" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Subject badge with colored dot */}
                      <div className="flex-shrink-0">
                        {lecture.subject ? (
                          <div className="relative">
                            <div className="w-10 h-10 rounded-xl bg-cream-d flex items-center justify-center">
                              <span className="text-[9px] font-bold text-ink-l uppercase leading-none text-center px-0.5">
                                {lecture.subject.length > 6 ? lecture.subject.substring(0, 6) : lecture.subject}
                              </span>
                            </div>
                            <div className={`absolute -top-0.5 -left-0.5 w-3 h-3 rounded-full ${dotColor} border-2 border-paper`} />
                          </div>
                        ) : (
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isReady ? "bg-accent/8" : "bg-amber-500/10"}`}>
                            {isReady ? <FileText className="w-5 h-5 text-accent" /> : <Clock className="w-5 h-5 text-amber-600 animate-pulse" />}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        {renamingId === lecture.id ? (
                          <div className="flex items-center gap-1.5" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                            <input
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") handleRename(lecture.id); if (e.key === "Escape") setRenamingId(null); }}
                              className="text-sm font-semibold text-ink bg-white border border-accent/30 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-accent/20 flex-1 min-w-0"
                              autoFocus
                              disabled={renameLoading}
                            />
                            <button onClick={() => handleRename(lecture.id)} disabled={renameLoading} className="p-1 rounded-md bg-accent text-white hover:bg-accent-l transition-colors disabled:opacity-40" aria-label="Confirm rename">
                              {renameLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => setRenamingId(null)} className="p-1 rounded-md text-ink-m hover:text-ink transition-colors" aria-label="Cancel rename">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <p className="text-sm font-semibold text-ink truncate">
                            {title}
                          </p>
                        )}
                        <p className={`text-[11px] mt-0.5 ${status.color}`}>
                          {status.text}
                        </p>
                      </div>

                      {/* Right side: progress ring or chevron */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {stats && (
                          <div className="w-10 h-10 rounded-full flex items-center justify-center relative">
                            <svg className="w-10 h-10 absolute -rotate-90" viewBox="0 0 36 36">
                              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#EDE8DF" strokeWidth="2.5" />
                              <circle
                                cx="18" cy="18" r="15.9" fill="none"
                                stroke={stats.avgMastery >= 90 ? "#22c55e" : stats.avgMastery >= 70 ? "#22c55e" : stats.avgMastery >= 40 ? "#f59e0b" : "#8a7f6f"}
                                strokeWidth="2.5"
                                strokeDasharray={`${stats.avgMastery} ${100 - stats.avgMastery}`}
                                strokeLinecap="round"
                              />
                            </svg>
                            <span className="text-[9px] font-bold text-ink z-10">{stats.avgMastery}%</span>
                          </div>
                        )}
                        <ChevronRight className="w-4 h-4 text-ink-m sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>

                    {/* Action row */}
                    <div className="flex items-center gap-2 mt-2.5 pl-[52px]">
                      {isReady && (
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/lecture/${lecture.id}/learn`); }}
                          className="flex items-center gap-1.5 text-[11px] font-semibold text-accent bg-accent/8 hover:bg-accent/15 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <GraduationCap className="w-3.5 h-3.5" />
                          {stats?.isComplete ? "Review" : stats ? "Continue learning" : "Start learning"}
                        </button>
                      )}
                      {stats && !stats.isComplete && (
                        <span className="text-[10px] text-ink-m font-medium">
                          ~{stats.estimatedMinLeft} min left
                        </span>
                      )}
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); startRename(lecture.id, title); }}
                        className="flex items-center text-ink-m hover:text-accent p-1.5 rounded-lg transition-colors ml-auto"
                        title="Rename lecture"
                        aria-label="Rename lecture"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(lecture.id, title); }}
                        disabled={deletingId === lecture.id}
                        className="flex items-center text-ink-m hover:text-red-500 p-1.5 rounded-lg transition-colors disabled:opacity-40"
                        title="Delete lecture"
                        aria-label="Delete lecture"
                      >
                        {deletingId === lecture.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </Link>
                );
              })}

              {/* Show "View all" if there are more lectures than displayed */}
              {filtered.length > 4 && (
                <Link
                  href="/lectures"
                  className="block text-center py-3 text-sm font-semibold text-accent hover:text-accent-l bg-paper border border-[rgba(217,185,130,0.25)] rounded-xl hover:border-[rgba(217,185,130,0.5)] transition-all"
                >
                  View all {filtered.length} lectures →
                </Link>
              )}
            </div>
          )}

          {/* Empty State — search returned nothing */}
          {!loading && !error && filtered.length === 0 && search && (
            <div className="text-center py-14">
              <div className="w-14 h-14 rounded-2xl bg-cream-d flex items-center justify-center mx-auto mb-4">
                <Search className="w-7 h-7 text-ink-m" />
              </div>
              <p className="text-ink font-medium mb-1.5 text-sm">No results for &ldquo;{search}&rdquo;</p>
              <p className="text-xs text-ink-m mb-4">
                Try a different search term or check the spelling
              </p>
              <button
                onClick={() => setSearch("")}
                className="text-sm text-accent hover:text-accent-l font-medium transition-colors"
              >
                Clear search
              </button>
            </div>
          )}

          {/* Onboarding — brand new user, no lectures at all */}
          {!loading && !error && lectures.length === 0 && !search && (
            <div className="py-10">
              <div className="text-center mb-8">
                <div className="w-20 h-20 rounded-3xl bg-accent/10 border border-accent/15 flex items-center justify-center mx-auto mb-5">
                  <GraduationCap className="w-10 h-10 text-accent" />
                </div>
                <h2 className="text-xl font-bold text-ink mb-2" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                  Welcome to Lectly{user?.firstName ? `, ${user.firstName}` : ""}
                </h2>
                <p className="text-sm text-ink-m max-w-sm mx-auto leading-relaxed">
                  Upload a lecture recording and Lectly will turn it into structured notes, flashcards, and quizzes — with an AI tutor to help you study.
                </p>
              </div>

              {/* How it works */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8 max-w-lg mx-auto">
                <div className="bg-paper border border-[rgba(217,185,130,0.25)] rounded-xl p-4 text-center">
                  <div className="w-9 h-9 rounded-xl bg-accent/8 flex items-center justify-center mx-auto mb-2">
                    <Upload className="w-4.5 h-4.5 text-accent" />
                  </div>
                  <p className="text-xs font-semibold text-ink mb-0.5">Upload</p>
                  <p className="text-[11px] text-ink-m leading-relaxed">Drop an audio or video lecture file</p>
                </div>
                <div className="bg-paper border border-[rgba(217,185,130,0.25)] rounded-xl p-4 text-center">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/8 flex items-center justify-center mx-auto mb-2">
                    <FileText className="w-4.5 h-4.5 text-amber-600" />
                  </div>
                  <p className="text-xs font-semibold text-ink mb-0.5">Get Notes</p>
                  <p className="text-[11px] text-ink-m leading-relaxed">AI generates structured study notes</p>
                </div>
                <div className="bg-paper border border-[rgba(217,185,130,0.25)] rounded-xl p-4 text-center">
                  <div className="w-9 h-9 rounded-xl bg-green-500/8 flex items-center justify-center mx-auto mb-2">
                    <GraduationCap className="w-4.5 h-4.5 text-green-600" />
                  </div>
                  <p className="text-xs font-semibold text-ink mb-0.5">Learn</p>
                  <p className="text-[11px] text-ink-m leading-relaxed">Study with cards, quizzes & AI tutor</p>
                </div>
              </div>

              {/* CTA */}
              <div className="text-center">
                <Link
                  href="/upload"
                  className="inline-flex items-center gap-2 text-sm bg-accent hover:bg-accent-l text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-black/10 transition-all hover:shadow-xl hover:shadow-black/15"
                >
                  <Upload className="w-4.5 h-4.5" />
                  Upload Your First Lecture
                </Link>
                <p className="text-[11px] text-ink-m mt-3">Supports MP3, MP4, WAV, M4A — up to 500MB</p>
              </div>
            </div>
          )}

          {/* Empty after filter — has lectures but filtered shows none */}
          {!loading && !error && filtered.length === 0 && lectures.length > 0 && !search && (
            <div className="text-center py-14">
              <p className="text-ink-m text-sm">No lectures match the current filter.</p>
            </div>
          )}
        </main>
      </div>
      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-paper border-t border-[rgba(217,185,130,0.25)] backdrop-blur-xl safe-bottom pwa-standalone-bottom">
        <div className="flex items-center justify-around h-14">
          <Link href="/dashboard" className="flex flex-col items-center gap-0.5 text-accent">
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
          <Link href="/profile" className="flex flex-col items-center gap-0.5 text-ink-m hover:text-ink">
            <User className="w-5 h-5" />
            <span className="text-[10px] font-medium">You</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
