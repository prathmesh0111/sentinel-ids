import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Frontend/backend split for hosting: when BACKEND_URL is set (on Vercel),
  // every /api/* call is proxied to the persistent Render backend, where the
  // security engine's in-memory state lives. Locally/Render: unset -> local APIs.
  async rewrites() {
    const backend = process.env.BACKEND_URL
    if (!backend) return []
    return [{ source: '/api/:path*', destination: `${backend}/api/:path*` }]
  },
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
