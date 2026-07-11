// Locally there's no BACKEND_URL set, so this falls back to the Express
// server started via `apps/backend`'s `npm run dev`. In production
// (Vercel), the frontend and backend are separate deployments with
// different domains — BACKEND_URL must point at the real backend URL.
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

const nextConfig = {
  reactStrictMode: true,
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
