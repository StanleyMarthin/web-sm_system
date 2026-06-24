import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withSentryConfig } from "@sentry/nextjs";

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const r2ImageHost = "pub-3792ac4272754b5b9019fe8659bfab84.r2.dev";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      `img-src 'self' data: blob: https://${r2ImageHost} http://127.0.0.1:3203 http://localhost:3203`,
      "font-src 'self' data:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' http://127.0.0.1:3203 http://localhost:3203",
    ].join("; "),
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: path.resolve(configDirectory, "../.."),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: r2ImageHost,
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "3203",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "3203",
        pathname: "/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG || "stanley-marthin",
  project: process.env.SENTRY_PROJECT || "sm-system",
  silent: !process.env.CI,
  tunnelRoute: "/monitoring",
  sourcemaps: {
    disable: true,
  },
});
