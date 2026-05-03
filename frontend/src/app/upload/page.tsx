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
} from "lucide-react";
import { uploadLecture, processLecture } from "@/lib/api";

const ACCEPTED_EXTENSIONS = /\.(mp3|wav|m4a|aac|ogg|mp4|wma|flac|webm|opus|caf)$/i;
const MAX_SIZE_MB = 500;

type UploadState = "idle" | "selected" | "uploading" | "processing" | "done" | "error";
type ProcessStep = { label: string; done: boolean; active: boolean };

export default function UploadPage() {
  const router = useRouter();
  const { getToken } = useAuth();

  // Sync Clerk token for API calls
  useEffect(() => {
    getToken().then(setAuthToken);
  }, [getToken]);
  const [state, setState] = useState<UploadState>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [subject, setSubject] = useState("");
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
    // Check by extension (reliable on all platforms) or MIME type starting with "audio/"
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
      // Step 1: Upload
      updateStep(0, false, true);
      const uploadResult = await uploadLecture(file, subject || undefined);
      setLectureId(uploadResult.id);
      updateStep(0, true, false);

      // Step 2: Process (transcribe + generate notes)
      updateStep(1, false, true);

      const processResult = await processLecture(uploadResult.id);

      updateStep(1, true, false);
      updateStep(2, true, false);

      // Done!
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
    <div className="flex flex-col min-h-screen bg-[#0F172A]">
      {/* Nav */}
      <nav className="border-b border-slate-800 bg-[#0F172A]/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">Lectly</span>
          </Link>
          <Link
            href="/dashboard"
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            My Lectures
          </Link>
        </div>
      </nav>

      {/* Main */}
      <main className="flex-1 px-4 py-10 sm:py-12">
        <div className="w-full max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white mb-1.5">
              Upload Lecture
            </h1>
            <p className="text-sm text-slate-400">
              Upload your audio file and we&apos;ll generate smart notes.
            </p>
          </div>

          {/* Upload Zone + Form — Desktop two-column */}
          {(state === "idle" || state === "error") && (
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
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-slate-800 flex items-center justify-center">
                    <Upload className="w-7 h-7 text-blue-400" />
                  </div>
                  <p className="text-base text-white font-semibold mb-1">
                    Tap below to upload your lecture
                  </p>
                  <p className="text-sm text-slate-400 mb-4">
                    MP3, M4A, WAV up to {MAX_SIZE_MB}MB
                  </p>
                  <label
                    htmlFor="audio-upload"
                    className="inline-block bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-3 rounded-[10px] text-base font-medium shadow-md shadow-blue-500/20 cursor-pointer active:scale-95 transition-transform"
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
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Subject
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-[#0F172A] border border-slate-700 rounded-[10px] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Select subject...</option>
                    <option value="medicine">Medicine & Pharmacy</option>
                    <option value="law">Law</option>
                    <option value="engineering">Engineering</option>
                    <option value="science">Sciences</option>
                    <option value="business">Business & Economics</option>
                    <option value="arts">Arts & Humanities</option>
                    <option value="cs">Computer Science</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Class Code (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CSC301"
                    className="w-full bg-[#0F172A] border border-slate-700 rounded-[10px] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                {/* Record Live card */}
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 text-center">
                  <Mic className="w-7 h-7 text-blue-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-white">Record Live</p>
                  <p className="text-xs text-slate-400">Start recording a lecture</p>
                  <p className="text-[10px] text-slate-600 mt-1">Coming soon</p>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {state === "error" && error && (
            <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* File Selected */}
          {state === "selected" && file && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 max-w-2xl">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-11 h-11 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <FileAudio className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate text-sm">{file.name}</p>
                  <p className="text-xs text-slate-400">{formatSize(file.size)}</p>
                </div>
                <button
                  onClick={removeFile}
                  className="p-2 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Subject + Class Code */}
              <div className="grid sm:grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Subject
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-[#0F172A] border border-slate-700 rounded-[10px] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Auto-detect</option>
                    <option value="medicine">Medicine & Pharmacy</option>
                    <option value="law">Law</option>
                    <option value="engineering">Engineering</option>
                    <option value="science">Sciences</option>
                    <option value="business">Business & Economics</option>
                    <option value="arts">Arts & Humanities</option>
                    <option value="cs">Computer Science</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Class Code (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CSC301"
                    className="w-full bg-[#0F172A] border border-slate-700 rounded-[10px] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                onClick={processFile}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white py-3 rounded-xl font-semibold transition-all shadow-md shadow-blue-500/20"
              >
                <Upload className="w-5 h-5" />
                Process Lecture
              </button>
            </div>
          )}

          {/* Processing */}
          {state === "processing" && (
            <div className="max-w-lg mx-auto text-center py-8">
              {/* Dual spinner */}
              <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full border-[3px] border-slate-800 border-t-blue-500 animate-spin" />
                <div className="absolute inset-[8px] rounded-full border-[3px] border-transparent border-t-green-500 animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">
                Processing Your Lecture
              </h3>
              <p className="text-sm text-slate-400 mb-7">
                This usually takes 2-3 minutes
              </p>
              <div className="space-y-2 text-left max-w-xs mx-auto mb-6">
                {steps.map((step) => (
                  <div
                    key={step.label}
                    className="flex items-center gap-3 text-sm py-1"
                  >
                    {step.done ? (
                      <CheckCircle2 className="w-[18px] h-[18px] text-green-400" />
                    ) : step.active ? (
                      <Loader2 className="w-[18px] h-[18px] text-blue-400 animate-spin" />
                    ) : (
                      <div className="w-[18px] h-[18px] rounded-full border-2 border-slate-600 flex-shrink-0" />
                    )}
                    <span
                      className={
                        step.done
                          ? "text-green-400"
                          : step.active
                          ? "text-white font-semibold"
                          : "text-slate-500"
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
                  <span className="text-xs text-slate-400">Progress</span>
                  <span className="text-xs text-blue-400 font-semibold">
                    {steps.filter(s => s.done).length === 0 && steps.some(s => s.active) ? "33%" :
                     steps.filter(s => s.done).length === 1 ? "45%" :
                     steps.filter(s => s.done).length === 2 ? "80%" :
                     steps.filter(s => s.done).length === 3 ? "100%" : "0%"}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-500"
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
            <div className="max-w-lg mx-auto bg-slate-800/50 border border-green-500/30 rounded-2xl p-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <p className="text-xl font-bold text-white mb-2">
                Your notes are ready!
              </p>
              <p className="text-sm text-slate-400 mb-7">
                Lecture processed successfully. View your structured notes or start Learn Mode.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href={`/lecture/${lectureId}`}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-2.5 rounded-xl font-semibold transition-all shadow-md shadow-blue-500/20"
                >
                  View Notes
                </Link>
                <button
                  onClick={removeFile}
                  className="flex items-center gap-2 text-slate-300 px-6 py-2.5 rounded-xl font-medium border border-slate-700 hover:border-slate-600 transition-all"
                >
                  Upload Another
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
