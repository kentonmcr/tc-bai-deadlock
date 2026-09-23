import type { NextConfig } from "next";

// Baseline security headers (flagged by vercel-security-scanner as missing).
// No nonce-based CSP yet — that requires opting every page into dynamic
// rendering, which isn't worth it before there's anything sensitive to
// protect against inline-script injection. Revisit connect-src once
// client-side fetches to Supabase are added.
const isDev = process.env.NODE_ENV === "development";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // 'unsafe-eval' is required in dev only — React uses eval() there
      // for debugging features, never in production. See:
      // node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      // @deadlock-api/ui-core's card components load their own font and
      // fetch their own hero/item data client-side from these hosts.
      "font-src 'self' https://assets-bucket.deadlock-api.com",
      "connect-src 'self' https://*.supabase.co https://api.deadlock-api.com https://assets-bucket.deadlock-api.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
