import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone-бандл для Docker на Timeweb (см. Dockerfile).
  output: "standalone",
  images: { remotePatterns: [{ protocol: "https", hostname: "avatars.githubusercontent.com" }] },
  // ssh2 (установка агента по SSH) тянет опциональный нативный модуль
  // cpu-features — бандлить его в route handler нельзя, грузим из node_modules.
  serverExternalPackages: ["ssh2"],
};

export default nextConfig;
