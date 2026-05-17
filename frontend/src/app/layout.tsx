import type { Metadata } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import { ToastProvider } from "@/components/Toast";
import AuthSync from "@/components/AuthSync";
import NotificationWatcher from "@/components/NotificationWatcher";
import PushNotifications from "@/components/PushNotifications";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Lectly — Your AI Lecture Companion",
  description:
    "Upload messy lecture recordings. Get clean notes. Learn with an AI tutor that teaches it back to you.",
  keywords: [
    "lecture notes",
    "AI tutor",
    "student",
    "study",
    "transcription",
    "learn mode",
    "university",
    "Nigeria",
  ],
  manifest: "/manifest.json",
  metadataBase: new URL("https://lectly.vercel.app"),
  openGraph: {
    title: "Lectly — Your AI Lecture Companion",
    description:
      "Upload messy lecture recordings. Get clean notes. Learn with an AI tutor that teaches it back to you.",
    url: "https://lectly.vercel.app",
    siteName: "Lectly",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Lectly — AI-powered lecture notes, Learn Mode, and AI Tutor",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lectly — Your AI Lecture Companion",
    description:
      "Upload messy lecture recordings. Get clean notes. Learn with an AI tutor that teaches it back to you.",
    images: ["/og-image.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Lectly",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  icons: [
    { rel: "icon", url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    { rel: "icon", url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    { rel: "apple-touch-icon", url: "/apple-touch-icon.png", sizes: "180x180" },
  ],
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0F3D43",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} ${plusJakarta.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          <AuthSync />
          <ToastProvider>
            <NotificationWatcher />
            <PushNotifications />
            {children}
          </ToastProvider>
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
