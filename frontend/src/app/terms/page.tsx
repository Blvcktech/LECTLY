"use client";

import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

export default function TermsOfService() {
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
          <FileText className="w-6 h-6 text-[#8a7f6f]" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#b5ad9e]">Legal</span>
        </div>
        <h1 className="text-[32px] sm:text-[40px] font-extrabold text-[#1a1815] tracking-tight leading-tight mb-3" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
          Terms of Service
        </h1>
        <p className="text-sm text-[#8a7f6f] mb-10">Last updated: May 2025</p>

        <div className="space-y-8 text-[15px] text-[#4a4540] leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-[#1a1815] mb-3" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>1. Acceptance of Terms</h2>
            <p>
              By accessing or using Lectly (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not use the Service. Lectly is operated by its founding team (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1815] mb-3" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>2. Description of Service</h2>
            <p>
              Lectly is an AI-powered lecture companion platform that helps university students learn more effectively. The Service includes audio transcription, AI-generated study notes, interactive Learn Mode lessons, an AI Tutor, and study progress tracking.
            </p>
            <p className="mt-3">
              Lectly uses artificial intelligence to generate educational content. While we strive for accuracy, AI-generated content may contain errors, inaccuracies, or omissions. Lectly is a study aid and should not be used as the sole source of academic information. Always verify important information with your course materials, textbooks, and instructors.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1815] mb-3" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>3. Account Registration</h2>
            <p>
              To use Lectly, you must create an account. You agree to provide accurate information during registration and to keep your account credentials secure. You are responsible for all activity that occurs under your account.
            </p>
            <p className="mt-3">
              You must be at least 16 years old to create an account and use Lectly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1815] mb-3" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>4. Acceptable Use</h2>
            <p>You agree to use Lectly only for lawful educational purposes. You may not:</p>
            <ul className="mt-3 space-y-2 ml-5">
              <li className="list-disc">Upload content that you do not have the right to share</li>
              <li className="list-disc">Use the Service to engage in academic dishonesty, plagiarism, or contract cheating</li>
              <li className="list-disc">Attempt to circumvent rate limits, usage restrictions, or security measures</li>
              <li className="list-disc">Use automated tools, bots, or scripts to access the Service in ways that exceed normal usage</li>
              <li className="list-disc">Upload content that is illegal, harmful, threatening, abusive, or otherwise objectionable</li>
              <li className="list-disc">Resell, redistribute, or commercially exploit Lectly&apos;s AI-generated content without permission</li>
              <li className="list-disc">Attempt to reverse-engineer, decompile, or extract the underlying AI systems or prompts</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1815] mb-3" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>5. Content Ownership</h2>
            <p className="font-semibold text-[#1a1815] mt-4 mb-2">Your Content</p>
            <p>
              You retain ownership of any lecture recordings, audio files, or other content you upload to Lectly. By uploading content, you grant us a limited license to process, transcribe, and analyze that content solely for the purpose of providing you with the Service.
            </p>
            <p className="font-semibold text-[#1a1815] mt-4 mb-2">AI-Generated Content</p>
            <p>
              Notes, explanations, quiz questions, and other educational materials generated by Lectly&apos;s AI are provided for your personal educational use. You may use this content for your own studying. You may not commercially redistribute AI-generated content at scale.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1815] mb-3" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>6. Free Tier and Usage Limits</h2>
            <p>
              Lectly offers a free tier with limited usage. Free tier users may upload a limited number of lectures. We reserve the right to modify free tier limits, introduce paid plans, or change pricing at any time with reasonable notice.
            </p>
            <p className="mt-3">
              We implement rate limiting to ensure fair usage across all users. Exceeding rate limits will result in temporary restrictions on your ability to use certain features.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1815] mb-3" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>7. AI Disclaimer</h2>
            <p>
              Lectly&apos;s AI features are designed to assist your learning, not replace it. Important disclaimers:
            </p>
            <ul className="mt-3 space-y-2 ml-5">
              <li className="list-disc">AI-generated notes may not capture every detail from your lecture</li>
              <li className="list-disc">Quiz questions and answers are generated by AI and may occasionally contain errors</li>
              <li className="list-disc">The AI Tutor provides educational guidance but is not a substitute for your lecturers or course instructors</li>
              <li className="list-disc">Explanations and analogies are AI-generated and may not always be perfectly accurate</li>
              <li className="list-disc">Resource links suggested by the AI may not always be valid or current</li>
            </ul>
            <p className="mt-3">
              Always cross-reference AI-generated content with your official course materials. We are not responsible for academic outcomes resulting from reliance on AI-generated content.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1815] mb-3" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>8. Service Availability</h2>
            <p>
              We strive to keep Lectly available at all times but do not guarantee uninterrupted service. The Service may be temporarily unavailable due to maintenance, updates, server issues, or circumstances beyond our control. We are not liable for any loss or inconvenience caused by service downtime.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1815] mb-3" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>9. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account if you violate these Terms of Service, engage in abusive behavior, or use the Service in ways that negatively impact other users or our infrastructure.
            </p>
            <p className="mt-3">
              You may delete your account at any time. Upon account deletion, your uploaded content, notes, and study progress will be permanently removed.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1815] mb-3" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>10. Limitation of Liability</h2>
            <p>
              Lectly is provided &quot;as is&quot; without warranties of any kind, express or implied. To the fullest extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service, including but not limited to loss of data, academic outcomes, or service interruptions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1815] mb-3" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>11. Changes to Terms</h2>
            <p>
              We may update these Terms of Service from time to time. We will notify you of significant changes by posting the updated terms on this page and updating the &quot;Last updated&quot; date. Continued use of Lectly after changes constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1815] mb-3" style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}>12. Contact Us</h2>
            <p>
              If you have any questions about these Terms of Service, please contact us at:
            </p>
            <p className="mt-3 font-semibold text-[#1a1815]">lectlyapp@gmail.com</p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-[rgba(217,185,130,0.2)] flex items-center justify-between text-sm text-[#8a7f6f]">
          <p>&copy; {new Date().getFullYear()} Lectly</p>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-[#1a1815] transition-colors">Privacy Policy</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
