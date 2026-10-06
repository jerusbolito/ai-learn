import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { StatsBar } from "@/components/StatsBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LearnAI — AI-powered learning platform",
  description:
    "Generate interactive lesson plans with your own LLM API key and learn through quizzes, challenges, and flashcards.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-bold">
              <span className="text-xl">🧠</span>
              <span>
                Learn<span className="text-indigo-400">AI</span>
              </span>
            </Link>
            <StatsBar />
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/paths/new"
                className="rounded-lg px-3 py-1.5 font-medium text-indigo-300 hover:bg-zinc-800"
              >
                + New Path
              </Link>
              <Link
                href="/settings"
                className="rounded-lg px-3 py-1.5 text-zinc-300 hover:bg-zinc-800"
              >
                Settings
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
