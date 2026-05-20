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
  Pencil,
  Check,
  X,
  ChevronRight,
  ArrowUpDown,
  Filter,
  LayoutGrid,
  LayoutList,
  AlertCircle,
} from "lucide-react";
import StratumLogo from "@/components/StratumLogo";
import { getLectures, deleteLecture, renameLecture, getAllProgress, Lecture, type StudyProgress } from "@/lib/api";
import { useUser, useAuth } from "@clerk/nextjs";
import { setAuthToken } from "@/lib/auth";
import { useToast } from "@/components/Toast";

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

type SortKey = "date" | "name" | "mastery" | "status";
type FilterKey = "all" | "in-progress" | "not-started" | "completed";

export default function LecturesPage() {
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
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const [filterBy, setFilterBy] = useState<FilterKey>("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

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
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to fetch lectures");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoaded]);

  // Progress helpers
  const getLectureStats = (lectureId: string) => {
    const records = allProgress.filter((p) => p.lecture_id === lectureId);
    if (records.length === 0) return null;
    const totalCards = records.reduce((s, r) => s + r.total_cards, 0);
    const completedCards = records.reduce((s, r) => s + r.completed_cards, 0);
    const avgMastery = Math.round(records.reduce((s, r) => s + r.mastery_pct, 0) / records.length);
    const lastStudiedAt = records.sort((a, b) => b.last_studied_at.localeCompare(a.last_studied_at))[0]?.last_studied_at;
    const isComplete = totalCards > 0 && completedCards >= totalCards;
    return { totalCards, completedCards, avgMastery, lastStudiedAt, isComplete };
  };

  const getLectureStatus = (lecture: Lecture): "processing" | "not-started" | "in-progress" | "completed" => {
    if (lecture.status !== "ready") return "processing";
    const stats = getLectureStats(lecture.id);
    if (!stats) return "not-started";
    if (stats.isComplete) return "completed";
    return "in-progress";
  };

  // Handlers
  const handleDelete = (lectureId: string, title: string) => {
    showConfirm(`Delete "${title}"? This cannot be undone.`, async () => {
      setDeletingId(lectureId);
      try {
        await deleteLecture(lectureId);
        setLectures((prev) => prev.filter((l) => l.id !== lectureId));
        toast("Lecture deleted", "success");
      } catch {
        toast("Failed to delete lecture.", "error");
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
    if (!trimmed) { setRenamingId(null); return; }
    setRenameLoading(true);
    try {
      await renameLecture(lectureId, trimmed);
      setLectures((prev) =>
        prev.map((l) =>
          l.id === lectureId ? { ...l, notes: l.notes ? { ...l.notes, title: trimmed } : l.notes } : l
        )
      );
      toast("Title updated", "success");
    } catch {
      toast("Failed to rename.", "error");
    } finally {
      setRenameLoading(false);
      setRenamingId(null);
    }
  };

  // Filter + sort + search
  const processedLectures = lectures
    .filter((l) => {
      const title = l.notes?.title || l.filename;
      const matchesSearch =
        title.toLowerCase().includes(search.toLowerCase()) ||
        (l.subject || "").toLowerCase().includes(search.toLowerCase());
      if (!matchesSearch) return false;

      if (filterBy === "all") return true;
      const status = getLectureStatus(l);
      return status === filterBy;
    })
    .sort((a, b) => {
      if (sortBy === "date") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === "name") return (a.notes?.title || a.filename).localeCompare(b.notes?.title || b.filename);
      if (sortBy === "mastery") {
        const mA = getLectureStats(a.id)?.avgMastery || 0;
        const mB = getLectureStats(b.id)?.avgMastery || 0;
        return mB - mA;
      }
      if (sortBy === "status") {
        const order = { "processing": 0, "in-progress": 1, "not-started": 2, "completed": 3 };
        return order[getLectureStatus(a)] - order[getLectureStatus(b)];
      }
      return 0;
    });

  const filterCounts = {
    all: lectures.length,
    "not-started": lectures.filter((l) => getLectureStatus(l) === "not-started").length,
    "in-progress": lectures.filter((l) => getLectureStatus(l) === "in-progress").length,
    completed: lectures.filter((l) => getLectureStatus(l) === "completed").length,
  };

  return (
    <div className="flex min-h-screen bg-cream">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-60 border-r border-[rgba(217,185,130,0.25)] bg-paper">
        <div className="px-5 py-4 flex items-center gap-2.5">
          <StratumLogo size={32} />
          <span className="text-lg font-bold text-ink tracking-tight" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>Lectly</span>
        </div>
        <nav className="flex-1 mt-2 px-3">
          <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2.5 text-sm text-ink-m hover:text-ink rounded-lg transition-colors mb-0.5">
            <Home className="w-4 h-4" />
            Dashboard
          </Link>
          <Link href="/upload" className="flex items-center gap-3 px-3 py-2.5 text-sm text-ink-m hover:text-ink rounded-lg transition-colors mb-0.5">
            <Upload className="w-4 h-4" />
            Upload
          </Link>
          <Link href="/lectures" className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-accent bg-accent/8 border-r-2 border-accent rounded-l-lg mb-0.5">
            <FileText className="w-4 h-4 text-accent" />
            Lectures
          </Link>
          <Link href="/profile" className="flex items-center gap-3 px-3 py-2.5 text-sm text-ink-m hover:text-ink rounded-lg transition-colors">
            <User className="w-4 h-4" />
            Profile
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-40 border-b border-[rgba(217,185,130,0.25)] bg-paper/92 backdrop-blur-xl">
          <div className="flex items-center justify-between h-14 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 lg:hidden">
              <StratumLogo size={28} />
              <span className="text-lg font-bold text-ink" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>Lectly</span>
            </div>
            <div className="hidden lg:block" />
            <div className="flex items-center gap-3">
              <Link
                href="/upload"
                className="flex items-center gap-2 text-sm bg-accent hover:bg-accent-l text-white px-4 py-2 rounded-[10px] font-medium shadow-md shadow-black/10 transition-all hover:shadow-lg"
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
          {/* Page header */}
          <div className="mb-5">
            <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
              Your Lectures
            </h1>
            <p className="text-sm text-ink-m mt-1">
              {lectures.length} {lectures.length === 1 ? "lecture" : "lectures"} total
            </p>
          </div>

          {/* Search + Sort + Filter bar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="flex items-center gap-2 bg-paper border border-[rgba(217,185,130,0.25)] rounded-[10px] px-3 py-2 flex-1">
              <Search className="w-4 h-4 text-ink-m" />
              <input
                type="text"
                placeholder="Search by title or subject..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-sm text-ink placeholder:text-ink-m focus:outline-none w-full"
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-ink-m hover:text-ink" aria-label="Clear search">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="text-xs bg-paper border border-[rgba(217,185,130,0.25)] rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer"
              >
                <option value="date">Newest first</option>
                <option value="name">A → Z</option>
                <option value="mastery">Highest mastery</option>
                <option value="status">By status</option>
              </select>
              {/* View toggle */}
              <div className="hidden sm:flex items-center bg-paper border border-[rgba(217,185,130,0.25)] rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 transition-colors ${viewMode === "list" ? "bg-accent/10 text-accent" : "text-ink-m hover:text-ink"}`}
                  aria-label="List view"
                >
                  <LayoutList className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 transition-colors ${viewMode === "grid" ? "bg-accent/10 text-accent" : "text-ink-m hover:text-ink"}`}
                  aria-label="Grid view"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1">
            {([
              { key: "all", label: "All" },
              { key: "in-progress", label: "In Progress" },
              { key: "not-started", label: "Not Started" },
              { key: "completed", label: "Completed" },
            ] as { key: FilterKey; label: string }[]).map((f) => (
              <button
                key={f.key}
                onClick={() => setFilterBy(f.key)}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                  filterBy === f.key
                    ? "bg-accent text-white"
                    : "bg-paper text-ink-m border border-[rgba(217,185,130,0.25)] hover:border-accent/30 hover:text-accent"
                }`}
              >
                {f.label}
                <span className={`text-[10px] ${filterBy === f.key ? "text-white/70" : "text-ink-m"}`}>
                  {filterCounts[f.key]}
                </span>
              </button>
            ))}
          </div>

          {/* Loading */}
          {loading && (
            <div className="animate-pulse space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="bg-paper border border-[rgba(217,185,130,0.25)] rounded-xl px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cream-d" />
                    <div className="flex-1">
                      <div className="h-4 bg-cream-d rounded w-3/4 mb-2" />
                      <div className="h-2.5 bg-cream-d/60 rounded w-1/3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="text-center py-14">
              <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7 text-red-500" />
              </div>
              <p className="text-ink font-semibold mb-1" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>Something went wrong</p>
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

          {/* Lectures — List View */}
          {!loading && !error && viewMode === "list" && (
            <div className="space-y-2">
              {processedLectures.map((lecture) => {
                const isReady = lecture.status === "ready";
                const title = lecture.notes?.title || lecture.filename;
                const stats = getLectureStats(lecture.id);
                const status = getLectureStatus(lecture);

                const statusLabels: Record<string, { text: string; color: string; bg: string }> = {
                  "processing": { text: "Processing", color: "text-amber-700", bg: "bg-amber-500/8" },
                  "not-started": { text: "Not started", color: "text-ink-m", bg: "bg-cream-d" },
                  "in-progress": { text: "In progress", color: "text-accent", bg: "bg-accent/8" },
                  "completed": { text: "Completed", color: "text-green-700", bg: "bg-green-500/8" },
                };
                const sl = statusLabels[status];

                return (
                  <div
                    key={lecture.id}
                    className="bg-paper border border-[rgba(217,185,130,0.25)] rounded-xl px-4 py-3.5 hover:border-[rgba(217,185,130,0.5)] hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isReady ? "bg-accent/8" : "bg-amber-500/10"}`}>
                        {isReady ? <FileText className="w-5 h-5 text-accent" /> : <Clock className="w-5 h-5 text-amber-600 animate-pulse" />}
                      </div>

                      {/* Title + meta */}
                      <div className="flex-1 min-w-0">
                        {renamingId === lecture.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") handleRename(lecture.id); if (e.key === "Escape") setRenamingId(null); }}
                              className="text-sm font-semibold text-ink bg-white border border-accent/30 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-accent/20 flex-1 min-w-0"
                              autoFocus
                              disabled={renameLoading}
                            />
                            <button onClick={() => handleRename(lecture.id)} disabled={renameLoading} className="p-1 rounded-md bg-accent text-white hover:bg-accent-l disabled:opacity-40" aria-label="Confirm rename">
                              {renameLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => setRenamingId(null)} className="p-1 rounded-md text-ink-m hover:text-ink" aria-label="Cancel rename">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <Link href={isReady ? `/lecture/${lecture.id}` : "#"} className="block">
                            <p className="text-sm font-semibold text-ink truncate hover:text-accent transition-colors">
                              {title}
                            </p>
                          </Link>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          {lecture.subject && (
                            <span className="text-[10px] font-medium text-ink-l bg-cream-d px-1.5 py-0.5 rounded">
                              {lecture.subject}
                            </span>
                          )}
                          <span className="text-[10px] text-ink-m">{formatDate(lecture.created_at)}</span>
                          {lecture.duration_seconds && (
                            <span className="text-[10px] text-ink-m">{formatDuration(lecture.duration_seconds)}</span>
                          )}
                        </div>
                      </div>

                      {/* Status badge */}
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${sl.bg} ${sl.color} hidden sm:inline`}>
                        {sl.text}
                      </span>

                      {/* Mastery ring */}
                      {stats && (
                        <div className="w-9 h-9 rounded-full flex items-center justify-center relative flex-shrink-0 hidden sm:flex">
                          <svg className="w-9 h-9 absolute -rotate-90" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#EDE8DF" strokeWidth="2.5" />
                            <circle cx="18" cy="18" r="15.9" fill="none"
                              stroke={stats.avgMastery >= 70 ? "#22c55e" : stats.avgMastery >= 40 ? "#f59e0b" : "#8a7f6f"}
                              strokeWidth="2.5"
                              strokeDasharray={`${stats.avgMastery} ${100 - stats.avgMastery}`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <span className="text-[8px] font-bold text-ink z-10">{stats.avgMastery}%</span>
                        </div>
                      )}

                      {/* Actions — always visible on mobile, hover-reveal on desktop */}
                      <div className="flex items-center gap-1 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        {isReady && (
                          <Link href={`/lecture/${lecture.id}/learn`} className="p-1.5 text-accent hover:bg-accent/8 rounded-lg transition-colors" title="Learn" aria-label="Learn this lecture">
                            <GraduationCap className="w-4 h-4" />
                          </Link>
                        )}
                        <button onClick={() => startRename(lecture.id, title)} className="p-1.5 text-ink-m hover:text-accent rounded-lg transition-colors" title="Rename" aria-label="Rename lecture">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(lecture.id, title)}
                          disabled={deletingId === lecture.id}
                          className="p-1.5 text-ink-m hover:text-red-500 rounded-lg transition-colors disabled:opacity-40"
                          title="Delete"
                          aria-label="Delete lecture"
                        >
                          {deletingId === lecture.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Lectures — Grid View */}
          {!loading && !error && viewMode === "grid" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {processedLectures.map((lecture) => {
                const isReady = lecture.status === "ready";
                const title = lecture.notes?.title || lecture.filename;
                const stats = getLectureStats(lecture.id);
                const status = getLectureStatus(lecture);

                const statusLabels: Record<string, { text: string; color: string; bg: string }> = {
                  "processing": { text: "Processing", color: "text-amber-700", bg: "bg-amber-500/8" },
                  "not-started": { text: "Not started", color: "text-ink-m", bg: "bg-cream-d" },
                  "in-progress": { text: "In progress", color: "text-accent", bg: "bg-accent/8" },
                  "completed": { text: "Completed", color: "text-green-700", bg: "bg-green-500/8" },
                };
                const sl = statusLabels[status];

                return (
                  <div key={lecture.id} className="bg-paper border border-[rgba(217,185,130,0.25)] rounded-xl p-4 hover:border-[rgba(217,185,130,0.5)] hover:shadow-sm transition-all group">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isReady ? "bg-accent/8" : "bg-amber-500/10"}`}>
                        {isReady ? <FileText className="w-4.5 h-4.5 text-accent" /> : <Clock className="w-4.5 h-4.5 text-amber-600 animate-pulse" />}
                      </div>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${sl.bg} ${sl.color}`}>{sl.text}</span>
                    </div>

                    <Link href={isReady ? `/lecture/${lecture.id}` : "#"} className="block mb-2">
                      <p className="text-sm font-semibold text-ink line-clamp-2 hover:text-accent transition-colors" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                        {title}
                      </p>
                    </Link>

                    <div className="flex items-center gap-2 mb-3">
                      {lecture.subject && (
                        <span className="text-[10px] font-medium text-ink-l bg-cream-d px-1.5 py-0.5 rounded truncate max-w-[120px]">
                          {lecture.subject}
                        </span>
                      )}
                      <span className="text-[10px] text-ink-m">{formatDate(lecture.created_at)}</span>
                    </div>

                    {/* Mastery bar */}
                    {stats && (
                      <div className="mb-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] text-ink-m">Mastery</span>
                          <span className="text-[10px] font-semibold text-ink">{stats.avgMastery}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-cream-d rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${stats.avgMastery}%`,
                              background: stats.avgMastery >= 70 ? "#22c55e" : stats.avgMastery >= 40 ? "#f59e0b" : "#8a7f6f",
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-1 pt-2 border-t border-[rgba(217,185,130,0.15)]">
                      {isReady && (
                        <Link href={`/lecture/${lecture.id}/learn`} className="flex items-center gap-1 text-[11px] font-medium text-accent hover:text-accent-l transition-colors">
                          <GraduationCap className="w-3.5 h-3.5" />
                          Learn
                        </Link>
                      )}
                      <div className="flex items-center gap-0.5 ml-auto sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startRename(lecture.id, title)} className="p-1 text-ink-m hover:text-accent rounded transition-colors" title="Rename" aria-label="Rename lecture">
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleDelete(lecture.id, title)} disabled={deletingId === lecture.id} className="p-1 text-ink-m hover:text-red-500 rounded transition-colors disabled:opacity-40" title="Delete" aria-label="Delete lecture">
                          {deletingId === lecture.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty states */}
          {!loading && !error && processedLectures.length === 0 && search && (
            <div className="text-center py-14">
              <div className="w-14 h-14 rounded-2xl bg-cream-d flex items-center justify-center mx-auto mb-4">
                <Search className="w-7 h-7 text-ink-m" />
              </div>
              <p className="text-ink font-medium mb-1.5 text-sm">No results for &ldquo;{search}&rdquo;</p>
              <button onClick={() => setSearch("")} className="text-sm text-accent hover:text-accent-l font-medium">Clear search</button>
            </div>
          )}

          {!loading && !error && processedLectures.length === 0 && !search && filterBy !== "all" && (
            <div className="text-center py-14">
              <p className="text-ink-m text-sm">No lectures match this filter.</p>
              <button onClick={() => setFilterBy("all")} className="text-sm text-accent hover:text-accent-l font-medium mt-2">Show all</button>
            </div>
          )}

          {!loading && !error && lectures.length === 0 && (
            <div className="text-center py-14">
              <div className="w-16 h-16 rounded-2xl bg-accent/8 flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-accent" />
              </div>
              <p className="text-ink font-medium mb-1.5">No lectures yet</p>
              <p className="text-xs text-ink-m mb-4">Upload your first lecture to get started.</p>
              <Link href="/upload" className="inline-flex items-center gap-2 text-sm bg-accent hover:bg-accent-l text-white px-5 py-2.5 rounded-xl font-medium shadow-md">
                <Upload className="w-4 h-4" />
                Upload Lecture
              </Link>
            </div>
          )}
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-paper border-t border-[rgba(217,185,130,0.25)] backdrop-blur-xl safe-bottom pwa-standalone-bottom">
        <div className="flex items-center justify-around h-14">
          <Link href="/dashboard" className="flex flex-col items-center gap-0.5 text-ink-m hover:text-ink">
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-medium">Home</span>
          </Link>
          <Link href="/lectures" className="flex flex-col items-center gap-0.5 text-accent">
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
