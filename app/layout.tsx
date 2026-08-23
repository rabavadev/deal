import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import Header from "@/components/Header";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Deal — AI Tool Offers & Free Credits", template: "%s · Deal" },
  description:
    "Curated AI tool deals: free credits, student plans, and discounts. No expired codes. Just the good stuff.",
  manifest: "/manifest.json",
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
};

export const viewport = {
  themeColor: "#171717",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased dark`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <Suspense>
          <Header />
        </Suspense>
        <main className="flex-1">{children}</main>
        <footer className="mt-16 border-t border-border">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 9 5 12 1.8-5.2L21 14Z" />
                    <path d="M7.2 2.2 8 5.1" />
                    <path d="m5.1 8-2.9-.8" />
                    <path d="M14 4.1 12 6" />
                    <path d="m6 12-1.9 2" />
                  </svg>
                </span>
                <span className="text-[17px] font-semibold tracking-tight">Deal</span>
              </div>
              <p className="mt-3 max-w-xs text-sm text-muted-foreground">
                A better way to find AI tool perks. Curated deals. No expired codes. Just the good
                stuff.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Resources
              </h4>
              <ul className="mt-3 flex flex-col gap-2 text-sm text-foreground/80">
                <li><a className="hover:text-primary" href="/">All Tools</a></li>
                <li><a className="hover:text-primary" href="mailto:submit@example.com">Submit an Offer</a></li>
                <li><a className="hover:text-primary" href="mailto:feedback@example.com">Feedback</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Company
              </h4>
              <ul className="mt-3 flex flex-col gap-2 text-sm text-foreground/80">
                <li><a className="hover:text-primary" href="mailto:contact@example.com">Contact Us</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border">
            <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row">
              <p>© 2026 Deal. All rights reserved.</p>
              <p>Offer details may change. Always verify on official sites.</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
