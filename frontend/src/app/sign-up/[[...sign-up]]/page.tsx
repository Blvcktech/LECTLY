import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { BookOpen } from "lucide-react";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[radial-gradient(ellipse,rgba(37,99,235,0.12)_0%,transparent_70%)] pointer-events-none" />

      <Link href="/" className="flex items-center gap-2.5 mb-7 relative">
        <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-blue-600 to-green-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-white tracking-tight">Lectly</span>
      </Link>

      <SignUp
        appearance={{
          elements: {
            rootBox: "w-full max-w-sm",
            card: "bg-slate-800/60 border border-slate-700/50 rounded-2xl shadow-none backdrop-blur-sm",
            headerTitle: "text-white",
            headerSubtitle: "text-slate-400",
            socialButtonsBlockButton: "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700",
            formFieldLabel: "text-slate-400",
            formFieldInput: "bg-[#0F172A] border-slate-700 text-white placeholder:text-slate-500",
            formButtonPrimary: "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-md shadow-blue-500/20",
            footerActionLink: "text-blue-400 hover:text-blue-300",
            dividerLine: "bg-slate-700/60",
            dividerText: "text-slate-500",
          },
        }}
      />

      <p className="text-[11px] text-slate-600 mt-6 relative">
        Free tier: 3 lectures per month. No credit card required.
      </p>
    </div>
  );
}
