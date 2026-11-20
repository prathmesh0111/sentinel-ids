import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import SessionBridge from "@/components/SessionBridge";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SecureMart — Shop Safely with AI Fraud Protection",
  description:
    "Real shopping mart protected by a live Fraud & IP Anomaly Detection System: risk scoring, brute-force & DDoS protection, IP blocking and ML anomaly detection.",
  keywords: ["SecureMart", "shopping", "fraud detection", "IP anomaly", "security dashboard"],
  icons: { icon: "/logo.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}>
        <SessionBridge />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
