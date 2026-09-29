import type { NextConfig } from "next";

const config: NextConfig = {
  // App Router folders can't start with "." so the verification files are served from /well-known/*.
  async rewrites() {
    return [
      { source: "/.well-known/apple-app-site-association", destination: "/well-known/apple-app-site-association" },
      { source: "/.well-known/assetlinks.json", destination: "/well-known/assetlinks" },
    ];
  },
};

export default config;
