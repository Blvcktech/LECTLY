"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ArrowRight,
  Upload,
  FileText,
  GraduationCap,
  Sparkles,
  Download,
  ChevronDown,
  Check,
  Menu,
  X,
  Mic,
} from "lucide-react";

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F4EE] text-[#1a1815]">
      {/* ─── Navigation ─── */}
      <nav className="fixed top-0 w-full z-50 bg-[#FDFCF9]/92 backdrop-blur-xl border-b border-[rgba(217,185,130,0.25)]">
        <div className="max-w-[1100px] mx-auto px-5 sm:px-8">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#0F3D43] flex items-center justify-center shadow-sm shadow-[#0F3D43]/15">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <span
                className="text-[17px] font-bold text-[#1a1815] tracking-tight"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                Lectly
              </span>
            </div>

            <div className="hidden md:flex items-center gap-7">
              <a href="#how-it-works" className="text-[13px] text-[#8a7f6f] hover:text-[#1a1815] transition-colors">
                How It Works
              </a>
              <a href="#features" className="text-[13px] text-[#8a7f6f] hover:text-[#1a1815] transition-colors">
                Features
              </a>
              <a href="#pricing" className="text-[13px] text-[#8a7f6f] hover:text-[#1a1815] transition-colors">
                Pricing
              </a>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <Link
                href="/sign-in"
                className="text-[13px] text-[#8a7f6f] hover:text-[#1a1815] transition-colors px-3 py-1.5"
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="text-[13px] bg-[#1a1815] hover:bg-[#2a2520] text-white px-5 py-[7px] rounded-lg font-medium transition-colors"
              >
                Get Started
              </Link>
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-[#8a7f6f] hover:text-[#1a1815] p-1"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {mobileMenuOpen && (
            <div className="md:hidden pb-4 border-t border-[rgba(217,185,130,0.2)] pt-3 space-y-2">
              <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="block text-sm text-[#8a7f6f] py-1.5">
                How It Works
              </a>
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block text-sm text-[#8a7f6f] py-1.5">
                Features
              </a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block text-sm text-[#8a7f6f] py-1.5">
                Pricing
              </a>
              <div className="flex items-center gap-3 pt-2">
                <Link href="/sign-in" className="text-sm text-[#8a7f6f]">Sign In</Link>
                <Link href="/sign-up" className="text-sm bg-[#1a1815] text-white px-4 py-2 rounded-lg font-medium">
                  Get Started
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* ─── Hero — Split Layout ─── */}
      <section className="pt-24 sm:pt-28 pb-14 sm:pb-20 px-5 sm:px-8">
        <div className="max-w-[1100px] mx-auto flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
          {/* Left — Copy */}
          <div className="flex-1 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-[#1a5c65]/8 text-[#0a2e33] text-[11px] font-semibold px-3 py-1.5 rounded-full mb-5 tracking-wide uppercase">
              <Sparkles className="w-3 h-3" />
              Built for Nigerian students
            </div>
            <h1
              className="text-[32px] sm:text-[42px] lg:text-[50px] font-extrabold text-[#1a1815] leading-[1.08] tracking-tight mb-4"
              style={{ fontFamily: "'Georgia', serif" }}
            >
              Your lectures deserve
              <br className="hidden sm:block" />
              {" "}better than a
              <br className="hidden sm:block" />
              {" "}voice memo
            </h1>
            <p className="text-[15px] sm:text-base text-[#8a7f6f] leading-relaxed max-w-[480px] mx-auto lg:mx-0 mb-7">
              Upload your lecture recordings. Get structured notes with key points and definitions.
              Then learn it back with an AI tutor — section by section, at your level.
            </p>
            <div className="flex flex-col sm:flex-row items-center lg:items-start gap-3">
              <Link
                href="/sign-up"
                className="flex items-center gap-2 bg-[#1a1815] hover:bg-[#2a2520] text-white px-6 py-3 rounded-lg text-sm font-semibold transition-colors shadow-sm"
              >
                Upload Your First Lecture
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#how-it-works"
                className="text-sm text-[#8a7f6f] hover:text-[#1a1815] transition-colors py-3 flex items-center gap-1"
              >
                See how it works <ChevronDown className="w-3.5 h-3.5" />
              </a>
            </div>
            <p className="text-[11px] text-[#b5ad9e] mt-4">
              3 free lectures. No credit card required.
            </p>
          </div>

          {/* Right — Product Preview Card */}
          <div className="flex-shrink-0 w-full max-w-[420px] lg:w-[420px]">
            <div className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.3)] rounded-2xl p-5 shadow-lg shadow-[rgba(217,185,130,0.1)]">
              {/* Mock header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-[#1a5c65]/10 flex items-center justify-center">
                    <FileText className="w-3 h-3 text-[#0F3D43]" />
                  </div>
                  <span className="text-xs font-semibold text-[#1a1815]" style={{ fontFamily: "'Georgia', serif" }}>
                    Units and Measurements in Physics
                  </span>
                </div>
                <span className="text-[9px] text-emerald-600 bg-emerald-500/8 px-1.5 py-0.5 rounded font-medium">
                  85% mastery
                </span>
              </div>

              {/* Mock section */}
              <div className="bg-[#F7F4EE] rounded-xl p-3.5 mb-3">
                <h4
                  className="text-[11px] font-semibold text-[#1a1815] mb-1.5"
                  style={{ fontFamily: "'Georgia', serif" }}
                >
                  Fundamental Quantities and Units
                </h4>
                <p className="text-[10px] text-[#8a7f6f] leading-relaxed mb-2.5">
                  Physical quantities that cannot be derived from other quantities. These form the basis of all measurements in physics...
                </p>
                {/* Key point */}
                <div className="flex items-start gap-2 bg-[#1a5c65]/[0.05] border-l-2 border-[#0F3D43] rounded-r px-2.5 py-2 mb-2">
                  <div>
                    <span className="text-[9px] font-semibold text-[#0F3D43] block">Key Point</span>
                    <span className="text-[10px] text-[#4a4540]">
                      There are 7 SI base units: metre, kilogram, second, ampere, kelvin, mole, candela
                    </span>
                  </div>
                </div>
                {/* Definition */}
                <div className="bg-emerald-500/[0.05] border-l-2 border-emerald-500 rounded-r px-2.5 py-2">
                  <span className="text-[9px] font-semibold text-emerald-600 block">Definition: Derived Unit</span>
                  <span className="text-[10px] text-[#4a4540]">
                    A unit expressed as a combination of base units (e.g., m/s for velocity)
                  </span>
                </div>
              </div>

              {/* Mock action buttons */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-[#1a1815] text-white px-2.5 py-1 rounded-md font-medium flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> Explain This
                </span>
                <span className="text-[10px] text-[#8a7f6f] bg-[#F7F4EE] px-2.5 py-1 rounded-md font-medium flex items-center gap-1 border border-[rgba(217,185,130,0.2)]">
                  <GraduationCap className="w-2.5 h-2.5" /> Learn Mode
                </span>
                <span className="text-[10px] text-[#8a7f6f] bg-[#F7F4EE] px-2.5 py-1 rounded-md font-medium flex items-center gap-1 border border-[rgba(217,185,130,0.2)]">
                  <Download className="w-2.5 h-2.5" /> PDF
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Problem + Solution — Single flowing section ─── */}
      <section className="py-14 sm:py-16 px-5 sm:px-8 bg-[#FDFCF9]">
        <div className="max-w-[800px] mx-auto">
          <div className="flex flex-col md:flex-row gap-10 md:gap-16">
            {/* Problem — Left */}
            <div className="flex-1">
              <span className="text-[11px] font-bold text-[#b5ad9e] uppercase tracking-widest mb-3 block">
                The problem
              </span>
              <h2
                className="text-lg sm:text-xl font-bold text-[#1a1815] mb-4"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                We&apos;ve all been there
              </h2>
              <div className="space-y-3">
                <p className="text-sm text-[#8a7f6f] leading-relaxed">
                  You recorded the lecture. You never listened to it again.
                </p>
                <p className="text-sm text-[#8a7f6f] leading-relaxed">
                  You borrowed someone&apos;s notes. Half of it made no sense without context.
                </p>
                <p className="text-sm text-[#8a7f6f] leading-relaxed">
                  You crammed from a textbook that doesn&apos;t match what the professor actually said.
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="hidden md:block w-px bg-[rgba(217,185,130,0.25)]" />

            {/* Solution — Right */}
            <div className="flex-1">
              <span className="text-[11px] font-bold text-[#0F3D43] uppercase tracking-widest mb-3 block">
                The fix
              </span>
              <h2
                className="text-lg sm:text-xl font-bold text-[#1a1815] mb-4"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                Lectly turns recordings into understanding
              </h2>
              <p className="text-sm text-[#8a7f6f] leading-relaxed">
                Upload your lecture audio — even if it&apos;s noisy, long, or recorded on a phone in a crowded hall.
                Lectly cleans the audio, transcribes it, and builds structured notes with key points, definitions,
                and section breakdowns. Then Learn Mode teaches each section back to you with explanations,
                analogies, worked examples, and quiz questions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section id="how-it-works" className="py-14 sm:py-16 px-5 sm:px-8">
        <div className="max-w-[900px] mx-auto">
          <span className="text-[11px] font-bold text-[#b5ad9e] uppercase tracking-widest mb-2 block text-center">
            How it works
          </span>
          <h2
            className="text-lg sm:text-xl font-bold text-[#1a1815] text-center mb-10"
            style={{ fontFamily: "'Georgia', serif" }}
          >
            Three steps. That&apos;s it.
          </h2>

          <div className="relative">
            {/* Connecting line — desktop only */}
            <div className="hidden md:block absolute top-6 left-[16.5%] right-[16.5%] h-px bg-[rgba(217,185,130,0.3)]" />

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  num: "01",
                  icon: Upload,
                  title: "Upload",
                  desc: "Drop your audio file. MP3, M4A, WAV — up to 500MB. Background noise is cleaned automatically.",
                },
                {
                  num: "02",
                  icon: FileText,
                  title: "Get Notes",
                  desc: "Your lecture is transcribed and organized into sections with key points, definitions, and summaries.",
                },
                {
                  num: "03",
                  icon: GraduationCap,
                  title: "Learn",
                  desc: "Pick any section. Get it explained at your level with analogies, solved examples, and quiz questions.",
                },
              ].map((item) => (
                <div key={item.num} className="text-center relative">
                  <div className="w-12 h-12 rounded-full bg-[#FDFCF9] border border-[rgba(217,185,130,0.3)] flex items-center justify-center mx-auto mb-4 relative z-10 shadow-sm">
                    <item.icon className="w-5 h-5 text-[#1a1815]" />
                  </div>
                  <span className="text-[10px] font-bold text-[#0F3D43] tracking-widest block mb-1">
                    STEP {item.num}
                  </span>
                  <h3
                    className="text-sm font-semibold text-[#1a1815] mb-1.5"
                    style={{ fontFamily: "'Georgia', serif" }}
                  >
                    {item.title}
                  </h3>
                  <p className="text-[13px] text-[#8a7f6f] leading-relaxed max-w-[260px] mx-auto">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features — Alternating Layout ─── */}
      <section id="features" className="py-14 sm:py-16 px-5 sm:px-8 bg-[#FDFCF9]">
        <div className="max-w-[900px] mx-auto">
          <span className="text-[11px] font-bold text-[#b5ad9e] uppercase tracking-widest mb-2 block text-center">
            Features
          </span>
          <h2
            className="text-lg sm:text-xl font-bold text-[#1a1815] text-center mb-12"
            style={{ fontFamily: "'Georgia', serif" }}
          >
            What you get
          </h2>

          {/* Feature Row 1 — Text left, Visual right */}
          <div className="flex flex-col md:flex-row items-start gap-8 mb-12">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-[#1a5c65]/8 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-[#0F3D43]" />
                </div>
                <h3
                  className="text-[15px] font-semibold text-[#1a1815]"
                  style={{ fontFamily: "'Georgia', serif" }}
                >
                  Smart Notes
                </h3>
              </div>
              <p className="text-sm text-[#8a7f6f] leading-relaxed mb-5">
                Not a raw transcript dump. Lectly breaks your lecture into logical sections,
                pulls out key points, and tags definitions — so you get notes that actually
                make sense when you read them back.
              </p>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-amber-500/8 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                </div>
                <h3
                  className="text-[15px] font-semibold text-[#1a1815]"
                  style={{ fontFamily: "'Georgia', serif" }}
                >
                  Explain This
                </h3>
              </div>
              <p className="text-sm text-[#8a7f6f] leading-relaxed">
                Highlight any section. Get it explained in simpler terms with an analogy
                that clicks. Choose beginner, intermediate, or advanced depth.
              </p>
            </div>

            {/* Visual — Mock notes card */}
            <div className="flex-shrink-0 w-full md:w-[340px] bg-[#F7F4EE] border border-[rgba(217,185,130,0.25)] rounded-2xl p-4">
              <div className="space-y-2.5">
                <div className="bg-[#1a5c65]/[0.05] border-l-2 border-[#0F3D43] rounded-r px-3 py-2">
                  <span className="text-[9px] font-semibold text-[#0F3D43] block mb-0.5">Key Point</span>
                  <span className="text-[11px] text-[#4a4540]">
                    Newton&apos;s Second Law: F = ma. Force equals mass times acceleration.
                  </span>
                </div>
                <div className="bg-emerald-500/[0.05] border-l-2 border-emerald-500 rounded-r px-3 py-2">
                  <span className="text-[9px] font-semibold text-emerald-600 block mb-0.5">Definition: Inertia</span>
                  <span className="text-[11px] text-[#4a4540]">
                    The tendency of an object to resist changes in its state of motion.
                  </span>
                </div>
                <div className="bg-amber-500/[0.05] border-l-2 border-amber-500 rounded-r px-3 py-2">
                  <span className="text-[9px] font-semibold text-amber-600 block mb-0.5">Key Point</span>
                  <span className="text-[11px] text-[#4a4540]">
                    Weight is a force (measured in Newtons), mass is a property (measured in kg).
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Feature Row 2 — Visual left, Text right */}
          <div className="flex flex-col-reverse md:flex-row items-start gap-8">
            {/* Visual — Mock quiz card */}
            <div className="flex-shrink-0 w-full md:w-[340px] bg-[#F7F4EE] border border-[rgba(217,185,130,0.25)] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <GraduationCap className="w-4 h-4 text-[#0F3D43]" />
                <span
                  className="text-[11px] font-semibold text-[#1a1815]"
                  style={{ fontFamily: "'Georgia', serif" }}
                >
                  Learn Mode — Quiz
                </span>
              </div>
              <p className="text-[11px] text-[#4a4540] mb-3">
                What happens to acceleration if you double the force but keep mass constant?
              </p>
              <div className="space-y-1.5">
                {["It halves", "It doubles", "It stays the same", "It quadruples"].map((opt, i) => (
                  <div
                    key={opt}
                    className={`text-[11px] px-3 py-2 rounded-lg border ${
                      i === 1
                        ? "border-emerald-500/40 bg-emerald-500/[0.06] text-emerald-700"
                        : "border-[rgba(217,185,130,0.2)] text-[#8a7f6f]"
                    }`}
                  >
                    {i === 1 && <Check className="w-3 h-3 inline mr-1.5 text-emerald-500" />}
                    {opt}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-[#b5ad9e] mt-2.5">
                F = ma → If F doubles and m stays constant, a must double.
              </p>
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/8 flex items-center justify-center">
                  <GraduationCap className="w-4 h-4 text-emerald-600" />
                </div>
                <h3
                  className="text-[15px] font-semibold text-[#1a1815]"
                  style={{ fontFamily: "'Georgia', serif" }}
                >
                  Learn Mode
                </h3>
              </div>
              <p className="text-sm text-[#8a7f6f] leading-relaxed mb-5">
                A full lesson built from your lecture content. Worked examples with
                step-by-step solutions. Quiz questions to test yourself. Resources
                and analogies to make concepts stick.
              </p>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-[#1a5c65]/8 flex items-center justify-center">
                  <Download className="w-4 h-4 text-[#0F3D43]" />
                </div>
                <h3
                  className="text-[15px] font-semibold text-[#1a1815]"
                  style={{ fontFamily: "'Georgia', serif" }}
                >
                  Download & Share
                </h3>
              </div>
              <p className="text-sm text-[#8a7f6f] leading-relaxed">
                Export your notes as a clean PDF. Share with classmates via WhatsApp
                or link. They upload, they learn — everyone benefits.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Built for Nigerian Students ─── */}
      <section className="py-12 sm:py-14 px-5 sm:px-8">
        <div className="max-w-[700px] mx-auto flex flex-col md:flex-row items-start gap-6">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/8 flex items-center justify-center">
              <Mic className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <div>
            <h2
              className="text-base sm:text-lg font-bold text-[#1a1815] mb-2"
              style={{ fontFamily: "'Georgia', serif" }}
            >
              Built for Nigerian students
            </h2>
            <p className="text-sm text-[#8a7f6f] leading-relaxed">
              Lectly is designed for how students actually learn in Nigerian universities — where
              lecture halls are crowded, audio is messy, and textbooks don&apos;t always match what the
              professor teaches. We handle the noise, the accents, and the chaos. You focus on understanding.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section id="pricing" className="py-14 sm:py-16 px-5 sm:px-8 bg-[#FDFCF9]">
        <div className="max-w-[900px] mx-auto">
          <span className="text-[11px] font-bold text-[#b5ad9e] uppercase tracking-widest mb-2 block text-center">
            Pricing
          </span>
          <h2
            className="text-lg sm:text-xl font-bold text-[#1a1815] text-center mb-2"
            style={{ fontFamily: "'Georgia', serif" }}
          >
            Simple pricing for students
          </h2>
          <p className="text-[13px] text-[#8a7f6f] text-center mb-10">
            Start free. Upgrade when you need more.
          </p>

          <div className="grid sm:grid-cols-3 gap-4">
            {/* Free Trial */}
            <div className="rounded-2xl border border-[rgba(217,185,130,0.25)] bg-[#F7F4EE] p-5">
              <h3
                className="text-sm font-semibold text-[#1a1815] mb-0.5"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                Free Trial
              </h3>
              <p className="text-[11px] text-[#b5ad9e] mb-3">Try Lectly out</p>
              <div
                className="text-2xl font-bold text-[#1a1815] mb-4"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                &#8358;0
              </div>
              <ul className="space-y-2 text-[13px] text-[#8a7f6f] mb-5">
                {[
                  "3 lecture uploads (one-time)",
                  "Full AI-generated notes",
                  "Learn Mode access",
                  "Explain This (unlimited)",
                  "No PDF export",
                  "No permanent storage",
                ].map((f, i) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check
                      className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                        i >= 4 ? "text-[#d4cec3]" : "text-emerald-500"
                      }`}
                    />
                    <span className={i >= 4 ? "text-[#b5ad9e]" : ""}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/sign-up"
                className="block text-center py-2.5 rounded-lg border border-[rgba(217,185,130,0.35)] text-[#1a1815] hover:bg-[#F7F4EE] transition-colors text-[13px] font-medium"
              >
                Start Free
              </Link>
            </div>

            {/* Basic — Featured */}
            <div className="rounded-2xl border-2 border-[#1a1815] bg-[#1a1815] p-5 relative text-white">
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#0F3D43] text-white text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Popular
              </div>
              <h3
                className="text-sm font-semibold text-white mb-0.5"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                Basic
              </h3>
              <p className="text-[11px] text-white/50 mb-3">For regular use</p>
              <div
                className="text-2xl font-bold text-white mb-1"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                &#8358;3,500<span className="text-xs font-normal text-white/40">/mo</span>
              </div>
              <p className="text-[10px] text-white/40 mb-4">~$2.33/month</p>
              <ul className="space-y-2 text-[13px] text-white/70 mb-5">
                {[
                  "8 lectures per month",
                  "Full AI-generated notes",
                  "Learn Mode & Explain This",
                  "PDF export",
                  "WhatsApp sharing",
                  "Notes saved for 6 months",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/sign-up"
                className="block text-center py-2.5 rounded-lg bg-white text-[#1a1815] hover:bg-white/90 transition-colors text-[13px] font-semibold"
              >
                Get Basic
              </Link>
            </div>

            {/* Pro */}
            <div className="rounded-2xl border border-[rgba(217,185,130,0.25)] bg-[#F7F4EE] p-5">
              <h3
                className="text-sm font-semibold text-[#1a1815] mb-0.5"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                Pro
              </h3>
              <p className="text-[11px] text-[#b5ad9e] mb-3">For serious students</p>
              <div
                className="text-2xl font-bold text-[#1a1815] mb-1"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                &#8358;8,500<span className="text-xs font-normal text-[#b5ad9e]">/mo</span>
              </div>
              <p className="text-[10px] text-[#b5ad9e] mb-4">~$5.67/month</p>
              <ul className="space-y-2 text-[13px] text-[#8a7f6f] mb-5">
                {[
                  "20 lectures per month",
                  "Everything in Basic",
                  "No watermark on shares",
                  "Priority processing (2x faster)",
                  "Share with up to 3 students",
                  "Notes saved permanently",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/sign-up"
                className="block text-center py-2.5 rounded-lg border border-[rgba(217,185,130,0.35)] text-[#1a1815] hover:bg-[#F7F4EE] transition-colors text-[13px] font-medium"
              >
                Get Pro
              </Link>
            </div>
          </div>

          {/* Group/Campus note */}
          <p className="text-center text-[11px] text-[#b5ad9e] mt-6">
            Need group or campus-wide access?{" "}
            <a href="#" className="text-[#0F3D43] hover:underline">
              Contact us
            </a>
            {" "}for Group (₦15,000/mo for 5 students) and Campus plans.
          </p>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="py-14 sm:py-16 px-5 sm:px-8">
        <div className="max-w-[500px] mx-auto text-center">
          <h2
            className="text-lg sm:text-xl font-bold text-[#1a1815] mb-3"
            style={{ fontFamily: "'Georgia', serif" }}
          >
            Stop letting good lectures go to waste
          </h2>
          <p className="text-sm text-[#8a7f6f] mb-6">
            Upload your first lecture and see the difference in five minutes.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 bg-[#1a1815] hover:bg-[#2a2520] text-white px-6 py-3 rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            Get Started — It&apos;s Free
            <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-[11px] text-[#b5ad9e] mt-3">
            No account required. No credit card.
          </p>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-[rgba(217,185,130,0.25)] py-6 px-5 sm:px-8 bg-[#FDFCF9]">
        <div className="max-w-[900px] mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-[#0F3D43] flex items-center justify-center">
              <BookOpen className="w-2.5 h-2.5 text-white" />
            </div>
            <span
              className="text-[13px] font-semibold text-[#1a1815]"
              style={{ fontFamily: "'Georgia', serif" }}
            >
              Lectly
            </span>
          </div>
          <p className="text-[11px] text-[#b5ad9e]">
            &copy; {new Date().getFullYear()} Lectly. Built for students, by students.
          </p>
          <div className="flex gap-5 text-[11px] text-[#8a7f6f]">
            <a href="/privacy" className="hover:text-[#1a1815] transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-[#1a1815] transition-colors">Terms</a>
            <a href="mailto:lectlyapp@gmail.com" className="hover:text-[#1a1815] transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
