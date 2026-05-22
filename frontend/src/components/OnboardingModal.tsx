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
import { ArrowRight, Loader2 } from "lucide-react";
import StratumLogo from "@/components/StratumLogo";

export default function OnboardingModal() {
  const { user, isLoaded } = useUser();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
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
    setError("");
    try {
      await user.update({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      localStorage.setItem("lectly_onboarded", "true");
      setDismissed(true);
    } catch (err) {
      console.error("Failed to update name:", err);
      setError("Something went wrong. Please try again.");
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
      <div className="bg-paper border border-[rgba(217,185,130,0.25)] rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-5">
          <StratumLogo size={40} />
          <span
            className="text-xl font-bold text-ink tracking-tight"
            style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}
          >
            Lectly
          </span>
        </div>

        <h2
          className="text-lg font-bold text-ink text-center mb-1"
          style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}
        >
          Welcome to Lectly!
        </h2>
        <p className="text-sm text-ink-m text-center mb-5">
          What should we call you?
        </p>

        <div className="space-y-3 mb-5">
          <div>
            <label className="block text-xs font-medium text-ink-m mb-1.5">
              First name
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="e.g. Chioma"
              maxLength={50}
              autoFocus
              className="w-full px-3 py-2.5 bg-cream border border-[rgba(217,185,130,0.3)] rounded-lg text-sm text-ink placeholder:text-ink-f focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-m mb-1.5">
              Last name <span className="text-ink-f">(optional)</span>
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="e.g. Okafor"
              maxLength={50}
              className="w-full px-3 py-2.5 bg-cream border border-[rgba(217,185,130,0.3)] rounded-lg text-sm text-ink placeholder:text-ink-f focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
            />
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-500 text-center mb-3">{error}</p>
        )}

        <button
          onClick={handleSave}
          disabled={!firstName.trim() || saving}
          className="w-full py-2.5 bg-ink hover:bg-ink-h disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
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
          className="w-full mt-2 py-2 text-xs text-ink-f hover:text-ink-m transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
