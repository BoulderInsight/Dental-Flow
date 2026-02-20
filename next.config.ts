import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow importing the preserved .jsx architecture component
  pageExtensions: ["ts", "tsx", "js", "jsx"],
};

export default nextConfig;
