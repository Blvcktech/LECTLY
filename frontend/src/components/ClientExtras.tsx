"use client";

/**
 * ClientExtras — Lazy-loads non-critical client components.
 *
 * Root layout is a Server Component and can't use `next/dynamic` with `{ ssr: false }`.
 * This wrapper is a Client Component so it can lazy-load these safely.
 */

import dynamic from "next/dynamic";

const NotificationWatcher = dynamic(() => import("@/components/NotificationWatcher"), { ssr: false });
const PushNotifications = dynamic(() => import("@/components/PushNotifications"), { ssr: false });
const InstallPrompt = dynamic(() => import("@/components/InstallPrompt"), { ssr: false });

export default function ClientExtras() {
  return (
    <>
      <NotificationWatcher />
      <PushNotifications />
      <InstallPrompt />
    </>
  );
}
