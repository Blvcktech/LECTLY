"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { setAuthToken } from "@/lib/auth";
import {
  Upload,
  BookOpen,
  Mic,
  FileAudio,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Home,
  FileText,
  User,
} from "lucide-react";
import { uploadLecture, processLecture, getUserLimits, type UserLimits } from "@/lib/api";

const ACCEPTED_EXTENSIONS = /\.(mp3|wav|m4a|aac|ogg|mp4|wma|flac|webm|opus|caf)$/i;
const MAX_SIZE_MB = 500;

type UploadState = "idle" | "selected" | "uploading" | "processing" | "done" | "error";
type ProcessStep = { label: string; done: boolean; active: boolean };

export default function UploadPage() {
  const router = useRouter();
  const { getToken } = useAuth();

  const [limits, setLimits] = useState<UserLimits | null>(null);

  useEffect(() => {
    getToken().then((token) => {
      setAuthToken(token);
      // Fetch limits after token is set
      getUserLimits().then(setLimits).catch(() => {});
    });
  }, [getToken]);
  const [state, setState] = useState<UploadState>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [courseCode, setCourseCode] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [lectureId, setLectureId] = useState("");
  const [steps, setSteps] = useState<ProcessStep[]>([
    { label: "Uploading audio", done: false, active: false },
    { label: "Transcribing with AI", done: false, active: false },
    { label: "Generating structured notes", done: false, active: false },
  ]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    const hasValidExtension = ACCEPTED_EXTENSIONS.test(f.name);
    const hasAudioMime = f.type.startsWith("audio/");

    if (!hasValidExtension && !hasAudioMime) {
      setError("Please upload an audio file (MP3, WAV, M4A, AAC, or OGG).");
      setState("error");
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File is too large. Maximum size is ${MAX_SIZE_MB}MB.`);
      setState("error");
      return;
    }
    setFile(f);
    setError("");
    setState("selected");
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const removeFile = () => {
    setFile(null);
    setState("idle");
    setError("");
    setProgress(0);
    setLectureId("");
    setSteps([
      { label: "Uploading audio", done: false, active: false },
      { label: "Transcribing with AI", done: false, active: false },
      { label: "Generating structured notes", done: false, active: false },
    ]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const updateStep = (index: number, done: boolean, active: boolean) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, done, active } : s))
    );
  };

  const processFile = async () => {
    if (!file) return;
    setState("processing");

    try {
      updateStep(0, false, true);
      const uploadResult = await uploadLecture(file, undefined);
      setLectureId(uploadResult.id);
      updateStep(0, true, false);

      updateStep(1, false, true);
      const processResult = await processLecture(uploadResult.id);
      updateStep(1, true, false);
      updateStep(2, true, false);

      setState("done");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
      setState("error");
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F4EE]">
      {/* Nav */}
      <nav className="border-b border-[rgba(217,185,130,0.25)] bg-[#FDFCF9]/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-[#1a1815]" style={{ fontFamily: "'Georgia', serif" }}>Lectly</span>
          </Link>
          <Link
            href="/dashboard"
            className="text-sm text-[#8a7f6f] hover:text-[#1a1815] transition-colors"
          >
            My Lectures
          </Link>
        </div>
      </nav>

      {/* Main */}
      <main className="flex-1 px-4 py-10 sm:py-12 pb-24">
        <div className="w-full max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-[#1a1815] mb-1.5" style={{ fontFamily: "'Georgia', serif" }}>
              Upload Lecture
            </h1>
            <p className="text-sm text-[#8a7f6f]">
              Upload your audio file and we&apos;ll generate smart notes.
            </p>
          </div>

          {/* Lecture limit info */}
          {limits && limits.can_upload && (
            <div className="mb-4 flex items-center gap-2 text-xs text-[#8a7f6f]">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {limits.lectures_remaining} of {limits.lectures_limit} free lectures remaining
            </div>
          )}

          {/* Limit reached — upgrade prompt */}
          {limits && !limits.can_upload && (
            <div className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-2xl p-8 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-amber-600" />
              </div>
              <h2
                className="text-lg font-bold text-[#1a1815] mb-2"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                Free tier limit reached
              </h2>
              <p className="text-sm text-[#8a7f6f] mb-5 max-w-sm mx-auto">
                You&apos;ve used all {limits.lectures_limit} free lectures. Upgrade to Basic for {limits.lectures_limit === 3 ? "8" : "more"} lectures per month.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/profile/subscription"
                  className="inline-flex items-center justify-center bg-[#1a1815] hover:bg-[#2a2520] text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                >
                  View plans
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center border border-[rgba(217,185,130,0.35)] text-[#1a1815] px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#F7F4EE] transition-colors"
                >
                  Back to lectures
                </Link>
              </div>
            </div>
          )}

          {/* Upload Zone + Form */}
          {(state === "idle" || state === "error") && (!limits || limits.can_upload) && (
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Upload zone */}
              <div className="flex-1">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  className={`upload-zone rounded-2xl p-6 sm:p-10 lg:p-14 text-center transition-all h-full flex flex-col items-center justify-center ${
                    dragOver ? "dragover" : ""
                  }`}
                >
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#EDE8DF] flex items-center justify-center">
                    <Upload className="w-7 h-7 text-purple-600" />
                  </div>
                  <p className="text-base text-[#1a1815] font-semibold mb-1">
                    Tap below to upload your lecture
                  </p>
                  <p className="text-sm text-[#8a7f6f] mb-4">
                    MP3, M4A, WAV up to {MAX_SIZE_MB}MB
                  </p>
                  <label
                    htmlFor="audio-upload"
                    className="inline-block bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-[10px] text-base font-medium shadow-md shadow-purple-500/15 cursor-pointer active:scale-95 transition-transform"
                  >
                    Choose File
                  </label>
                  <input
                    id="audio-upload"
                    ref={inputRef}
                    type="file"
                    accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.mp4,.flac,.webm"
                    onChange={onFileChange}
                    style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden", pointerEvents: "none" }}
                  />
                </div>
              </div>

              {/* Form fields */}
              <div className="w-full lg:w-72 flex-shrink-0 space-y-4">
                {/* Auto-detect info */}
                <div className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    <p className="text-xs font-semibold text-[#1a1815] uppercase tracking-wider">Subject</p>
                  </div>
                  <p className="text-sm text-[#8a7f6f]">
                    Auto-detected from your lecture content. No need to pick manually.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#8a7f6f] uppercase tracking-wider mb-1.5">
                    Course Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    placeholder="e.g. CSC 301"
                    className="w-full bg-[#FDFCF9] border border-[rgba(217,185,130,0.3)] rounded-[10px] px-3.5 py-2.5 text-sm text-[#1a1815] placeholder:text-[#8a7f6f] focus:border-purple-400 focus:outline-none"
                  />
                </div>

                {/* Record Live card */}
                <div className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-xl p-4 text-center">
                  <Mic className="w-7 h-7 text-purple-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-[#1a1815]">Record Live</p>
                  <p className="text-xs text-[#8a7f6f]">Start recording a lecture</p>
                  <p className="text-[10px] text-[#8a7f6f] mt-1">Coming soon</p>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {state === "error" && error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* File Selected */}
          {state === "selected" && file && (
            <div className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.3)] rounded-2xl p-6 max-w-2xl">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-11 h-11 rounded-xl bg-purple-500/8 flex items-center justify-center">
                  <FileAudio className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#1a1815] font-medium truncate text-sm">{file.name}</p>
                  <p className="text-xs text-[#8a7f6f]">{formatSize(file.size)}</p>
                </div>
                <button
                  onClick={removeFile}
                  className="p-2 text-[#8a7f6f] hover:text-[#1a1815] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Course Code + Auto-detect hint */}
              <div className="flex items-center gap-4 mb-5">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-[#8a7f6f] uppercase tracking-wider mb-1.5">
                    Course Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    placeholder="e.g. CSC 301"
                    className="w-full bg-[#F7F4EE] border border-[rgba(217,185,130,0.3)] rounded-[10px] px-3.5 py-2.5 text-sm text-[#1a1815] placeholder:text-[#8a7f6f] focus:border-purple-400 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-1.5 pt-5">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  <span className="text-xs text-[#8a7f6f]">Subject auto-detected</span>
                </div>
              </div>

              <button
                onClick={processFile}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white py-3 rounded-xl font-semibold transition-all shadow-md shadow-purple-500/15"
              >
                <Upload className="w-5 h-5" />
                Process Lecture
              </button>
            </div>
          )}

          {/* Processing */}
          {state === "processing" && (
            <div className="max-w-lg mx-auto text-center py-8">
              {/* Spinner */}
              <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full border-[3px] border-[#EDE8DF] border-t-purple-500 animate-spin" />
                <div className="absolute inset-[8px] rounded-full border-[3px] border-transparent border-t-blue-500 animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
              </div>
              <h3 className="text-lg font-bold text-[#1a1815] mb-1" style={{ fontFamily: "'Georgia', serif" }}>
                Processing Your Lecture
              </h3>
              <p className="text-sm text-[#8a7f6f] mb-7">
                This usually takes 2-3 minutes
              </p>
              <div className="space-y-2 text-left max-w-xs mx-auto mb-6">
                {steps.map((step) => (
                  <div
                    key={step.label}
                    className="flex items-center gap-3 text-sm py-1"
                  >
                    {step.done ? (
                      <CheckCircle2 className="w-[18px] h-[18px] text-green-600" />
                    ) : step.active ? (
                      <Loader2 className="w-[18px] h-[18px] text-purple-500 animate-spin" />
                    ) : (
                      <div className="w-[18px] h-[18px] rounded-full border-2 border-[rgba(217,185,130,0.4)] flex-shrink-0" />
                    )}
                    <span
                      className={
                        step.done
                          ? "text-green-700"
                          : step.active
                          ? "text-[#1a1815] font-semibold"
                          : "text-[#8a7f6f]"
                      }
                    >
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
              {/* Progress bar */}
              <div className="max-w-xs mx-auto">
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs text-[#8a7f6f]">Progress</span>
                  <span className="text-xs text-purple-600 font-semibold">
                    {steps.filter(s => s.done).length === 0 && steps.some(s => s.active) ? "33%" :
                     steps.filter(s => s.done).length === 1 ? "45%" :
                     steps.filter(s => s.done).length === 2 ? "80%" :
                     steps.filter(s => s.done).length === 3 ? "100%" : "0%"}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-[#EDE8DF] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-500"
                    style={{
                      width: steps.filter(s => s.done).length === 0 && steps.some(s => s.active) ? "33%" :
                             steps.filter(s => s.done).length === 1 ? "45%" :
                             steps.filter(s => s.done).length === 2 ? "80%" :
                             steps.filter(s => s.done).length === 3 ? "100%" : "0%"
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Done */}
          {state === "done" && (
            <div className="max-w-lg mx-auto bg-[#FDFCF9] border border-green-300/50 rounded-2xl p-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <p className="text-xl font-bold text-[#1a1815] mb-2" style={{ fontFamily: "'Georgia', serif" }}>
                Your notes are ready!
              </p>
              <p className="text-sm text-[#8a7f6f] mb-7">
                Lecture processed successfully. View your structured notes or start Learn Mode.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href={`/lecture/${lectureId}`}
                  className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold transition-all shadow-md shadow-purple-500/15"
                >
                  View Notes
                </Link>
                <button
                  onClick={removeFile}
                  className="flex items-center gap-2 text-[#2C2A25] px-6 py-2.5 rounded-xl font-medium border border-[rgba(217,185,130,0.35)] hover:border-[rgba(217,185,130,0.6)] transition-all"
                >
                  Upload Another
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#FDFCF9] border-t border-[rgba(217,185,130,0.25)] backdrop-blur-xl">
        <div className="flex items-center justify-around h-14">
          <Link href="/dashboard" className="flex flex-col items-center gap-0.5 text-[#8a7f6f] hover:text-[#1a1815]">
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-medium">Home</span>
          </Link>
          <Link href="/lectures" className="flex flex-col items-center gap-0.5 text-[#8a7f6f] hover:text-[#1a1815]">
            <FileText className="w-5 h-5" />
            <span className="text-[10px] font-medium">Lectures</span>
          </Link>
          <Link href="/upload" className="flex flex-col items-center gap-0.5 text-purple-600">
            <Upload className="w-5 h-5" />
            <span className="text-[10px] font-medium">Upload</span>
          </Link>
          <Link href="/profile" className="flex flex-col items-center gap-0.5 text-[#8a7f6f] hover:text-[#1a1815]">
            <User className="w-5 h-5" />
            <span className="text-[10px] font-medium">You</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
