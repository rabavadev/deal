import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static export — deployable to Cloudflare Pages with zero config
  output: "export",
};

export default nextConfig;
