"use client";

/**
 * OnboardingModal — Shown once after sign-up if the user has no name set.
 *
 * This happens when someone signs up with email/password (as opposed to Google,
 * which auto-populates the name). Asks for first and last name, then updates
 * the Clerk user profile.
 */

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { BookOpen, ArrowRight, Loader2 } from "lucide-react";

export default function OnboardingModal() {
  const { user, isLoaded } = useUser();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Don't show if:
  // - Clerk hasn't loaded yet
  // - User is not signed in
  // - User already has a first name
  // - User has already dismissed this modal
  if (!isLoaded || !user || user.firstName || dismissed) {
    return null;
  }

  // Check localStorage so we don't keep showing this after dismiss
  if (typeof window !== "undefined") {
    const onboarded = localStorage.getItem("lectly_onboarded");
    if (onboarded === "true") return null;
  }

  const handleSave = async () => {
    if (!firstName.trim()) return;
    setSaving(true);
    try {
      await user.update({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      localStorage.setItem("lectly_onboarded", "true");
      setDismissed(true);
    } catch (err) {
      console.error("Failed to update name:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    localStorage.setItem("lectly_onboarded", "true");
    setDismissed(true);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-5">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-purple-700 flex items-center justify-center shadow-sm shadow-purple-500/15">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <span
            className="text-xl font-bold text-[#1a1815] tracking-tight"
            style={{ fontFamily: "'Georgia', serif" }}
          >
            Lectly
          </span>
        </div>

        <h2
          className="text-lg font-bold text-[#1a1815] text-center mb-1"
          style={{ fontFamily: "'Georgia', serif" }}
        >
          Welcome to Lectly!
        </h2>
        <p className="text-sm text-[#8a7f6f] text-center mb-5">
          What should we call you?
        </p>

        <div className="space-y-3 mb-5">
          <div>
            <label className="block text-xs font-medium text-[#8a7f6f] mb-1.5">
              First name
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="e.g. Chioma"
              autoFocus
              className="w-full px-3 py-2.5 bg-[#F7F4EE] border border-[rgba(217,185,130,0.3)] rounded-lg text-sm text-[#1a1815] placeholder:text-[#b5ad9e] focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400/20"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#8a7f6f] mb-1.5">
              Last name <span className="text-[#b5ad9e]">(optional)</span>
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="e.g. Okafor"
              className="w-full px-3 py-2.5 bg-[#F7F4EE] border border-[rgba(217,185,130,0.3)] rounded-lg text-sm text-[#1a1815] placeholder:text-[#b5ad9e] focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400/20"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={!firstName.trim() || saving}
          className="w-full py-2.5 bg-[#1a1815] hover:bg-[#2a2520] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              Get started
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        <button
          onClick={handleSkip}
          className="w-full mt-2 py-2 text-xs text-[#b5ad9e] hover:text-[#8a7f6f] transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
