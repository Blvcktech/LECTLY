"use client";

/**
 * Payment Callback Page
 *
 * Paystack redirects here after payment with ?reference=xxx in the URL.
 * We verify the payment with our backend, then show success or failure.
 *
 * Important: Since Paystack does a full-page redirect back here, the
 * Clerk auth token hasn't loaded yet when the page first mounts.
 * We wait for the token to be available before calling verify.
 */

import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { verifyPayment } from "@/lib/api";
import { setAuthToken } from "@/lib/auth";

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { getToken, isSignedIn } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  const [message, setMessage] = useState("");
  const [plan, setPlan] = useState("");
  const verifiedRef = useRef(false);

  useEffect(() => {
    // Wait until Clerk has loaded and user is signed in
    if (!isSignedIn) return;
    // Don't run twice
    if (verifiedRef.current) return;

    const reference = searchParams.get("reference") || searchParams.get("trxref");
    if (!reference) {
      setStatus("failed");
      setMessage("No payment reference found.");
      return;
    }

    verifiedRef.current = true;

    // Get a fresh token first, THEN verify the payment
    getToken()
      .then((token) => {
        if (token) setAuthToken(token);
        return verifyPayment(reference);
      })
      .then((result) => {
        if (result.verified) {
          setStatus("success");
          setPlan(result.plan || "");
          setMessage(result.message);
        } else {
          setStatus("failed");
          setMessage(result.message || "Payment could not be verified.");
        }
      })
      .catch(() => {
        setStatus("failed");
        setMessage("Something went wrong verifying your payment. Please contact support.");
      });
  }, [isSignedIn, searchParams, getToken]);

  return (
    <div className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-2xl p-8 max-w-sm w-full text-center">
      {status === "loading" && (
        <>
          <Loader2 className="w-12 h-12 text-[#0F3D43] animate-spin mx-auto mb-4" />
          <p
            className="text-lg font-bold text-[#1a1815] mb-2"
            style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}
          >
            Verifying payment...
          </p>
          <p className="text-sm text-[#8a7f6f]">Hold tight, we&apos;re confirming with Paystack.</p>
        </>
      )}

      {status === "success" && (
        <>
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <p
            className="text-lg font-bold text-[#1a1815] mb-2"
            style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}
          >
            You&apos;re upgraded!
          </p>
          <p className="text-sm text-[#8a7f6f] mb-6">
            {message || `Welcome to the ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan.`}
          </p>
          <button
            onClick={() => router.push("/upload")}
            className="w-full py-2.5 bg-[#0F3D43] text-white rounded-lg text-sm font-semibold hover:bg-[#1a5c64] transition-colors"
          >
            Start uploading
          </button>
        </>
      )}

      {status === "failed" && (
        <>
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <p
            className="text-lg font-bold text-[#1a1815] mb-2"
            style={{ fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif" }}
          >
            Payment not verified
          </p>
          <p className="text-sm text-[#8a7f6f] mb-6">{message}</p>
          <button
            onClick={() => router.push("/profile/subscription")}
            className="w-full py-2.5 border border-[rgba(217,185,130,0.35)] text-[#1a1815] rounded-lg text-sm font-medium hover:bg-[#F7F4EE] transition-colors"
          >
            Try again
          </button>
        </>
      )}
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <div className="min-h-screen bg-[#F7F4EE] flex items-center justify-center px-4">
      <Suspense
        fallback={
          <div className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-2xl p-8 max-w-sm w-full text-center">
            <Loader2 className="w-12 h-12 text-[#0F3D43] animate-spin mx-auto mb-4" />
            <p className="text-lg font-bold text-[#1a1815] mb-2">Loading...</p>
          </div>
        }
      >
        <CallbackContent />
      </Suspense>
    </div>
  );
}
