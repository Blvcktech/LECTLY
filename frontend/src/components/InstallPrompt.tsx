"use client";

/**
 * InstallPrompt — Shows a banner prompting users to install Lectly as a PWA.
 *
 * Captures the browser's `beforeinstallprompt` event and shows a subtle banner
 * at the bottom of the screen. On iOS Safari (which doesn't fire that event),
 * detects the browser and shows a manual "Add to Home Screen" hint instead.
 *
 * Dismissal is remembered for 7 days via localStorage.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { Download, X, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Check if running as installed PWA already
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOSSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isWebkit = /WebKit/.test(ua);
  const isChrome = /CriOS/.test(ua);
  return isIOS && isWebkit && !isChrome;
}

const DISMISS_KEY = "lectly-install-dismissed";
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export default function InstallPrompt() {
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  const handleInstall = useCallback(async () => {
    const prompt = deferredPromptRef.current;
    if (!prompt) return;

    prompt.prompt();
    const { outcome } = await prompt.userChoice;

    if (outcome === "accepted") {
      setShowBanner(false);
    }
    deferredPromptRef.current = null;
  }, []);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    try {
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
    } catch {
      // localStorage not available
    }
  }, []);

  useEffect(() => {
    // Don't show if already installed
    if (isStandalone()) return;

    // Don't show if recently dismissed
    try {
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (dismissed && Date.now() - parseInt(dismissed) < DISMISS_DURATION) return;
    } catch {
      // localStorage not available
    }

    // iOS Safari — show manual instructions after a delay
    if (isIOSSafari()) {
      const timer = setTimeout(() => {
        setIsIOS(true);
        setShowBanner(true);
      }, 10000); // 10 second delay
      return () => clearTimeout(timer);
    }

    // Chrome/Edge/etc. — listen for the native install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      // Show after a small delay so it doesn't interrupt initial load
      setTimeout(() => setShowBanner(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-[80] animate-[slideIn_0.3s_ease-out]">
      <div className="bg-paper border border-[rgba(217,185,130,0.35)] rounded-2xl p-4 shadow-xl shadow-black/10">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
            {isIOS ? (
              <Share className="w-5 h-5 text-accent" />
            ) : (
              <Download className="w-5 h-5 text-accent" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-ink mb-1">
              Install Lectly
            </p>
            <p className="text-xs text-ink-m leading-relaxed mb-3">
              {isIOS
                ? "Tap the share button, then \"Add to Home Screen\" for the full app experience."
                : "Add Lectly to your home screen for quick access and an app-like experience."}
            </p>
            {!isIOS && (
              <div className="flex gap-2">
                <button
                  onClick={handleInstall}
                  className="text-xs font-semibold text-white bg-accent hover:bg-accent-l px-4 py-1.5 rounded-lg transition-colors"
                >
                  Install
                </button>
                <button
                  onClick={handleDismiss}
                  className="text-xs text-ink-m hover:text-ink px-3 py-1.5 transition-colors"
                >
                  Not now
                </button>
              </div>
            )}
            {isIOS && (
              <button
                onClick={handleDismiss}
                className="text-xs text-ink-m hover:text-ink transition-colors"
              >
                Got it
              </button>
            )}
          </div>
          <button
            onClick={handleDismiss}
            className="text-ink-m hover:text-ink transition-colors flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
