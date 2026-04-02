import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
