// Locally there's no BACKEND_URL set, so this falls back to the Express
// server started via `apps/backend`'s `npm run dev`. In production
// (Vercel), the frontend and backend are separate deployments with
// different domains — BACKEND_URL must point at the real backend URL.
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

const nextConfig = {
  reactStrictMode: true,
  // Inlined at build time into process.env.NEXT_PUBLIC_APP_VERSION for
  // client code (lib/brand.js) — shown in diagnostic info attached to
  // feedback/issue reports, so support can tell which deployed version a
  // report came from without asking.
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || "0.0.0",
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
