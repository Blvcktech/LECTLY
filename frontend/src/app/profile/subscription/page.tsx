"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  ArrowLeft,
  Check,
  Sparkles,
  Crown,
  Zap,
  User,
  Home,
  FileText,
  Upload,
  Loader2,
} from "lucide-react";
import { initializePayment, getSubscriptionStatus } from "@/lib/api";
import { useToast } from "@/components/Toast";

export default function SubscriptionPage() {
  const router = useRouter();
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null); // which plan is loading
  const [subscription, setSubscription] = useState<{
    tier: string;
    lectures_limit: number;
    status: string;
  } | null>(null);

  useEffect(() => {
    getSubscriptionStatus()
      .then(setSubscription)
      .catch(() => setSubscription({ tier: "free", lectures_limit: 3, status: "active" }));
  }, []);

  const handleUpgrade = async (plan: "basic" | "pro") => {
    if (!user?.primaryEmailAddress?.emailAddress) return;

    setLoading(plan);
    try {
      const { authorization_url } = await initializePayment(
        plan,
        user.primaryEmailAddress.emailAddress
      );
      // Redirect to Paystack checkout
      window.location.href = authorization_url;
    } catch (err) {
      console.error("Payment initialization failed:", err);
      toast("Payment failed to initialize. Please try again.", "error");
      setLoading(null);
    }
  };

  const currentTier = subscription?.tier || "free";

  return (
    <div className="min-h-screen bg-cream">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-[rgba(217,185,130,0.25)] bg-paper/92 backdrop-blur-xl">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => router.push("/profile")}
            className="text-ink-m hover:text-ink transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-ink">Subscription</span>
        </div>
      </nav>

      <main className="max-w-lg mx-auto px-4 py-6 pb-24">
        {/* Loading skeleton */}
        {!subscription && (
          <div className="animate-pulse space-y-4">
            <div className="bg-paper border border-[rgba(217,185,130,0.25)] rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-cream-d" />
                <div className="space-y-2">
                  <div className="h-4 w-24 bg-cream-d rounded" />
                  <div className="h-3 w-16 bg-cream-d/60 rounded" />
                </div>
              </div>
              <div className="h-3 w-48 bg-cream-d/40 rounded mt-3" />
            </div>
            <div className="h-4 w-32 bg-cream-d/40 rounded" />
            <div className="bg-paper border border-[rgba(217,185,130,0.25)] rounded-2xl p-5 h-48" />
          </div>
        )}

        {/* Current Plan Banner */}
        {subscription && (<>
        <div className="bg-paper border border-[rgba(217,185,130,0.25)] rounded-2xl p-5 mb-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-accent-l/8 flex items-center justify-center">
              {currentTier === "free" ? (
                <Sparkles className="w-5 h-5 text-accent" />
              ) : currentTier === "basic" ? (
                <Zap className="w-5 h-5 text-amber-500" />
              ) : (
                <Crown className="w-5 h-5 text-amber-600" />
              )}
            </div>
            <div>
              <p
                className="text-base font-bold text-ink"
                style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}
              >
                {currentTier === "free" ? "Free Plan" : `${currentTier.charAt(0).toUpperCase() + currentTier.slice(1)} Plan`}
              </p>
              <p className="text-[11px] text-ink-f">Your current plan</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-4 text-[12px] text-ink-m">
            <span>{subscription?.lectures_limit ?? 3} lectures {currentTier === "free" ? "total" : "per month"}</span>
            <span className="text-muted-bg">·</span>
            <span>{currentTier === "free" ? "No PDF export" : "PDF export"}</span>
            <span className="text-muted-bg">·</span>
            <span>{currentTier === "free" ? "No storage" : "Notes saved"}</span>
          </div>
        </div>

        {currentTier !== "pro" && (
          <>
            {/* Upgrade heading */}
            <p className="text-[10px] font-bold text-ink-m uppercase tracking-widest mb-3">
              Upgrade your plan
            </p>

            {/* Basic Plan */}
            {currentTier === "free" && (
              <div className="bg-ink rounded-2xl p-5 mb-3 relative">
                <div className="absolute -top-2 right-4 bg-accent text-white text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Popular
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <p
                      className="text-sm font-bold text-white"
                      style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}
                    >
                      Basic
                    </p>
                    <p className="text-[10px] text-white/40">For regular use</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p
                      className="text-xl font-bold text-white"
                      style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}
                    >
                      &#8358;3,500
                    </p>
                    <p className="text-[10px] text-white/40">/month · ~$2.33</p>
                  </div>
                </div>
                <ul className="space-y-1.5 mb-4">
                  {[
                    "8 lectures per month",
                    "Full AI-generated notes",
                    "Learn Mode & Explain This",
                    "PDF export",
                    "Notes saved for 6 months",
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-[12px] text-white/70">
                      <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleUpgrade("basic")}
                  disabled={loading !== null}
                  className="w-full py-2.5 bg-white text-ink rounded-lg text-sm font-semibold hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading === "basic" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Redirecting to payment...
                    </>
                  ) : (
                    "Upgrade to Basic"
                  )}
                </button>
              </div>
            )}

            {/* Pro Plan */}
            <div className="bg-paper border border-[rgba(217,185,130,0.25)] rounded-2xl p-5 mb-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/8 flex items-center justify-center">
                  <Crown className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p
                    className="text-sm font-bold text-ink"
                    style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}
                  >
                    Pro
                  </p>
                  <p className="text-[10px] text-ink-f">For serious students</p>
                </div>
                <div className="ml-auto text-right">
                  <p
                    className="text-xl font-bold text-ink"
                    style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}
                  >
                    &#8358;8,500
                  </p>
                  <p className="text-[10px] text-ink-f">/month · ~$5.67</p>
                </div>
              </div>
              <ul className="space-y-1.5 mb-4">
                {[
                  "20 lectures per month",
                  "Everything in Basic",
                  "Solve Mode (ask questions)",
                  "Notes saved permanently",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-[12px] text-ink-m">
                    <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleUpgrade("pro")}
                disabled={loading !== null}
                className="w-full py-2.5 border border-[rgba(217,185,130,0.35)] text-ink rounded-lg text-sm font-medium hover:bg-cream transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading === "pro" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Redirecting to payment...
                  </>
                ) : (
                  "Upgrade to Pro"
                )}
              </button>
            </div>
          </>
        )}

        {/* Group Plan */}
        <div className="bg-paper border border-[rgba(217,185,130,0.25)] rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent-l/8 flex items-center justify-center">
              <User className="w-4 h-4 text-accent" />
            </div>
            <div className="flex-1">
              <p
                className="text-sm font-bold text-ink"
                style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}
              >
                Group Plan
              </p>
              <p className="text-[11px] text-ink-m">
                ₦15,000/mo for 5 students. Perfect for study groups.
              </p>
            </div>
          </div>
          <button
            onClick={() => window.open("mailto:support@lectly.app?subject=Group%20Plan%20Inquiry", "_blank")}
            className="w-full mt-3 py-2.5 border border-[rgba(217,185,130,0.35)] text-ink rounded-lg text-sm font-medium hover:bg-cream transition-colors"
          >
            Contact Us
          </button>
        </div>

        <p className="text-[11px] text-ink-f text-center px-4">
          Payments are processed securely via Paystack. Cancel anytime — no questions asked.
        </p>
        </>)}
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
          <Link href="/upload" className="flex flex-col items-center gap-0.5 text-ink-m hover:text-ink">
            <Upload className="w-5 h-5" />
            <span className="text-[10px] font-medium">Upload</span>
          </Link>
          <Link href="/profile" className="flex flex-col items-center gap-0.5 text-accent">
            <User className="w-5 h-5" />
            <span className="text-[10px] font-medium">You</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
