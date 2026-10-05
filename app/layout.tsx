import type { Metadata } from "next";
import { Figtree, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { LensProvider } from "@/components/LensProvider";
import { profile } from "@/data/profile";

const sans = Figtree({ subsets: ["latin"], variable: "--font-figtree", display: "swap" });
const display = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", axes: ["opsz"] });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-src", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(`https://${profile.domain}`),
  title: { default: `${profile.name} · Software engineering student`, template: `%s · ${profile.name}` },
  description:
    "Tanner Mayfield is a BYU Information Systems student building AI-assisted, full-stack software. Projects, case studies, and evidence.",
  openGraph: { title: profile.name, description: profile.headline, type: "website" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <head>
        {/* Synchronous on purpose: sets the theme class before first paint. */}
        <script src="/theme-init.js" />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-bg"
        >
          Skip to content
        </a>
        <LensProvider>
          <Header />
          <main id="main">{children}</main>
          <Footer />
        </LensProvider>
      </body>
    </html>
  );
}
