import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProviders } from "../lib/providers/AppProviders.js";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Dream Team - AI Documentation Assistant",
  description: "AI-powered documentation assistant with BMAD agent workflow visualization",
  keywords: "AI, documentation, agents, workflow, automation, BMAD",
  authors: [{ name: "Dream Team" }],
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#3b82f6',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100`}
        suppressHydrationWarning
      >
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
