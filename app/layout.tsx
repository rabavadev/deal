import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Deal — AI Tool Offers & Free Credits", template: "%s · Deal" },
  description:
    "Every AI tool deal in one place: free credits, student plans, and discounts on the best AI chatbots, coding tools, and APIs.",
  manifest: "/manifest.json",
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
};

export const viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-neutral-950 text-neutral-100">
        <header className="sticky top-0 z-20 border-b border-neutral-800/80 bg-neutral-950/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="text-xl">📡</span>
              <span>
                Deal<span className="text-emerald-400">.</span>
              </span>
            </Link>
            <nav className="flex items-center gap-5 text-sm text-neutral-400">
              <Link href="/" className="hover:text-neutral-100 transition-colors">
                All tools
              </Link>
              <a
                href="mailto:submit@example.com"
                className="rounded-lg border border-neutral-700 px-3 py-1.5 text-neutral-200 hover:border-neutral-500 transition-colors"
              >
                Submit a deal
              </a>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-neutral-800/80 py-8 text-center text-xs text-neutral-500">
          <p className="mx-auto max-w-xl px-4">
            Deal curates public offers from AI companies. Some links are affiliate links — we may earn a
            commission at no cost to you. Always confirm terms on the provider's site.
          </p>
        </footer>
      </body>
    </html>
  );
}
