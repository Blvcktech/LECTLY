import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { BookOpen } from "lucide-react";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-[#F7F4EE] flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Subtle decorative circle */}
      <div className="absolute top-[-120px] left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-[radial-gradient(ellipse,rgba(147,51,234,0.06)_0%,transparent_70%)] pointer-events-none" />

      <Link href="/" className="flex items-center gap-2.5 mb-7 relative">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-600 to-purple-700 flex items-center justify-center shadow-sm shadow-purple-500/15">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <span
          className="text-xl font-bold text-[#1a1815] tracking-tight"
          style={{ fontFamily: "'Georgia', serif" }}
        >
          Lectly
        </span>
      </Link>

      <SignIn
        appearance={{
          elements: {
            rootBox: "w-full max-w-sm",
            card: "bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-2xl shadow-lg shadow-[rgba(217,185,130,0.08)]",
            headerTitle: "text-[#1a1815]",
            headerSubtitle: "text-[#8a7f6f]",
            socialButtonsBlockButton:
              "bg-[#F7F4EE] border-[rgba(217,185,130,0.3)] text-[#1a1815] hover:bg-[#EDE8DF]",
            socialButtonsBlockButtonText: "text-[#1a1815]",
            formFieldLabel: "text-[#8a7f6f]",
            formFieldInput:
              "bg-[#F7F4EE] border-[rgba(217,185,130,0.3)] text-[#1a1815] placeholder:text-[#b5ad9e] focus:border-purple-400 focus:ring-purple-400/20",
            formButtonPrimary:
              "bg-[#1a1815] hover:bg-[#2a2520] shadow-none text-white",
            footerActionLink: "text-purple-600 hover:text-purple-700",
            dividerLine: "bg-[rgba(217,185,130,0.25)]",
            dividerText: "text-[#b5ad9e]",
            identityPreviewEditButton: "text-purple-600",
            formFieldAction: "text-purple-600",
            otpCodeFieldInput:
              "bg-[#F7F4EE] border-[rgba(217,185,130,0.3)] text-[#1a1815]",
          },
        }}
      />
    </div>
  );
}
