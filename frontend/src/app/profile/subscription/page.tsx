"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
} from "lucide-react";

export default function SubscriptionPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#F7F4EE]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-[rgba(217,185,130,0.25)] bg-[#FDFCF9]/92 backdrop-blur-xl">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => router.push("/profile")}
            className="text-[#8a7f6f] hover:text-[#1a1815] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-[#1a1815]">Subscription</span>
        </div>
      </nav>

      <main className="max-w-lg mx-auto px-4 py-6 pb-24">
        {/* Current Plan Banner */}
        <div className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-2xl p-5 mb-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#1a5c65]/8 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#0F3D43]" />
            </div>
            <div>
              <p
                className="text-base font-bold text-[#1a1815]"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                Free Plan
              </p>
              <p className="text-[11px] text-[#b5ad9e]">Your current plan</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-4 text-[12px] text-[#8a7f6f]">
            <span>3 lectures total</span>
            <span className="text-[#d4cec3]">·</span>
            <span>No PDF export</span>
            <span className="text-[#d4cec3]">·</span>
            <span>No storage</span>
          </div>
        </div>

        {/* Upgrade heading */}
        <p className="text-[10px] font-bold text-[#8a7f6f] uppercase tracking-widest mb-3">
          Upgrade your plan
        </p>

        {/* Basic Plan */}
        <div className="bg-[#1a1815] rounded-2xl p-5 mb-3 relative">
          <div className="absolute -top-2 right-4 bg-[#0F3D43] text-white text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            Popular
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p
                className="text-sm font-bold text-white"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                Basic
              </p>
              <p className="text-[10px] text-white/40">For regular use</p>
            </div>
            <div className="ml-auto text-right">
              <p
                className="text-xl font-bold text-white"
                style={{ fontFamily: "'Georgia', serif" }}
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
              "WhatsApp sharing",
              "Notes saved for 6 months",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2 text-[12px] text-white/70">
                <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <button className="w-full py-2.5 bg-white text-[#1a1815] rounded-lg text-sm font-semibold hover:bg-white/90 transition-colors">
            Upgrade to Basic
          </button>
        </div>

        {/* Pro Plan */}
        <div className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-2xl p-5 mb-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/8 flex items-center justify-center">
              <Crown className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p
                className="text-sm font-bold text-[#1a1815]"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                Pro
              </p>
              <p className="text-[10px] text-[#b5ad9e]">For serious students</p>
            </div>
            <div className="ml-auto text-right">
              <p
                className="text-xl font-bold text-[#1a1815]"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                &#8358;8,500
              </p>
              <p className="text-[10px] text-[#b5ad9e]">/month · ~$5.67</p>
            </div>
          </div>
          <ul className="space-y-1.5 mb-4">
            {[
              "20 lectures per month",
              "Everything in Basic",
              "No watermark on shares",
              "Priority processing (2x faster)",
              "Share with up to 3 students",
              "Notes saved permanently",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2 text-[12px] text-[#8a7f6f]">
                <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <button className="w-full py-2.5 border border-[rgba(217,185,130,0.35)] text-[#1a1815] rounded-lg text-sm font-medium hover:bg-[#F7F4EE] transition-colors">
            Upgrade to Pro
          </button>
        </div>

        {/* Group Plan */}
        <div className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#1a5c65]/8 flex items-center justify-center">
              <User className="w-4 h-4 text-[#0F3D43]" />
            </div>
            <div className="flex-1">
              <p
                className="text-sm font-bold text-[#1a1815]"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                Group Plan
              </p>
              <p className="text-[11px] text-[#8a7f6f]">
                ₦15,000/mo for 5 students. Perfect for study groups.
              </p>
            </div>
          </div>
          <button className="w-full mt-3 py-2.5 border border-[rgba(217,185,130,0.35)] text-[#1a1815] rounded-lg text-sm font-medium hover:bg-[#F7F4EE] transition-colors">
            Contact Us
          </button>
        </div>

        <p className="text-[11px] text-[#b5ad9e] text-center px-4">
          Payments are processed securely. Cancel anytime — no questions asked.
        </p>
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
          <Link href="/upload" className="flex flex-col items-center gap-0.5 text-[#8a7f6f] hover:text-[#1a1815]">
            <Upload className="w-5 h-5" />
            <span className="text-[10px] font-medium">Upload</span>
          </Link>
          <Link href="/profile" className="flex flex-col items-center gap-0.5 text-[#0F3D43]">
            <User className="w-5 h-5" />
            <span className="text-[10px] font-medium">You</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
