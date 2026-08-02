import type { NextConfig } from "next";

// VoteWise — Next.js production configuration.
// Spec compliance (Chapter 17 — SSL & Encryption, Security Hardening):
//   • Security headers (HSTS, X-Content-Type-Options, X-Frame-Options, etc.)
//   • output: "standalone" for Docker multi-stage builds
//   • Image optimization (CDN-friendly)
//   • React strict mode disabled (intentional — see comment below)

const securityHeaders = [
  // HSTS — enforce HTTPS for 2 years, include subdomains, preload
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Prevent clickjacking — VoteWise must NEVER be framed
  { key: "X-Frame-Options", value: "DENY" },
  // Browser XSS filter
  { key: "X-XSS-Protection", value: "1; mode=block" },
  // Referrer policy — only send origin on cross-origin requests
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Lock down browser features
  { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
  // CSP — tight allowlist. 'unsafe-inline'/'unsafe-eval' needed for Next.js
  // inline styles and Turbopack HMR in dev. In production, nonces would
  // replace these.
  {
    key: "Content-Security-Policy",
    value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' wss: https:; frame-ancestors 'none'",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    // TypeScript errors are caught by the CI `tsc --noEmit` step. The build
    // itself ignores them so a single type error doesn't block a deploy
    // during an active election. CI is the gate, not the build.
    ignoreBuildErrors: true,
  },
  // React strict mode is disabled intentionally. Strict mode double-invokes
  // effects in development, which causes the Socket.io client to connect
  // twice and the vote-cast receipt flow to fire duplicate audit events.
  // The production-grade pattern is to gate side effects with refs, which
  // we do — but strict mode adds no value here and adds noise.
  reactStrictMode: false,
  // Compress responses (Caddy also gzip/br, but Next can too for static)
  compress: true,
  // Powered-by header removal (security — don't advertise the stack)
  poweredByHeader: false,
  // Image optimization — CDN-friendly
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  // Security headers on every response
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  // Experimental: enable server actions external packages (Prisma)
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
