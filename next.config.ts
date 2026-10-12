import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // Set by the GitHub Pages workflow, where the site is served under /<repo-name>.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
