import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Frontend/backend split for hosting: when BACKEND_URL is set (on Vercel),
  // every /api/* call is proxied to the persistent Render backend, where the
  // security engine's in-memory state lives. Locally/Render: unset -> local APIs.
  // MUST be beforeFiles: array-form rewrites run AFTER filesystem/API matching,
  // which would execute Vercel's own (database-less) API functions instead.
  async rewrites() {
    const backend = process.env.BACKEND_URL
    if (!backend) return { beforeFiles: [] }
    return {
      beforeFiles: [{ source: '/api/:path*', destination: `${backend}/api/:path*` }],
    }
  },
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
