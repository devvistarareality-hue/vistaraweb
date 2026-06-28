// Client-side Sentry — no-op until NEXT_PUBLIC_SENTRY_DSN is set (loaded by the
// withSentryConfig wrap in next.config.js, which only activates with a DSN).
import * as Sentry from '@sentry/nextjs';

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    replaysOnErrorSampleRate: 0,
    replaysSessionSampleRate: 0,
  });
}
