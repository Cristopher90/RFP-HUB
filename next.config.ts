import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Excel imports of purchase requests are posted as one JSON payload; the
    // 1MB default is too small for a few thousand lines.
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
