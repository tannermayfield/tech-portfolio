import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Outfit } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { profile } from "@/data/profile";

const sans = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-src", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(`https://${profile.domain}`),
  title: { default: `${profile.name} | BYU Information Systems, software engineering`, template: `%s · ${profile.name}` },
  description:
    "Tanner Mayfield is a BYU Information Systems student building AI-assisted, full-stack software. Projects, case studies, and evidence.",
  openGraph: { title: profile.name, description: profile.headline, type: "website" },
};

export const viewport: Viewport = { themeColor: "#07141a", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
