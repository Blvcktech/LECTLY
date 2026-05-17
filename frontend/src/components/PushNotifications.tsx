"use client";

/**
 * PushNotifications — Registers the service worker and manages push subscriptions.
 *
 * On mount (if the user is signed in):
 * 1. Registers the service worker (/sw.js)
 * 2. Checks if the user already has a push subscription
 * 3. If not, shows a prompt asking to enable notifications
 * 4. On accept, subscribes to push and sends the subscription to the backend
 *
 * Mount once in the app layout, inside ClerkProvider.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { Bell, X } from "lucide-react";
import { authHeaders } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

// Convert VAPID key from base64 to Uint8Array (required by PushManager)
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushNotifications() {
  const { isSignedIn } = useAuth();
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const checkedRef = useRef(false);

  const registerAndSubscribe = useCallback(async () => {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
      if (!VAPID_PUBLIC_KEY) return;

      // Register service worker
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Check existing subscription
      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) {
        // Already subscribed — send to backend in case it's a new device
        await sendSubscriptionToServer(existingSub);
        return;
      }

      // Check notification permission state
      const permission = Notification.permission;
      if (permission === "denied") return; // User previously blocked — don't ask again
      if (permission === "granted") {
        // Permission already granted but no subscription — subscribe now
        await subscribeToPush(registration);
        return;
      }

      // Permission is "default" — show our custom prompt (not the browser one yet)
      setShowPrompt(true);
    } catch (err) {
      console.warn("[Lectly] Push setup error:", err);
    }
  }, []);

  const subscribeToPush = async (registration: ServiceWorkerRegistration) => {
    try {
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });
      await sendSubscriptionToServer(subscription);
      setShowPrompt(false);
    } catch (err) {
      console.warn("[Lectly] Push subscription failed:", err);
      setShowPrompt(false);
    }
  };

  const sendSubscriptionToServer = async (subscription: PushSubscription) => {
    try {
      await fetch(`${API_URL}/api/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
    } catch (err) {
      console.warn("[Lectly] Failed to save push subscription:", err);
    }
  };

  const handleEnable = async () => {
    const registration = await navigator.serviceWorker.ready;
    await subscribeToPush(registration);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
  };

  useEffect(() => {
    if (!isSignedIn || checkedRef.current || dismissed) return;
    checkedRef.current = true;

    // Small delay so it doesn't fire immediately on page load
    const timer = setTimeout(() => {
      registerAndSubscribe();
    }, 5000);

    return () => clearTimeout(timer);
  }, [isSignedIn, dismissed, registerAndSubscribe]);

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-24 lg:bottom-8 left-4 sm:left-6 z-[90] max-w-sm animate-[slideIn_0.3s_ease-out]">
      <div className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.35)] rounded-2xl p-4 shadow-xl shadow-black/10">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0F3D43]/10 flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-[#0F3D43]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#1a1815] mb-1">
              Enable notifications?
            </p>
            <p className="text-xs text-[#8a7f6f] leading-relaxed mb-3">
              Get notified when your lectures finish processing — even if you close the tab.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleEnable}
                className="text-xs font-semibold text-white bg-[#0F3D43] hover:bg-[#1a5c64] px-4 py-1.5 rounded-lg transition-colors"
              >
                Enable
              </button>
              <button
                onClick={handleDismiss}
                className="text-xs text-[#8a7f6f] hover:text-[#1a1815] px-3 py-1.5 transition-colors"
              >
                Not now
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-[#8a7f6f] hover:text-[#1a1815] transition-colors flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
