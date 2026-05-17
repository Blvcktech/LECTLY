import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { BookOpen } from "lucide-react";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-[#F7F4EE] flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Subtle decorative circle */}
      <div className="absolute top-[-120px] left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-[radial-gradient(ellipse,rgba(15,61,67,0.06)_0%,transparent_70%)] pointer-events-none" />

      <Link href="/" className="flex items-center gap-2.5 mb-7 relative">
        <div className="w-9 h-9 rounded-lg bg-[#0F3D43] flex items-center justify-center shadow-sm shadow-[#0F3D43]/15">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <span
          className="text-xl font-bold text-[#1a1815] tracking-tight"
          style={{ fontFamily: "'Georgia', serif" }}
        >
          Lectly
        </span>
      </Link>

      <SignUp
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
              "bg-[#F7F4EE] border-[rgba(217,185,130,0.3)] text-[#1a1815] placeholder:text-[#b5ad9e] focus:border-[#1a5c65] focus:ring-[#1a5c65]/20",
            formButtonPrimary:
              "bg-[#1a1815] hover:bg-[#2a2520] shadow-none text-white",
            footerActionLink: "text-[#0F3D43] hover:text-[#0a2f34]",
            dividerLine: "bg-[rgba(217,185,130,0.25)]",
            dividerText: "text-[#b5ad9e]",
            identityPreviewEditButton: "text-[#0F3D43]",
            formFieldAction: "text-[#0F3D43]",
            otpCodeFieldInput:
              "bg-[#F7F4EE] border-[rgba(217,185,130,0.3)] text-[#1a1815]",
          },
        }}
      />

      <p className="text-[11px] text-[#b5ad9e] mt-6 relative">
        Free tier: 3 lectures. No credit card required.
      </p>
    </div>
  );
}
