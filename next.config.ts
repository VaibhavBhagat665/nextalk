import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  env: {
    // Expose socket URL to client-side (Vercel doesn't allow NEXT_PUBLIC_ prefix in env vars)
    NEXT_PUBLIC_SOCKET_URL: process.env.SOCKET_SERVER_URL || "http://localhost:3001",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
      {
        protocol: "https",
        hostname: "images.clerk.dev",
      },
    ],
  },
  async rewrites() {
    const socketUrl = process.env.SOCKET_SERVER_URL || "http://localhost:3001";
    return [
      {
        source: "/socket.io/:path*",
        destination: `${socketUrl}/socket.io/:path*`,
      },
    ];
  },
};

export default nextConfig;
