import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import StratumLogo from "@/components/StratumLogo";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Subtle decorative circle */}
      <div className="absolute top-[-120px] left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-[radial-gradient(ellipse,rgba(15,61,67,0.06)_0%,transparent_70%)] pointer-events-none" />

      <Link href="/" className="flex items-center gap-2.5 mb-7 relative">
        <StratumLogo size={36} />
        <span
          className="text-xl font-bold text-ink tracking-tight"
          style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}
        >
          Lectly
        </span>
      </Link>

      <SignUp
        appearance={{
          elements: {
            rootBox: "w-full max-w-sm",
            card: "bg-paper border border-[rgba(217,185,130,0.25)] rounded-2xl shadow-lg shadow-[rgba(217,185,130,0.08)]",
            headerTitle: "text-ink",
            headerSubtitle: "text-ink-m",
            socialButtonsBlockButton:
              "bg-cream border-[rgba(217,185,130,0.3)] text-ink hover:bg-cream-d",
            socialButtonsBlockButtonText: "text-ink",
            formFieldLabel: "text-ink-m",
            formFieldInput:
              "bg-cream border-[rgba(217,185,130,0.3)] text-ink placeholder:text-ink-f focus:border-accent-l focus:ring-accent-l/20",
            formButtonPrimary:
              "bg-ink hover:bg-ink-h shadow-none text-white",
            footerActionLink: "text-accent hover:text-[#0a2f34]",
            dividerLine: "bg-[rgba(217,185,130,0.25)]",
            dividerText: "text-ink-f",
            identityPreviewEditButton: "text-accent",
            formFieldAction: "text-accent",
            otpCodeFieldInput:
              "bg-cream border-[rgba(217,185,130,0.3)] text-ink",
          },
        }}
      />

      <p className="text-[11px] text-ink-f mt-6 relative">
        Free tier: 3 lectures. No credit card required.
      </p>
    </div>
  );
}
