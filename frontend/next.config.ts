import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: false, // We register manually in PushNotifications.tsx
  fallbacks: {
    document: "/offline",
  },
  cacheOnFrontEndNav: true,
  reloadOnOnline: true,
  customWorkerSrc: "worker",
});

const nextConfig: NextConfig = {
  turbopack: {},
};

export default withPWA(nextConfig);
