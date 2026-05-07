"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
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
  Play,
  ChevronRight,
} from "lucide-react";
import { getLectures, deleteLecture, getAllProgress, Lecture, type StudyProgress } from "@/lib/api";
import { useUser, useClerk, useAuth } from "@clerk/nextjs";
import { setAuthToken } from "@/lib/auth";

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
  const { user } = useUser();
  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const [search, setSearch] = useState("");
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [allProgress, setAllProgress] = useState<StudyProgress[]>([]);
  const [lastStudied, setLastStudied] = useState<StudyProgress | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const token = await getToken();
        setAuthToken(token);

        // Fetch lectures and progress in parallel
        const [lectureData, progressData] = await Promise.all([
          getLectures(),
          getAllProgress().catch(() => ({ progress: [], last_studied: null })),
        ]);

        if (!cancelled) {
          setLectures(lectureData.lectures);
          setAllProgress(progressData.progress);
          setLastStudied(progressData.last_studied);
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
  }, [getToken]);

  // Get best progress for a lecture (highest mastery across sections)
  const getLectureStats = (lectureId: string) => {
    const records = allProgress.filter((p) => p.lecture_id === lectureId);
    if (records.length === 0) return null;
    const totalCards = records.reduce((s, r) => s + r.total_cards, 0);
    const completedCards = records.reduce((s, r) => s + r.completed_cards, 0);
    const avgMastery = Math.round(records.reduce((s, r) => s + r.mastery_pct, 0) / records.length);
    const lastStudiedAt = records.sort((a, b) => b.last_studied_at.localeCompare(a.last_studied_at))[0]?.last_studied_at;
    return { totalCards, completedCards, avgMastery, lastStudiedAt, sectionCount: records.length };
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

  const handleDelete = async (lectureId: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setDeletingId(lectureId);
    try {
      await deleteLecture(lectureId);
      setLectures((prev) => prev.filter((l) => l.id !== lectureId));
    } catch {
      alert("Failed to delete lecture. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = lectures.filter(
    (l) =>
      l.filename.toLowerCase().includes(search.toLowerCase()) ||
      (l.notes?.title || "").toLowerCase().includes(search.toLowerCase()) ||
      (l.subject || "").toLowerCase().includes(search.toLowerCase())
  );

  const usagePercent = Math.min((lectures.length / 3) * 100, 100);

  return (
    <div className="flex min-h-screen bg-[#F7F4EE]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-60 border-r border-[rgba(217,185,130,0.25)] bg-[#FDFCF9]">
        <div className="px-5 py-4 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-md shadow-purple-500/15">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-[#1a1815] tracking-tight" style={{ fontFamily: "'Georgia', serif" }}>Lectly</span>
        </div>
        <nav className="flex-1 mt-2 px-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-purple-700 bg-purple-500/8 border-r-2 border-purple-500 rounded-l-lg mb-0.5"
          >
            <Home className="w-4 h-4 text-purple-600" />
            Dashboard
          </Link>
          <Link
            href="/upload"
            className="flex items-center gap-3 px-3 py-2.5 text-sm text-[#8a7f6f] hover:text-[#1a1815] rounded-lg transition-colors mb-0.5"
          >
            <Upload className="w-4 h-4" />
            Upload
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2.5 text-sm text-[#8a7f6f] hover:text-[#1a1815] rounded-lg transition-colors mb-0.5"
          >
            <FileText className="w-4 h-4" />
            Lectures
          </Link>
          <Link
            href="#"
            className="flex items-center gap-3 px-3 py-2.5 text-sm text-[#8a7f6f] hover:text-[#1a1815] rounded-lg transition-colors"
          >
            <User className="w-4 h-4" />
            Profile
          </Link>
        </nav>

        {/* Usage meter */}
        <div className="px-5 pb-5">
          <div className="bg-[#F7F4EE] border border-[rgba(217,185,130,0.25)] rounded-xl p-3.5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-[#8a7f6f] font-medium">Free Plan</span>
              <span className="text-xs text-purple-600 font-semibold">{lectures.length}/3</span>
            </div>
            <div className="w-full h-2 bg-[#EDE8DF] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500"
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <p className="text-[10px] text-[#8a7f6f] mt-1.5">Lectures this month</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-40 border-b border-[rgba(217,185,130,0.25)] bg-[#FDFCF9]/92 backdrop-blur-xl">
          <div className="flex items-center justify-between h-14 px-4 sm:px-6 lg:px-8">
            {/* Mobile logo */}
            <div className="flex items-center gap-2 lg:hidden">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-[#1a1815]" style={{ fontFamily: "'Georgia', serif" }}>Lectly</span>
            </div>

            {/* Search */}
            <div className="hidden sm:flex items-center gap-2 bg-[#F7F4EE] border border-[rgba(217,185,130,0.25)] rounded-[10px] px-3 py-2 w-64">
              <Search className="w-4 h-4 text-[#8a7f6f]" />
              <input
                type="text"
                placeholder="Search lectures..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-sm text-[#1a1815] placeholder:text-[#8a7f6f] focus:outline-none w-full"
              />
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/upload"
                className="flex items-center gap-2 text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-[10px] font-medium shadow-md shadow-purple-500/15 transition-all hover:shadow-lg"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New Lecture</span>
              </Link>
              <button
                onClick={() => signOut({ redirectUrl: "/" })}
                title="Sign out"
                className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-xs text-white font-bold hover:opacity-80 transition-opacity cursor-pointer"
              >
                {user?.firstName?.charAt(0).toUpperCase() || "U"}
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 pb-20 lg:pb-6">
          {/* Mobile search */}
          <div className="sm:hidden mb-5">
            <div className="flex items-center gap-2 bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-[10px] px-3 py-2.5">
              <Search className="w-4 h-4 text-[#8a7f6f]" />
              <input
                type="text"
                placeholder="Search lectures..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-sm text-[#1a1815] placeholder:text-[#8a7f6f] focus:outline-none w-full"
              />
            </div>
          </div>

          {/* Header with date */}
          <div className="mb-6">
            <p className="text-[10px] font-bold text-[#8a7f6f] uppercase tracking-widest mb-1">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
            <h1 className="text-2xl font-bold text-[#1a1815] leading-snug" style={{ fontFamily: "'Georgia', serif" }}>
              Pick up where{"\n"}you left off.
            </h1>
          </div>

          {/* ── Continuity Card: Last studied ── */}
          {lastStudied && !loading && (() => {
            const lecture = lectures.find((l) => l.id === lastStudied.lecture_id);
            if (!lecture) return null;
            const title = lecture.notes?.title || lecture.filename;
            const stats = getLectureStats(lecture.id);

            return (
              <Link
                href={`/lecture/${lecture.id}/learn?section=${lastStudied.section_index}`}
                className="block mb-6 bg-[#1a1815] text-white rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {lecture.subject && (
                      <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
                        {lecture.subject} · In Progress
                      </span>
                    )}
                    <h2 className="text-lg font-bold mt-1 truncate" style={{ fontFamily: "'Georgia', serif" }}>
                      {title}
                    </h2>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs font-semibold bg-white/15 px-2.5 py-1 rounded-lg">
                        {lastStudied.completed_cards}/{lastStudied.total_cards} cards
                      </span>
                      {stats && (
                        <span className="text-xs font-semibold bg-white/15 px-2.5 py-1 rounded-lg">
                          {stats.avgMastery}% mastery
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center flex-shrink-0 ml-4 group-hover:scale-105 transition-transform">
                    <Play className="w-5 h-5 text-[#1a1815] ml-0.5" />
                  </div>
                </div>
              </Link>
            );
          })()}

          {/* Section header */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-bold text-[#8a7f6f] uppercase tracking-widest">
              Recent Lectures
            </h2>
            {lectures.length > 0 && (
              <span className="text-[11px] font-medium text-[#8a7f6f]">
                All {lectures.length} →
              </span>
            )}
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-3" />
              <p className="text-[#8a7f6f] text-sm">Loading lectures...</p>
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="text-center py-14">
              <p className="text-red-600 font-medium mb-2 text-sm">
                Something went wrong
              </p>
              <p className="text-xs text-[#8a7f6f] mb-5">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 text-sm bg-[#FDFCF9] border border-[rgba(217,185,130,0.35)] hover:border-purple-400 text-[#1a1815] px-4 py-2 rounded-[10px] transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Lectures List */}
          {!loading && !error && (
            <div className="space-y-2">
              {filtered.map((lecture) => {
                const isReady = lecture.status === "ready";
                const title = lecture.notes?.title || lecture.filename;
                const stats = getLectureStats(lecture.id);

                return (
                  <Link
                    key={lecture.id}
                    href={isReady ? `/lecture/${lecture.id}` : "#"}
                    className="block bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-xl px-4 py-3.5 hover:border-[rgba(217,185,130,0.5)] hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      {/* Subject badge */}
                      {lecture.subject ? (
                        <div className="w-10 h-10 rounded-xl bg-[#EDE8DF] flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-[#2C2A25] uppercase leading-none text-center">
                            {lecture.subject.length > 6 ? lecture.subject.substring(0, 6) : lecture.subject}
                          </span>
                        </div>
                      ) : (
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isReady ? "bg-purple-500/8" : "bg-amber-500/10"}`}>
                          {isReady ? <FileText className="w-5 h-5 text-purple-600" /> : <Clock className="w-5 h-5 text-amber-600 animate-pulse" />}
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#1a1815] truncate">
                          {title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {stats ? (
                            <>
                              <span className="text-[11px] text-[#8a7f6f]">
                                Mastery {stats.avgMastery}%
                              </span>
                              <span className="text-[11px] text-[#8a7f6f]">·</span>
                              <span className="text-[11px] text-[#8a7f6f]">
                                {formatRelativeTime(stats.lastStudiedAt)}
                              </span>
                            </>
                          ) : isReady ? (
                            <span className="text-[11px] text-[#8a7f6f]">
                              New · {formatDuration(lecture.duration_seconds)}
                            </span>
                          ) : (
                            <span className="text-[11px] text-amber-700">
                              Processing...
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right side: progress or chevron */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {stats && (
                          <div className="w-10 h-10 rounded-full border-2 border-[#EDE8DF] flex items-center justify-center relative">
                            <svg className="w-10 h-10 absolute" viewBox="0 0 36 36">
                              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#EDE8DF" strokeWidth="2.5" />
                              <circle
                                cx="18" cy="18" r="15.9" fill="none"
                                stroke={stats.avgMastery >= 70 ? "#22c55e" : stats.avgMastery >= 40 ? "#f59e0b" : "#8a7f6f"}
                                strokeWidth="2.5"
                                strokeDasharray={`${stats.avgMastery} ${100 - stats.avgMastery}`}
                                strokeDashoffset="25"
                                strokeLinecap="round"
                              />
                            </svg>
                            <span className="text-[9px] font-bold text-[#1a1815] z-10">{stats.avgMastery}%</span>
                          </div>
                        )}
                        <ChevronRight className="w-4 h-4 text-[#8a7f6f] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>

                    {/* Delete button (stops propagation) */}
                    <div className="flex items-center gap-2 mt-2 pl-[52px]">
                      {isReady && (
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/lecture/${lecture.id}/learn`); }}
                          className="flex items-center gap-1.5 text-xs text-purple-700 bg-purple-500/8 hover:bg-purple-500/15 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <GraduationCap className="w-3.5 h-3.5" />
                          {stats ? "Continue learning" : "Start learning"}
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(lecture.id, title); }}
                        disabled={deletingId === lecture.id}
                        className="flex items-center text-[#8a7f6f] hover:text-red-500 p-1.5 rounded-lg transition-colors disabled:opacity-40 ml-auto"
                        title="Delete lecture"
                      >
                        {deletingId === lecture.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && filtered.length === 0 && (
            <div className="text-center py-14">
              <div className="w-14 h-14 rounded-2xl bg-[#EDE8DF] flex items-center justify-center mx-auto mb-4">
                <Upload className="w-7 h-7 text-[#8a7f6f]" />
              </div>
              <p className="text-[#1a1815] font-medium mb-1.5 text-sm">No lectures found</p>
              <p className="text-xs text-[#8a7f6f] mb-5">
                {search
                  ? "Try a different search term"
                  : "Upload your first lecture to get started"}
              </p>
              <Link
                href="/upload"
                className="inline-flex items-center gap-2 text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white px-5 py-2.5 rounded-[10px] font-medium shadow-md shadow-purple-500/15 transition-all"
              >
                <Upload className="w-4 h-4" />
                Upload Lecture
              </Link>
            </div>
          )}
        </main>
      </div>
      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#FDFCF9] border-t border-[rgba(217,185,130,0.25)] backdrop-blur-xl">
        <div className="flex items-center justify-around h-14">
          <Link href="/dashboard" className="flex flex-col items-center gap-0.5 text-purple-600">
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-medium">Home</span>
          </Link>
          <Link href="/upload" className="flex flex-col items-center gap-0.5 text-[#8a7f6f] hover:text-[#1a1815]">
            <Upload className="w-5 h-5" />
            <span className="text-[10px] font-medium">Upload</span>
          </Link>
          <Link href="#" className="flex flex-col items-center gap-0.5 text-[#8a7f6f] hover:text-[#1a1815]">
            <User className="w-5 h-5" />
            <span className="text-[10px] font-medium">Profile</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
