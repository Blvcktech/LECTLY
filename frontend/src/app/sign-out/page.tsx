"use client";

import { useClerk } from "@clerk/nextjs";
import { useEffect } from "react";

export default function SignOutPage() {
  const { signOut } = useClerk();

  useEffect(() => {
    signOut({ redirectUrl: "/" });
  }, [signOut]);

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <p className="text-ink-f">Signing out...</p>
    </div>
  );
}
