'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

// App Router global error boundary: reports unhandled React render errors to
// Sentry (no-op until a DSN is configured) and shows a graceful branded fallback
// instead of Next.js's raw error screen.
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif', background: '#f4f5f7', color: '#1d1d1f' }}>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Something went wrong</div>
          <div style={{ fontSize: 14, color: '#55585e', marginBottom: 20, maxWidth: 420 }}>
            An unexpected error occurred. Please try again — if it keeps happening, contact your administrator.
          </div>
          <button
            onClick={() => reset()}
            style={{ padding: '10px 22px', background: '#1D1D1F', color: '#fff', border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
