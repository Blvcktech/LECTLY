"use client";

import { useClerk } from "@clerk/nextjs";
import { useEffect } from "react";

export default function SignOutPage() {
  const { signOut } = useClerk();

  useEffect(() => {
    signOut({ redirectUrl: "/" });
  }, [signOut]);

  return (
    <div className="min-h-screen bg-[#F7F4EE] flex items-center justify-center">
      <p className="text-[#b5ad9e]">Signing out...</p>
    </div>
  );
}
