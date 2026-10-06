import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Poppins } from "next/font/google";
import "./globals.css";
import { Ambient } from "@/components/Ambient";
import { Footer } from "@/components/Footer";
import { SideNav } from "@/components/SideNav";
import { SocialRail } from "@/components/SocialRail";
import { profile } from "@/data/profile";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter-src", display: "swap" });
const poppins = Poppins({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-poppins-src", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-src", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(`https://${profile.domain}`),
  title: { default: `${profile.name} | BYU Information Systems, software engineering`, template: `%s · ${profile.name}` },
  description:
    "Tanner Mayfield is a BYU Information Systems student building AI-assisted, full-stack software. Projects, case studies, and evidence.",
  openGraph: { title: profile.name, description: profile.headline, type: "website" },
};

export const viewport: Viewport = { themeColor: "#04080f", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable} ${mono.variable}`}>
      <body className="bg-[#04080f]">
        <div className="relative min-h-screen selection:bg-moonstone/30 selection:text-moonstone-light">
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-moonstone focus:px-4 focus:py-2 focus:text-zinc-950"
          >
            Skip to content
          </a>
          <Ambient />
          <div className="flex min-h-screen flex-col lg:flex-row">
            <SideNav />
            <main id="main" className="flex-1 px-6 lg:ml-[80px] lg:mr-[80px] lg:pl-5 lg:pr-5 xl:ml-[120px] xl:mr-[120px]">
              {children}
              <Footer />
            </main>
            <SocialRail />
          </div>
        </div>
      </body>
    </html>
  );
}
