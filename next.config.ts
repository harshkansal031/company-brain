import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  allowedDevOrigins:["https://present-chamois-saved.ngrok-free.app"]
};

export default nextConfig;
