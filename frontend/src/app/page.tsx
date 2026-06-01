import Link from "next/link";
import {
  ArrowRight,
  Upload,
  FileText,
  GraduationCap,
  Sparkles,
  Download,
  ChevronDown,
  Check,
  Mic,
} from "lucide-react";
import StratumLogo from "@/components/StratumLogo";
import { MobileMenu } from "@/components/MobileMenu";
import type { Metadata } from "next";

// ── SEO Metadata ──
export const metadata: Metadata = {
  title: "Lectly — Your AI Lecture Companion | Smart Notes & Learn Mode",
  description:
    "Upload lecture recordings. Get structured notes with key points and definitions. Then learn it back with an AI tutor — section by section, at your level. Built for Nigerian students.",
  keywords: [
    "lecture notes",
    "AI tutor",
    "student",
    "study",
    "transcription",
    "learn mode",
    "university",
    "Nigeria",
    "lecture recording",
    "smart notes",
    "AI study tool",
  ],
  openGraph: {
    title: "Lectly — Your AI Lecture Companion",
    description:
      "Upload messy lecture recordings. Get clean notes. Learn with an AI tutor that teaches it back to you.",
    url: "https://lectly.vercel.app",
    siteName: "Lectly",
    type: "website",
    locale: "en_NG",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Lectly — AI-powered lecture notes, Learn Mode, and AI Tutor",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lectly — Your AI Lecture Companion",
    description:
      "Upload messy lecture recordings. Get clean notes. Learn with an AI tutor that teaches it back to you.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: "https://lectly.vercel.app",
  },
};

// ── JSON-LD Structured Data ──
function JsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Lectly",
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    url: "https://lectly.vercel.app",
    description:
      "AI-powered lecture companion that transforms audio recordings into structured study materials with notes, Learn Mode, and an AI tutor.",
    offers: [
      {
        "@type": "Offer",
        price: "0",
        priceCurrency: "NGN",
        name: "Free Trial",
        description: "3 free lecture uploads",
      },
      {
        "@type": "Offer",
        price: "3500",
        priceCurrency: "NGN",
        name: "Basic",
        description: "8 lectures per month with PDF export",
      },
      {
        "@type": "Offer",
        price: "8500",
        priceCurrency: "NGN",
        name: "Pro",
        description: "20 lectures per month with priority processing",
      },
    ],
    aggregateRating: undefined,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

// ── Page (Server Component — no "use client") ──
export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-cream text-ink">
      <JsonLd />

      {/* ─── Navigation ─── */}
      <nav className="fixed top-0 w-full z-50 bg-paper/92 backdrop-blur-xl border-b border-[rgba(217,185,130,0.25)]">
        <div className="max-w-[1100px] mx-auto px-5 sm:px-8">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center gap-2.5">
              <StratumLogo size={32} />
              <span
                className="text-[17px] font-bold text-ink tracking-tight"
                style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}
              >
                Lectly
              </span>
            </div>

            <div className="hidden md:flex items-center gap-7">
              <a href="#how-it-works" className="text-[13px] text-ink-m hover:text-ink transition-colors">
                How It Works
              </a>
              <a href="#features" className="text-[13px] text-ink-m hover:text-ink transition-colors">
                Features
              </a>
              <a href="#pricing" className="text-[13px] text-ink-m hover:text-ink transition-colors">
                Pricing
              </a>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <Link
                href="/sign-in"
                className="text-[13px] text-ink-m hover:text-ink transition-colors px-3 py-1.5"
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="text-[13px] bg-ink hover:bg-ink-h text-white px-5 py-[7px] rounded-lg font-medium transition-colors"
              >
                Get Started
              </Link>
            </div>

            <MobileMenu />
          </div>
        </div>
      </nav>

      {/* ─── Hero — Split Layout ─── */}
      <section className="pt-24 sm:pt-28 pb-14 sm:pb-20 px-5 sm:px-8">
        <div className="max-w-[1100px] mx-auto flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
          {/* Left — Copy */}
          <div className="flex-1 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-accent-l/8 text-accent-d text-[11px] font-semibold px-3 py-1.5 rounded-full mb-5 tracking-wide uppercase">
              <Sparkles className="w-3 h-3" />
              Built for Nigerian students
            </div>
            <h1
              className="text-[32px] sm:text-[42px] lg:text-[50px] font-extrabold text-ink leading-[1.08] tracking-tight mb-4"
              style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}
            >
              Your lectures deserve
              <br className="hidden sm:block" />
              {" "}better than a
              <br className="hidden sm:block" />
              {" "}voice memo
            </h1>
            <p className="text-[15px] sm:text-base text-ink-m leading-relaxed max-w-[480px] mx-auto lg:mx-0 mb-7">
              Upload your lecture recordings. Get structured notes with key points and definitions.
              Then learn it back with an AI tutor — section by section, at your level.
            </p>
            <div className="flex flex-col sm:flex-row items-center lg:items-start gap-3">
              <Link
                href="/sign-up"
                className="flex items-center gap-2 bg-ink hover:bg-ink-h text-white px-6 py-3 rounded-lg text-sm font-semibold transition-colors shadow-sm"
              >
                Upload Your First Lecture
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#how-it-works"
                className="text-sm text-ink-m hover:text-ink transition-colors py-3 flex items-center gap-1"
              >
                See how it works <ChevronDown className="w-3.5 h-3.5" />
              </a>
            </div>
            <p className="text-[11px] text-ink-f mt-4">
              3 free lectures. No credit card required.
            </p>
          </div>

          {/* Right — Product Preview Card */}
          <div className="flex-shrink-0 w-full max-w-[420px] lg:w-[420px]">
            <div className="bg-paper border border-[rgba(217,185,130,0.3)] rounded-2xl p-5 shadow-lg shadow-[rgba(217,185,130,0.1)]">
              {/* Mock header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-accent-l/10 flex items-center justify-center">
                    <FileText className="w-3 h-3 text-accent" />
                  </div>
                  <span className="text-xs font-semibold text-ink" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                    Units and Measurements in Physics
                  </span>
                </div>
                <span className="text-[9px] text-emerald-600 bg-emerald-500/8 px-1.5 py-0.5 rounded font-medium">
                  85% mastery
                </span>
              </div>

              {/* Mock section */}
              <div className="bg-cream rounded-xl p-3.5 mb-3">
                <h4
                  className="text-[11px] font-semibold text-ink mb-1.5"
                  style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}
                >
                  Fundamental Quantities and Units
                </h4>
                <p className="text-[10px] text-ink-m leading-relaxed mb-2.5">
                  Physical quantities that cannot be derived from other quantities. These form the basis of all measurements in physics...
                </p>
                <div className="flex items-start gap-2 bg-accent-l/[0.05] border-l-2 border-accent rounded-r px-2.5 py-2 mb-2">
                  <div>
                    <span className="text-[9px] font-semibold text-accent block">Key Point</span>
                    <span className="text-[10px] text-sub">
                      There are 7 SI base units: metre, kilogram, second, ampere, kelvin, mole, candela
                    </span>
                  </div>
                </div>
                <div className="bg-emerald-500/[0.05] border-l-2 border-emerald-500 rounded-r px-2.5 py-2">
                  <span className="text-[9px] font-semibold text-emerald-600 block">Definition: Derived Unit</span>
                  <span className="text-[10px] text-sub">
                    A unit expressed as a combination of base units (e.g., m/s for velocity)
                  </span>
                </div>
              </div>

              {/* Mock action buttons */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-ink text-white px-2.5 py-1 rounded-md font-medium flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> Explain This
                </span>
                <span className="text-[10px] text-ink-m bg-cream px-2.5 py-1 rounded-md font-medium flex items-center gap-1 border border-[rgba(217,185,130,0.2)]">
                  <GraduationCap className="w-2.5 h-2.5" /> Learn Mode
                </span>
                <span className="text-[10px] text-ink-m bg-cream px-2.5 py-1 rounded-md font-medium flex items-center gap-1 border border-[rgba(217,185,130,0.2)]">
                  <Download className="w-2.5 h-2.5" /> PDF
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Problem + Solution ─── */}
      <section className="py-14 sm:py-16 px-5 sm:px-8 bg-paper">
        <div className="max-w-[800px] mx-auto">
          <div className="flex flex-col md:flex-row gap-10 md:gap-16">
            <div className="flex-1">
              <span className="text-[11px] font-bold text-ink-f uppercase tracking-widest mb-3 block">
                The problem
              </span>
              <h2
                className="text-lg sm:text-xl font-bold text-ink mb-4"
                style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}
              >
                We&apos;ve all been there
              </h2>
              <div className="space-y-3">
                <p className="text-sm text-ink-m leading-relaxed">
                  You recorded the lecture. You never listened to it again.
                </p>
                <p className="text-sm text-ink-m leading-relaxed">
                  You borrowed someone&apos;s notes. Half of it made no sense without context.
                </p>
                <p className="text-sm text-ink-m leading-relaxed">
                  You crammed from a textbook that doesn&apos;t match what the professor actually said.
                </p>
              </div>
            </div>

            <div className="hidden md:block w-px bg-[rgba(217,185,130,0.25)]" />

            <div className="flex-1">
              <span className="text-[11px] font-bold text-accent uppercase tracking-widest mb-3 block">
                The fix
              </span>
              <h2
                className="text-lg sm:text-xl font-bold text-ink mb-4"
                style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}
              >
                Lectly turns recordings into understanding
              </h2>
              <p className="text-sm text-ink-m leading-relaxed">
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
          <span className="text-[11px] font-bold text-ink-f uppercase tracking-widest mb-2 block text-center">
            How it works
          </span>
          <h2
            className="text-lg sm:text-xl font-bold text-ink text-center mb-10"
            style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}
          >
            Three steps. That&apos;s it.
          </h2>

          <div className="relative">
            <div className="hidden md:block absolute top-6 left-[16.5%] right-[16.5%] h-px bg-[rgba(217,185,130,0.3)]" />

            <div className="grid md:grid-cols-3 gap-8">
              {[
                { num: "01", icon: Upload, title: "Upload", desc: "Drop your audio file. MP3, M4A, WAV — up to 500MB. Background noise is cleaned automatically." },
                { num: "02", icon: FileText, title: "Get Notes", desc: "Your lecture is transcribed and organized into sections with key points, definitions, and summaries." },
                { num: "03", icon: GraduationCap, title: "Learn", desc: "Pick any section. Get it explained at your level with analogies, solved examples, and quiz questions." },
              ].map((item) => (
                <div key={item.num} className="text-center relative">
                  <div className="w-12 h-12 rounded-full bg-paper border border-[rgba(217,185,130,0.3)] flex items-center justify-center mx-auto mb-4 relative z-10 shadow-sm">
                    <item.icon className="w-5 h-5 text-ink" />
                  </div>
                  <span className="text-[10px] font-bold text-accent tracking-widest block mb-1">
                    STEP {item.num}
                  </span>
                  <h3
                    className="text-sm font-semibold text-ink mb-1.5"
                    style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}
                  >
                    {item.title}
                  </h3>
                  <p className="text-[13px] text-ink-m leading-relaxed max-w-[260px] mx-auto">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="py-14 sm:py-16 px-5 sm:px-8 bg-paper">
        <div className="max-w-[900px] mx-auto">
          <span className="text-[11px] font-bold text-ink-f uppercase tracking-widest mb-2 block text-center">
            Features
          </span>
          <h2
            className="text-lg sm:text-xl font-bold text-ink text-center mb-12"
            style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}
          >
            What you get
          </h2>

          {/* Feature Row 1 */}
          <div className="flex flex-col md:flex-row items-start gap-8 mb-12">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-accent-l/8 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-accent" />
                </div>
                <h3 className="text-[15px] font-semibold text-ink" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                  Smart Notes
                </h3>
              </div>
              <p className="text-sm text-ink-m leading-relaxed mb-5">
                Not a raw transcript dump. Lectly breaks your lecture into logical sections,
                pulls out key points, and tags definitions — so you get notes that actually
                make sense when you read them back.
              </p>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-amber-500/8 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                </div>
                <h3 className="text-[15px] font-semibold text-ink" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                  Explain This
                </h3>
              </div>
              <p className="text-sm text-ink-m leading-relaxed">
                Highlight any section. Get it explained in simpler terms with an analogy
                that clicks. Choose beginner, intermediate, or advanced depth.
              </p>
            </div>

            <div className="flex-shrink-0 w-full md:w-[340px] bg-cream border border-[rgba(217,185,130,0.25)] rounded-2xl p-4">
              <div className="space-y-2.5">
                <div className="bg-accent-l/[0.05] border-l-2 border-accent rounded-r px-3 py-2">
                  <span className="text-[9px] font-semibold text-accent block mb-0.5">Key Point</span>
                  <span className="text-[11px] text-sub">
                    Newton&apos;s Second Law: F = ma. Force equals mass times acceleration.
                  </span>
                </div>
                <div className="bg-emerald-500/[0.05] border-l-2 border-emerald-500 rounded-r px-3 py-2">
                  <span className="text-[9px] font-semibold text-emerald-600 block mb-0.5">Definition: Inertia</span>
                  <span className="text-[11px] text-sub">
                    The tendency of an object to resist changes in its state of motion.
                  </span>
                </div>
                <div className="bg-amber-500/[0.05] border-l-2 border-amber-500 rounded-r px-3 py-2">
                  <span className="text-[9px] font-semibold text-amber-600 block mb-0.5">Key Point</span>
                  <span className="text-[11px] text-sub">
                    Weight is a force (measured in Newtons), mass is a property (measured in kg).
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Feature Row 2 */}
          <div className="flex flex-col-reverse md:flex-row items-start gap-8">
            <div className="flex-shrink-0 w-full md:w-[340px] bg-cream border border-[rgba(217,185,130,0.25)] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <GraduationCap className="w-4 h-4 text-accent" />
                <span className="text-[11px] font-semibold text-ink" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                  Learn Mode — Quiz
                </span>
              </div>
              <p className="text-[11px] text-sub mb-3">
                What happens to acceleration if you double the force but keep mass constant?
              </p>
              <div className="space-y-1.5">
                {["It halves", "It doubles", "It stays the same", "It quadruples"].map((opt, i) => (
                  <div
                    key={opt}
                    className={`text-[11px] px-3 py-2 rounded-lg border ${
                      i === 1
                        ? "border-emerald-500/40 bg-emerald-500/[0.06] text-emerald-700"
                        : "border-[rgba(217,185,130,0.2)] text-ink-m"
                    }`}
                  >
                    {i === 1 && <Check className="w-3 h-3 inline mr-1.5 text-emerald-500" />}
                    {opt}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-ink-f mt-2.5">
                F = ma → If F doubles and m stays constant, a must double.
              </p>
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/8 flex items-center justify-center">
                  <GraduationCap className="w-4 h-4 text-emerald-600" />
                </div>
                <h3 className="text-[15px] font-semibold text-ink" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                  Learn Mode
                </h3>
              </div>
              <p className="text-sm text-ink-m leading-relaxed mb-5">
                A full lesson built from your lecture content. Worked examples with
                step-by-step solutions. Quiz questions to test yourself. Resources
                and analogies to make concepts stick.
              </p>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-accent-l/8 flex items-center justify-center">
                  <Download className="w-4 h-4 text-accent" />
                </div>
                <h3 className="text-[15px] font-semibold text-ink" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                  Download & Share
                </h3>
              </div>
              <p className="text-sm text-ink-m leading-relaxed">
                Export your notes as a clean PDF. Share with classmates
                easily. They upload, they learn — everyone benefits.
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
              className="text-base sm:text-lg font-bold text-ink mb-2"
              style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}
            >
              Built for Nigerian students
            </h2>
            <p className="text-sm text-ink-m leading-relaxed">
              Lectly is designed for how students actually learn in Nigerian universities — where
              lecture halls are crowded, audio is messy, and textbooks don&apos;t always match what the
              professor teaches. We handle the noise, the accents, and the chaos. You focus on understanding.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section id="pricing" className="py-14 sm:py-16 px-5 sm:px-8 bg-paper">
        <div className="max-w-[900px] mx-auto">
          <span className="text-[11px] font-bold text-ink-f uppercase tracking-widest mb-2 block text-center">
            Pricing
          </span>
          <h2
            className="text-lg sm:text-xl font-bold text-ink text-center mb-2"
            style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}
          >
            Simple pricing for students
          </h2>
          <p className="text-[13px] text-ink-m text-center mb-10">
            Start free. Upgrade when you need more.
          </p>

          <div className="grid sm:grid-cols-3 gap-4">
            {/* Free Trial */}
            <div className="rounded-2xl border border-[rgba(217,185,130,0.25)] bg-cream p-5">
              <h3 className="text-sm font-semibold text-ink mb-0.5" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                Free Trial
              </h3>
              <p className="text-[11px] text-ink-f mb-3">Try Lectly out</p>
              <div className="text-2xl font-bold text-ink mb-4" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                &#8358;0
              </div>
              <ul className="space-y-2 text-[13px] text-ink-m mb-5">
                {[
                  "3 lecture uploads (one-time)",
                  "Full AI-generated notes",
                  "Learn Mode access",
                  "Explain This (unlimited)",
                  "No PDF export",
                  "No permanent storage",
                ].map((f, i) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${i >= 4 ? "text-muted-bg" : "text-emerald-500"}`} />
                    <span className={i >= 4 ? "text-ink-f" : ""}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/sign-up"
                className="block text-center py-2.5 rounded-lg border border-[rgba(217,185,130,0.35)] text-ink hover:bg-cream transition-colors text-[13px] font-medium"
              >
                Start Free
              </Link>
            </div>

            {/* Basic — Featured */}
            <div className="rounded-2xl border-2 border-ink bg-ink p-5 relative text-white">
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-accent text-white text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Popular
              </div>
              <h3 className="text-sm font-semibold text-white mb-0.5" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                Basic
              </h3>
              <p className="text-[11px] text-white/50 mb-3">For regular use</p>
              <div className="text-2xl font-bold text-white mb-1" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                &#8358;3,500<span className="text-xs font-normal text-white/40">/mo</span>
              </div>
              <p className="text-[10px] text-white/40 mb-4">~$2.33/month</p>
              <ul className="space-y-2 text-[13px] text-white/70 mb-5">
                {[
                  "8 lectures per month",
                  "Full AI-generated notes",
                  "Learn Mode & Explain This",
                  "PDF export",
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
                className="block text-center py-2.5 rounded-lg bg-white text-ink hover:bg-white/90 transition-colors text-[13px] font-semibold"
              >
                Get Basic
              </Link>
            </div>

            {/* Pro */}
            <div className="rounded-2xl border border-[rgba(217,185,130,0.25)] bg-cream p-5">
              <h3 className="text-sm font-semibold text-ink mb-0.5" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                Pro
              </h3>
              <p className="text-[11px] text-ink-f mb-3">For serious students</p>
              <div className="text-2xl font-bold text-ink mb-1" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
                &#8358;8,500<span className="text-xs font-normal text-ink-f">/mo</span>
              </div>
              <p className="text-[10px] text-ink-f mb-4">~$5.67/month</p>
              <ul className="space-y-2 text-[13px] text-ink-m mb-5">
                {[
                  "20 lectures per month",
                  "Everything in Basic",
                  "Solve Mode (ask questions)",
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
                className="block text-center py-2.5 rounded-lg border border-[rgba(217,185,130,0.35)] text-ink hover:bg-cream transition-colors text-[13px] font-medium"
              >
                Get Pro
              </Link>
            </div>
          </div>

          <p className="text-center text-[11px] text-ink-f mt-6">
            Need group or campus-wide access?{" "}
            <a href="mailto:lectlyapp@gmail.com" className="text-accent hover:underline">
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
            className="text-lg sm:text-xl font-bold text-ink mb-3"
            style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}
          >
            Stop letting good lectures go to waste
          </h2>
          <p className="text-sm text-ink-m mb-6">
            Upload your first lecture and see the difference in five minutes.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 bg-ink hover:bg-ink-h text-white px-6 py-3 rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            Get Started — It&apos;s Free
            <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-[11px] text-ink-f mt-3">
            Free to start. No credit card needed.
          </p>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-[rgba(217,185,130,0.25)] py-6 px-5 sm:px-8 bg-paper">
        <div className="max-w-[900px] mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <StratumLogo size={20} />
            <span
              className="text-[13px] font-semibold text-ink"
              style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}
            >
              Lectly
            </span>
          </div>
          <p className="text-[11px] text-ink-f">
            &copy; 2026 Lectly. Built for students, by students.
          </p>
          <div className="flex gap-5 text-[11px] text-ink-m">
            <a href="/privacy" className="hover:text-ink transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-ink transition-colors">Terms</a>
            <a href="mailto:lectlyapp@gmail.com" className="hover:text-ink transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
