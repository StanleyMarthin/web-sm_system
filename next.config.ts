import type { NextConfig } from "next";

const HOST = process.env.BACKEND_API_HOST || "http://108.136.189.225";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api-proxy/auth/:path*",
        destination: `${HOST}:8085/api/v1/auth/:path*`,
      },
      {
        source: "/api-proxy/job-plan/:path*",
        destination: `${HOST}:8083/:path*`,
      },
      {
        source: "/api-proxy/tasks/:path*",
        destination: `${HOST}:8086/:path*`,
      },
      {
        source: "/api-proxy/countdown/:path*",
        destination: `${HOST}:8090/:path*`,
      },
      {
        source: "/api-proxy/warehouse/:path*",
        destination: `${HOST}:8091/:path*`,
      },
      {
        source: "/api-proxy/qc/:path*",
        destination: `${HOST}:8088/:path*`,
      },
      {
        source: "/api-proxy/wo/:path*",
        destination: `${HOST}:8093/:path*`,
      },
      // PR is intentionally excluded as requested
    ];
  },
};

export default nextConfig;
