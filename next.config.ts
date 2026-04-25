import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // fluent-ffmpeg and ffmpeg-static are Node.js-only — keep them server-side
  serverExternalPackages: ["fluent-ffmpeg", "ffmpeg-static", "nodejs-whisper"],
};

export default nextConfig;
