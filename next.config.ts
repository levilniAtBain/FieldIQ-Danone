import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb", // for photo/audio uploads
    },
  },
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
