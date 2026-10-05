import type { NextConfig } from "next";

// Fully static export: deploys anywhere (Vercel, Cloudflare Pages, GitHub Pages).
const config: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default config;
