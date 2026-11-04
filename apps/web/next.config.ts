import type { NextConfig } from "next";

// The API, reached through this origin at /v1: the admin session lives in httpOnly SameSite=Strict
// cookies, which the browser only sends first-party. (*.up.railway.app is a public suffix, so the
// API's own Railway domain could never share cookies with this one.)
const apiUrl = (process.env.API_URL ?? "http://localhost:3000").replace(/\/+$/, "");

const config: NextConfig = {
  // The development badge sits bottom left by default, on top of the admin rail's account button.
  devIndicators: { position: "bottom-right" },
  async rewrites() {
    return [
      { source: "/v1/:path*", destination: `${apiUrl}/v1/:path*` },
      // App Router folders can't start with ".", so the verification files are served from
      // /well-known/*.
      {
        source: "/.well-known/apple-app-site-association",
        destination: "/well-known/apple-app-site-association",
      },
      { source: "/.well-known/assetlinks.json", destination: "/well-known/assetlinks" },
    ];
  },
};

export default config;
