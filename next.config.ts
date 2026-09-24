import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone-бандл для Docker на Timeweb (см. Dockerfile).
  output: "standalone",
  images: { remotePatterns: [{ protocol: "https", hostname: "avatars.githubusercontent.com" }] },
};

export default nextConfig;
