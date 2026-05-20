"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export function MobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="md:hidden text-[#8a7f6f] hover:text-[#1a1815] p-1"
        aria-label="Toggle menu"
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {open && (
        <div className="md:hidden absolute top-14 left-0 right-0 bg-[#FDFCF9]/98 backdrop-blur-xl border-b border-[rgba(217,185,130,0.25)] px-5 sm:px-8 pb-4 pt-3 space-y-2">
          <a href="#how-it-works" onClick={() => setOpen(false)} className="block text-sm text-[#8a7f6f] py-1.5">
            How It Works
          </a>
          <a href="#features" onClick={() => setOpen(false)} className="block text-sm text-[#8a7f6f] py-1.5">
            Features
          </a>
          <a href="#pricing" onClick={() => setOpen(false)} className="block text-sm text-[#8a7f6f] py-1.5">
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
    </>
  );
}
