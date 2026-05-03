"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  Upload,
  Search,
  FileText,
  Brain,
  Clock,
  Plus,
  GraduationCap,
  Sparkles,
  Loader2,
  Home,
  User,
  Settings,
  Trash2,
} from "lucide-react";
import { getLectures, deleteLecture, Lecture } from "@/lib/api";
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

  useEffect(() => {
    let cancelled = false;

    async function fetchLectures() {
      try {
        setLoading(true);
        setError(null);
        // Get Clerk token and set it for API calls
        const token = await getToken();
        setAuthToken(token);
        const data = await getLectures();
        if (!cancelled) {
          setLectures(data.lectures);
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

    fetchLectures();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

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

  const totalHours =
    lectures.reduce((sum, l) => sum + (l.duration_seconds || 0), 0) / 3600;

  const totalSections = lectures.reduce(
    (sum, l) => sum + (l.notes?.sections?.length || 0),
    0
  );

  const readyCount = lectures.filter((l) => l.status === "ready").length;

  // Usage meter (free tier: 3 lectures/month)
  const usagePercent = Math.min((lectures.length / 3) * 100, 100);

  return (
    <div className="flex min-h-screen bg-[#0F172A]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-60 border-r border-slate-800/60 bg-[#0F172A]">
        <div className="px-5 py-4 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-blue-600 to-green-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-white tracking-tight">Lectly</span>
        </div>
        <nav className="flex-1 mt-2 px-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-white bg-blue-500/10 border-r-2 border-blue-500 rounded-l-lg mb-0.5"
          >
            <Home className="w-4 h-4 text-blue-400" />
            Dashboard
          </Link>
          <Link
            href="/upload"
            className="flex items-center gap-3 px-3 py-2.5 text-sm text-slate-400 hover:text-white rounded-lg transition-colors mb-0.5"
          >
            <Upload className="w-4 h-4" />
            Upload
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2.5 text-sm text-slate-400 hover:text-white rounded-lg transition-colors mb-0.5"
          >
            <FileText className="w-4 h-4" />
            Lectures
          </Link>
          <Link
            href="#"
            className="flex items-center gap-3 px-3 py-2.5 text-sm text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <User className="w-4 h-4" />
            Profile
          </Link>
        </nav>

        {/* Usage meter */}
        <div className="px-5 pb-5">
          <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-3.5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-slate-400 font-medium">Free Plan</span>
              <span className="text-xs text-blue-400 font-semibold">{lectures.length}/3</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-green-500 transition-all duration-500"
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1.5">Lectures this month</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-40 border-b border-slate-800/60 bg-[#0F172A]/92 backdrop-blur-xl">
          <div className="flex items-center justify-between h-14 px-4 sm:px-6 lg:px-8">
            {/* Mobile logo */}
            <div className="flex items-center gap-2 lg:hidden">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-green-500 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-white">Lectly</span>
            </div>

            {/* Search */}
            <div className="hidden sm:flex items-center gap-2 bg-[#0F172A] border border-slate-700/60 rounded-[10px] px-3 py-2 w-64">
              <Search className="w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search lectures..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none w-full"
              />
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/upload"
                className="flex items-center gap-2 text-sm bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-2 rounded-[10px] font-medium shadow-md shadow-blue-500/20 transition-all hover:from-blue-500 hover:to-blue-400"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New Lecture</span>
              </Link>
              <button
                onClick={() => signOut({ redirectUrl: "/" })}
                title="Sign out"
                className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-green-500 flex items-center justify-center text-xs text-white font-bold hover:opacity-80 transition-opacity cursor-pointer"
              >
                {user?.firstName?.charAt(0).toUpperCase() || "U"}
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 pb-20 lg:pb-6">
          {/* Mobile search */}
          <div className="sm:hidden mb-5">
            <div className="flex items-center gap-2 bg-[#0F172A] border border-slate-700/60 rounded-[10px] px-3 py-2.5">
              <Search className="w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search lectures..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none w-full"
              />
            </div>
          </div>

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-xl font-bold text-white">My Lectures</h1>
            <p className="text-slate-400 text-xs mt-0.5">
              {lectures.length} lecture{lectures.length !== 1 ? "s" : ""} uploaded
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[
              { icon: FileText, label: "Total Lectures", value: String(lectures.length), color: "text-blue-400", bg: "bg-blue-500/10" },
              { icon: Clock, label: "Hours Processed", value: `${totalHours.toFixed(1)}h`, color: "text-green-400", bg: "bg-green-500/10" },
              { icon: Brain, label: "Sections Generated", value: String(totalSections), color: "text-purple-400", bg: "bg-purple-500/10" },
              { icon: Sparkles, label: "Ready", value: String(readyCount), color: "text-yellow-400", bg: "bg-yellow-500/10" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3.5 backdrop-blur-sm"
              >
                <div className={`w-8 h-8 rounded-[10px] ${stat.bg} flex items-center justify-center mb-2`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <p className="text-xl font-bold text-white">{stat.value}</p>
                <p className="text-[11px] text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-3" />
              <p className="text-slate-400 text-sm">Loading lectures...</p>
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="text-center py-14">
              <p className="text-red-400 font-medium mb-2 text-sm">
                Something went wrong
              </p>
              <p className="text-xs text-slate-400 mb-5">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 text-sm bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-[10px] transition-colors"
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
                const topics = (lecture.notes?.sections || [])
                  .slice(0, 3)
                  .map((s) => s.heading);

                return (
                  <div
                    key={lecture.id}
                    className="bg-slate-800/40 border border-slate-800/60 rounded-xl px-4 py-3.5 hover:border-slate-600 transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div
                        className={`w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0 ${
                          isReady ? "bg-blue-500/10" : "bg-yellow-500/10"
                        }`}
                      >
                        {isReady ? (
                          <FileText className="w-5 h-5 text-blue-400" />
                        ) : (
                          <Clock className="w-5 h-5 text-yellow-400 animate-pulse" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {lecture.subject && (
                            <span className="text-[11px] text-slate-400 bg-slate-700/40 px-1.5 py-0.5 rounded">
                              {lecture.subject}
                            </span>
                          )}
                          <span className="text-[11px] text-slate-500">
                            {formatDate(lecture.created_at)}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {formatDuration(lecture.duration_seconds)}
                          </span>
                          {isReady && lecture.quality_score != null && (
                            <span className="text-[11px] text-green-400">
                              {lecture.quality_score}% quality
                            </span>
                          )}
                        </div>
                        {topics.length > 0 && (
                          <div className="hidden sm:flex flex-wrap gap-1.5 mt-1.5">
                            {topics.map((topic) => (
                              <span
                                key={topic}
                                className="text-[10px] text-slate-300 bg-slate-700/30 px-1.5 py-0.5 rounded"
                              >
                                {topic}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Delete — top right */}
                      <button
                        onClick={() => handleDelete(lecture.id, title)}
                        disabled={deletingId === lecture.id}
                        className="flex items-center text-slate-500 hover:text-red-400 p-1.5 rounded-lg transition-colors disabled:opacity-40 flex-shrink-0"
                        title="Delete lecture"
                      >
                        {deletingId === lecture.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Actions — bottom row */}
                    <div className="flex items-center gap-2 mt-3 pl-[52px]">
                      {isReady ? (
                        <>
                          <Link
                            href={`/lecture/${lecture.id}`}
                            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-700/50 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Notes
                          </Link>
                          <Link
                            href={`/lecture/${lecture.id}/learn`}
                            className="flex items-center gap-1.5 text-xs text-blue-300 hover:text-blue-200 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <GraduationCap className="w-3.5 h-3.5" />
                            Learn
                          </Link>
                        </>
                      ) : (
                        <span className="text-xs text-yellow-400 bg-yellow-500/10 px-2.5 py-1 rounded-lg">
                          Processing...
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && filtered.length === 0 && (
            <div className="text-center py-14">
              <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <Upload className="w-7 h-7 text-slate-600" />
              </div>
              <p className="text-white font-medium mb-1.5 text-sm">No lectures found</p>
              <p className="text-xs text-slate-400 mb-5">
                {search
                  ? "Try a different search term"
                  : "Upload your first lecture to get started"}
              </p>
              <Link
                href="/upload"
                className="inline-flex items-center gap-2 text-sm bg-gradient-to-r from-blue-600 to-blue-500 text-white px-5 py-2.5 rounded-[10px] font-medium shadow-md shadow-blue-500/20 transition-all"
              >
                <Upload className="w-4 h-4" />
                Upload Lecture
              </Link>
            </div>
          )}
        </main>
      </div>
      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0F172A] border-t border-slate-800/60 backdrop-blur-xl">
        <div className="flex items-center justify-around h-14">
          <Link href="/dashboard" className="flex flex-col items-center gap-0.5 text-blue-400">
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-medium">Home</span>
          </Link>
          <Link href="/upload" className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-white">
            <Upload className="w-5 h-5" />
            <span className="text-[10px] font-medium">Upload</span>
          </Link>
          <Link href="#" className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-white">
            <User className="w-5 h-5" />
            <span className="text-[10px] font-medium">Profile</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
