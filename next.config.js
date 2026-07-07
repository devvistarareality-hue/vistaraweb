/** @type {import('next').NextConfig} */
const API_PROXY_TARGET = process.env.API_PROXY_TARGET || 'https://vistararealtybackend-production.up.railway.app';

const nextConfig = {
  images: {
    // Allow next/image to optimize Supabase-hosted assets (project covers, plans, etc.)
    remotePatterns: [
      { protocol: 'https', hostname: 'lftvumbhogcixihjydwx.supabase.co' },
    ],
  },
  // Don't let Next strip the trailing slash before the rewrite runs.
  skipTrailingSlashRedirect: true,
  // Proxy all API calls through our own domain so the browser only ever resolves
  // vistaraweb.vercel.app — not *.up.railway.app, which some ISPs (e.g. Jio) fail to
  // resolve on mobile data. Vercel forwards these to Railway server-side.
  // The destination ALWAYS ends in "/" — the rewrite's :path* capture otherwise drops
  // the trailing slash, and Django's APPEND_SLASH then 301-loops through the proxy.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_PROXY_TARGET}/api/:path*/` }];
  },
};
// Only wrap with Sentry when a DSN is configured, so builds without Sentry env
// vars are completely unaffected. Set SENTRY_DSN + NEXT_PUBLIC_SENTRY_DSN (and
// optionally SENTRY_AUTH_TOKEN for source maps) in the environment to activate.
if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
  const { withSentryConfig } = require('@sentry/nextjs');
  module.exports = withSentryConfig(nextConfig, {
    silent: true,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
  });
} else {
  module.exports = nextConfig;
}
