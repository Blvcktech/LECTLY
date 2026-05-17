"use client";

import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#F7F4EE]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#FDFCF9]/90 backdrop-blur-md border-b border-[rgba(217,185,130,0.2)]">
        <div className="max-w-[800px] mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 text-[#8a7f6f] hover:text-[#1a1815] transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back</span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-[800px] mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-6 h-6 text-[#8a7f6f]" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#b5ad9e]">Legal</span>
        </div>
        <h1 className="text-[32px] sm:text-[40px] font-extrabold text-[#1a1815] tracking-tight leading-tight mb-3" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
          Privacy Policy
        </h1>
        <p className="text-sm text-[#8a7f6f] mb-10">Last updated: May 2025</p>

        <div className="space-y-8 text-[15px] text-[#4a4540] leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-[#1a1815] mb-3" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>1. Introduction</h2>
            <p>
              Lectly (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is an AI-powered lecture companion designed to help university students learn more effectively. This Privacy Policy explains how we collect, use, store, and protect your information when you use our platform at lectly.vercel.app and any associated services.
            </p>
            <p className="mt-3">
              By using Lectly, you agree to the collection and use of information in accordance with this policy. If you do not agree with this policy, please do not use our services.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1815] mb-3" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>2. Information We Collect</h2>
            <p className="font-semibold text-[#1a1815] mt-4 mb-2">Account Information</p>
            <p>
              When you create an account through our authentication provider (Clerk), we receive your name, email address, and profile picture. We do not store your password — authentication is handled entirely by Clerk.
            </p>
            <p className="font-semibold text-[#1a1815] mt-4 mb-2">Lecture Content</p>
            <p>
              When you upload audio files, we store the audio temporarily for processing. After transcription, the audio file may be deleted. We store the generated transcript, AI-generated notes, Learn Mode content, and study progress data associated with your account.
            </p>
            <p className="font-semibold text-[#1a1815] mt-4 mb-2">Usage Data</p>
            <p>
              We collect basic usage information such as which features you use, study progress, and interaction data (e.g., tutor questions asked, quiz answers). This helps us improve the learning experience.
            </p>
            <p className="font-semibold text-[#1a1815] mt-4 mb-2">Technical Data</p>
            <p>
              We automatically collect standard technical information including IP address, browser type, device type, and access timestamps for security and performance monitoring.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1815] mb-3" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>3. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul className="mt-3 space-y-2 ml-5">
              <li className="list-disc">Process and transcribe your lecture audio files</li>
              <li className="list-disc">Generate AI-powered study notes, explanations, and quiz content</li>
              <li className="list-disc">Provide personalized tutoring through our AI Tutor feature</li>
              <li className="list-disc">Track and display your study progress</li>
              <li className="list-disc">Improve our AI models and educational content quality</li>
              <li className="list-disc">Communicate with you about your account and service updates</li>
              <li className="list-disc">Ensure platform security and prevent abuse</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1815] mb-3" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>4. Third-Party AI Processing</h2>
            <p>
              To deliver our core features, your lecture content is processed by third-party AI services. This is essential to how Lectly works. The following services may process your content:
            </p>
            <ul className="mt-3 space-y-2 ml-5">
              <li className="list-disc"><strong>Anthropic (Claude)</strong> — Used for tutoring, Learn Mode lessons, and text explanations</li>
              <li className="list-disc"><strong>Google (Gemini)</strong> — Used for note generation and as a fallback for educational content</li>
              <li className="list-disc"><strong>AssemblyAI</strong> — Used for audio transcription</li>
            </ul>
            <p className="mt-3">
              These providers process your content according to their own privacy policies and data handling practices. We do not sell your content to any third party. Content is sent to these services solely for the purpose of generating educational material for your use.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1815] mb-3" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>5. Data Storage and Security</h2>
            <p>
              Your data is stored on secure servers hosted by Railway. We implement reasonable security measures to protect your information, including encrypted connections (HTTPS), authenticated API access, and rate limiting to prevent abuse.
            </p>
            <p className="mt-3">
              While we take security seriously, no method of electronic storage is 100% secure. We cannot guarantee absolute security of your data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1815] mb-3" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>6. Data Retention</h2>
            <p>
              We retain your lecture content, notes, and study progress for as long as your account is active. You can delete individual lectures at any time through the app, which removes the associated notes, transcripts, and cached content. If you wish to delete your entire account and all associated data, please contact us.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1815] mb-3" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="mt-3 space-y-2 ml-5">
              <li className="list-disc">Access the personal data we hold about you</li>
              <li className="list-disc">Request correction of inaccurate data</li>
              <li className="list-disc">Delete your lectures and associated content at any time</li>
              <li className="list-disc">Request deletion of your account and all associated data</li>
              <li className="list-disc">Withdraw consent and stop using our services</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, please contact us at the email address provided below.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1815] mb-3" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>8. Children&apos;s Privacy</h2>
            <p>
              Lectly is designed for university students and is not intended for children under the age of 16. We do not knowingly collect personal information from children under 16. If we become aware that we have collected data from a child under 16, we will take steps to delete that information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1815] mb-3" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any significant changes by posting the new policy on this page and updating the &quot;Last updated&quot; date. Continued use of Lectly after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1815] mb-3" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>10. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <p className="mt-3 font-semibold text-[#1a1815]">lectlyapp@gmail.com</p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-[rgba(217,185,130,0.2)] flex items-center justify-between text-sm text-[#8a7f6f]">
          <p>&copy; {new Date().getFullYear()} Lectly</p>
          <div className="flex gap-5">
            <Link href="/terms" className="hover:text-[#1a1815] transition-colors">Terms of Service</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
