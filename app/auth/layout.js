import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css"; // Import global styles
import AuthOnlyProviders from "../../lib/providers/AuthOnlyProviders.js";
import Link from 'next/link'; // Needed for footer links

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function AuthLayout({ children }) {
  return (
    <div className="flex flex-col min-h-screen">
      <AuthOnlyProviders>
        <main className="flex-1">
          {children}
        </main>
        <footer className="bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-auto">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
            <p>&copy; {new Date().getFullYear()} Dream Team. All rights reserved.</p>
            <div className="flex space-x-4">
              <Link href="/about" className="hover:text-gray-900 dark:hover:text-white">About</Link>
              <Link href="/privacy" className="hover:text-gray-900 dark:hover:text-white">Privacy</Link>
            </div>
          </div>
        </footer>
      </AuthOnlyProviders>
    </div>
  );
}
