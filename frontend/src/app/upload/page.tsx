"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  Upload,
  Mic,
  FileAudio,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Home,
  FileText,
  User,
  RotateCcw,
  WifiOff,
} from "lucide-react";
import { uploadLecture, processLecture, getUserLimits, type UserLimits } from "@/lib/api";
import StratumLogo from "@/components/StratumLogo";

const ACCEPTED_EXTENSIONS = /\.(mp3|wav|m4a|aac|ogg|mp4|wma|flac|webm|opus|caf)$/i;
const MAX_SIZE_MB = 500;

type UploadState = "idle" | "selected" | "uploading" | "processing" | "done" | "error";
type ProcessStep = { label: string; done: boolean; active: boolean };

export default function UploadPage() {
  const router = useRouter();
  const { isLoaded: authLoaded } = useAuth();

  const [limits, setLimits] = useState<UserLimits | null>(null);

  useEffect(() => {
    if (!authLoaded) return;
    // freshAuthHeaders() inside getUserLimits handles token refresh automatically
    getUserLimits().then(setLimits).catch(() => {});
  }, [authLoaded]);
  const [state, setState] = useState<UploadState>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [courseCode, setCourseCode] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [lectureId, setLectureId] = useState("");
  const [steps, setSteps] = useState<ProcessStep[]>([
    { label: "Uploading audio", done: false, active: false },
    { label: "Sending to transcription service", done: false, active: false },
    { label: "Transcribing with AI", done: false, active: false },
    { label: "Generating structured notes", done: false, active: false },
  ]);
  const [failedStep, setFailedStep] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);
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
    setFailedStep(null);
    setRetryCount(0);
    setSteps([
      { label: "Uploading audio", done: false, active: false },
      { label: "Sending to transcription service", done: false, active: false },
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

  const getErrorMessage = (err: unknown, step: number): string => {
    const raw = err instanceof Error ? err.message : "";

    // Network / connection errors
    if (raw === "Failed to fetch" || raw.includes("NetworkError") || raw.includes("net::")) {
      return "Can't reach the server. Check your internet connection and try again.";
    }

    // Timeout
    if (raw.includes("aborted") || raw.includes("timeout") || raw.includes("AbortError")) {
      return step === 0
        ? "Upload timed out — your internet connection may be too slow for this file size. Try connecting to WiFi or uploading a smaller file."
        : "Processing took too long. This can happen with very long lectures — try again.";
    }

    // Server errors
    if (raw.includes("500") || raw.includes("Internal Server Error")) {
      return "Our server hit an error. This is on our end — please try again in a moment.";
    }

    // Auth errors
    if (raw.includes("401") || raw.includes("Authentication")) {
      return "Your session expired. Please refresh the page and try again.";
    }

    // Tier limit
    if (raw.includes("403") || raw.includes("limit")) {
      return raw;
    }

    // Fallback
    return raw || "Something went wrong. Please try again.";
  };

  const processFile = async (retryFromStep?: number) => {
    if (!file) return;
    setState("processing");
    setError("");
    setFailedStep(null);

    const startStep = retryFromStep ?? 0;
    // Use a local variable because React state updates are async
    let currentLectureId = lectureId;

    try {
      // Step 0: Upload (skip if retrying from a later step)
      // Note: freshAuthHeaders() in api.ts handles token refresh automatically
      if (startStep <= 0) {
        updateStep(0, false, true);
        const uploadResult = await uploadLecture(file, courseCode.trim() || undefined);
        currentLectureId = uploadResult.id;
        setLectureId(uploadResult.id);
        updateStep(0, true, false);
      }

      // Step 1-2: Process (transcribe + generate notes) — runs in background, polls for status
      if (startStep <= 1) {
        if (!currentLectureId) {
          throw new Error("No lecture ID available. Please try uploading again.");
        }
        updateStep(1, false, true);

        // Notify the NotificationWatcher so it starts tracking this lecture
        window.dispatchEvent(new CustomEvent("lectly:upload-started"));

        await processLecture(currentLectureId, (status) => {
          // Update UI steps based on backend processing_step changes
          if (status === "uploading_to_ai") {
            updateStep(1, false, true);
          } else if (status === "transcribing" || status === "cleaning") {
            updateStep(1, true, false);
            updateStep(2, false, true);
          } else if (status === "generating_notes") {
            updateStep(1, true, false);
            updateStep(2, true, false);
            updateStep(3, false, true);
          } else if (status === "ready") {
            updateStep(1, true, false);
            updateStep(2, true, false);
            updateStep(3, true, false);
          }
        });
        updateStep(1, true, false);
        updateStep(2, true, false);
        updateStep(3, true, false);
      }

      setState("done");
      setRetryCount(0);
    } catch (err) {
      // Determine which step failed
      const doneSteps = steps.filter(s => s.done).length;
      const failed = doneSteps === 0 ? 0 : doneSteps;
      setFailedStep(failed);
      setRetryCount(prev => prev + 1);

      // Mark the active step as no longer active
      setSteps(prev => prev.map(s => ({ ...s, active: false })));

      const message = getErrorMessage(err, failed);
      setError(message);
      setState("error");
    }
  };

  const retryFromFailedStep = () => {
    if (failedStep === null) {
      processFile();
    } else if (failedStep === 0) {
      // Upload failed — need to start over
      processFile(0);
    } else {
      // Processing failed — retry from processing step (upload already done)
      processFile(1);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col min-h-screen bg-cream">
      {/* Nav */}
      <nav className="border-b border-[rgba(217,185,130,0.25)] bg-paper/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <StratumLogo size={32} />
            <span className="text-xl font-bold text-ink" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>Lectly</span>
          </Link>
          <Link
            href="/dashboard"
            className="text-sm text-ink-m hover:text-ink transition-colors"
          >
            My Lectures
          </Link>
        </div>
      </nav>

      {/* Main */}
      <main className="flex-1 px-4 py-10 sm:py-12 pb-24">
        <div className="w-full max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-ink mb-1.5" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
              Upload Lecture
            </h1>
            <p className="text-sm text-ink-m">
              Upload your audio file and we&apos;ll generate smart notes.
            </p>
          </div>

          {/* Lecture limit info */}
          {limits && limits.can_upload && (
            <div className="mb-4 flex items-center gap-2 text-xs text-ink-m">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {limits.lectures_remaining} {limits.tier === "free" ? "free " : ""}lecture{limits.lectures_remaining !== 1 ? "s" : ""} remaining
              {limits.tier !== "free" && (
                <span className="text-accent font-medium ml-1">({limits.tier.charAt(0).toUpperCase() + limits.tier.slice(1)} plan)</span>
              )}
            </div>
          )}

          {/* Limit reached — upgrade prompt */}
          {limits && !limits.can_upload && (
            <div className="bg-paper border border-[rgba(217,185,130,0.25)] rounded-2xl p-8 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-amber-600" />
              </div>
              <h2
                className="text-lg font-bold text-ink mb-2"
                style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}
              >
                {limits.tier === "free" ? "Free tier" : limits.tier.charAt(0).toUpperCase() + limits.tier.slice(1) + " plan"} limit reached
              </h2>
              <p className="text-sm text-ink-m mb-5 max-w-sm mx-auto">
                {limits.tier === "free"
                  ? `You’ve used all ${limits.lectures_limit} free lectures. Upgrade to Basic for 8 lectures per month.`
                  : `You’ve used all your ${limits.tier.charAt(0).toUpperCase() + limits.tier.slice(1)} plan lectures. ${limits.tier === "basic" ? "Upgrade to Pro for 20 lectures per month." : "Delete old lectures to make room or wait for your next billing cycle."}`
                }
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/profile/subscription"
                  className="inline-flex items-center justify-center bg-ink hover:bg-ink-h text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                >
                  View plans
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center border border-[rgba(217,185,130,0.35)] text-ink px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-cream transition-colors"
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
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-cream-d flex items-center justify-center">
                    <Upload className="w-7 h-7 text-accent" />
                  </div>
                  <p className="text-base text-ink font-semibold mb-1">
                    Tap below to upload your lecture
                  </p>
                  <p className="text-sm text-ink-m mb-4">
                    MP3, M4A, WAV up to {MAX_SIZE_MB}MB
                  </p>
                  <label
                    htmlFor="audio-upload"
                    className="inline-block bg-accent hover:bg-accent-l text-white px-6 py-3 rounded-[10px] text-base font-medium shadow-md shadow-black/10 cursor-pointer active:scale-95 transition-transform"
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
                <div className="bg-paper border border-[rgba(217,185,130,0.25)] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                    <p className="text-xs font-semibold text-ink uppercase tracking-wider">Subject</p>
                  </div>
                  <p className="text-sm text-ink-m">
                    Auto-detected from your lecture content. No need to pick manually.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-m uppercase tracking-wider mb-1.5">
                    Course Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    placeholder="e.g. CSC 301"
                    className="w-full bg-paper border border-[rgba(217,185,130,0.3)] rounded-[10px] px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-m focus:border-accent focus:outline-none"
                  />
                </div>

                {/* Record Live card */}
                <div className="bg-paper border border-[rgba(217,185,130,0.25)] rounded-xl p-4 text-center">
                  <Mic className="w-7 h-7 text-accent mx-auto mb-2" />
                  <p className="text-sm font-semibold text-ink">Record Live</p>
                  <p className="text-xs text-ink-m">Start recording a lecture</p>
                  <p className="text-[10px] text-ink-m mt-1">Coming soon</p>
                </div>
              </div>
            </div>
          )}

          {/* Error with retry */}
          {state === "error" && error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-5">
              <div className="flex items-start gap-3 mb-4">
                {error.includes("internet") || error.includes("server") ? (
                  <WifiOff className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="text-sm font-semibold text-red-800 mb-1">
                    {failedStep === 0 ? "Upload failed" : "Processing failed"}
                  </p>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>

              {/* Show completed steps if any */}
              {failedStep !== null && failedStep > 0 && (
                <div className="mb-4 pl-8">
                  {steps.map((step, i) => (
                    <div key={step.label} className="flex items-center gap-2 text-xs py-0.5">
                      {step.done ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                      ) : i === failedStep ? (
                        <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-[rgba(217,185,130,0.4)]" />
                      )}
                      <span className={step.done ? "text-green-700" : i === failedStep ? "text-red-700 font-medium" : "text-ink-m"}>
                        {step.label}
                        {i === failedStep && " — failed"}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3 pl-8">
                {retryCount < 3 && !error.includes("limit") && !error.includes("session expired") && (
                  <button
                    onClick={() => retryFromFailedStep()}
                    className="flex items-center gap-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    {failedStep === 0 ? "Retry upload" : "Retry processing"}
                  </button>
                )}
                <button
                  onClick={removeFile}
                  className="text-sm text-red-600 hover:text-red-800 font-medium transition-colors"
                >
                  Start over
                </button>
                {retryCount >= 3 && (
                  <span className="text-xs text-red-500 ml-auto">
                    Multiple retries failed. Try a different file or come back later.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* File Selected */}
          {state === "selected" && file && (
            <div className="bg-paper border border-[rgba(217,185,130,0.3)] rounded-2xl p-6 max-w-2xl">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-11 h-11 rounded-xl bg-accent/8 flex items-center justify-center">
                  <FileAudio className="w-5 h-5 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-ink font-medium truncate text-sm">{file.name}</p>
                  <p className="text-xs text-ink-m">{formatSize(file.size)}</p>
                </div>
                <button
                  onClick={removeFile}
                  className="p-2 text-ink-m hover:text-ink transition-colors"
                  aria-label="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Course Code + Auto-detect hint */}
              <div className="flex items-center gap-4 mb-5">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-ink-m uppercase tracking-wider mb-1.5">
                    Course Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    placeholder="e.g. CSC 301"
                    className="w-full bg-cream border border-[rgba(217,185,130,0.3)] rounded-[10px] px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-m focus:border-accent focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-1.5 pt-5">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                  <span className="text-xs text-ink-m">Subject auto-detected</span>
                </div>
              </div>

              <button
                onClick={() => processFile()}
                className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-l text-white py-3 rounded-xl font-semibold transition-all shadow-md shadow-black/10"
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
                <div className="absolute inset-0 rounded-full border-[3px] border-cream-d border-t-accent animate-spin" />
                <div className="absolute inset-[8px] rounded-full border-[3px] border-transparent border-t-accent-l animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
              </div>
              <h3 className="text-lg font-bold text-ink mb-1" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                Processing your lecture
              </h3>
              <p className="text-sm text-ink-m mb-7">
                {file && file.size > 50 * 1024 * 1024
                  ? "Large file — this may take 5–15 minutes"
                  : file && file.size > 20 * 1024 * 1024
                  ? "This usually takes 3–8 minutes"
                  : "This usually takes 2–5 minutes"}
              </p>
              <div className="space-y-2 text-left max-w-sm mx-auto mb-6">
                {steps.map((step, i) => {
                  const timeEstimates = ["a few seconds", "~30 seconds", "depends on length", "~30–60 seconds"];
                  return (
                    <div key={step.label} className="flex items-center gap-3 text-sm py-1.5">
                      {step.done ? (
                        <CheckCircle2 className="w-[18px] h-[18px] text-green-600 flex-shrink-0" />
                      ) : step.active ? (
                        <Loader2 className="w-[18px] h-[18px] text-accent animate-spin flex-shrink-0" />
                      ) : (
                        <div className="w-[18px] h-[18px] rounded-full border-2 border-[rgba(217,185,130,0.4)] flex-shrink-0" />
                      )}
                      <span className={`flex-1 ${step.done ? "text-green-700" : step.active ? "text-ink font-semibold" : "text-ink-m"}`}>
                        {step.label}
                      </span>
                      {step.done && (
                        <span className="text-[11px] text-green-600 font-medium">Done</span>
                      )}
                      {step.active && (
                        <span className="text-[11px] text-accent font-medium">{timeEstimates[i]}</span>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Progress bar */}
              <div className="max-w-sm mx-auto">
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs text-ink-m">Progress</span>
                  <span className="text-xs text-accent font-semibold">
                    {steps.filter(s => s.done).length === 0 && steps.some(s => s.active) ? "10%" :
                     steps.filter(s => s.done).length === 1 ? "25%" :
                     steps.filter(s => s.done).length === 2 ? "50%" :
                     steps.filter(s => s.done).length === 3 ? "85%" :
                     steps.filter(s => s.done).length === 4 ? "100%" : "0%"}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-cream-d rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-500"
                    style={{
                      width: steps.filter(s => s.done).length === 0 && steps.some(s => s.active) ? "15%" :
                             steps.filter(s => s.done).length === 1 ? "40%" :
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
            <div className="max-w-lg mx-auto bg-paper border border-green-300/50 rounded-2xl p-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <p className="text-xl font-bold text-ink mb-2" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                Your notes are ready!
              </p>
              <p className="text-sm text-ink-m mb-7">
                Lecture processed successfully. View your structured notes or start Learn Mode.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href={`/lecture/${lectureId}`}
                  className="flex items-center gap-2 bg-accent hover:bg-accent-l text-white px-6 py-2.5 rounded-xl font-semibold transition-all shadow-md shadow-black/10"
                >
                  View Notes
                </Link>
                <button
                  onClick={removeFile}
                  className="flex items-center gap-2 text-ink-l px-6 py-2.5 rounded-xl font-medium border border-[rgba(217,185,130,0.35)] hover:border-[rgba(217,185,130,0.6)] transition-all"
                >
                  Upload Another
                </button>
              </div>
            </div>
          )}
        </div>
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
          <Link href="/upload" className="flex flex-col items-center gap-0.5 text-accent">
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
