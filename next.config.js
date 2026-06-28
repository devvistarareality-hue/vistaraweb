/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Allow next/image to optimize Supabase-hosted assets (project covers, plans, etc.)
    remotePatterns: [
      { protocol: 'https', hostname: 'lftvumbhogcixihjydwx.supabase.co' },
    ],
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
