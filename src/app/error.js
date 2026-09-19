'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

// Route-level error boundary. global-error.js only catches errors that escape the
// root layout, which means a render error inside a page replaced the whole app —
// sidebar and all. This keeps the surrounding layout and offers a retry, so one
// bad row of data no longer costs the whole session.
export default function RouteError({ error, reset }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);

  return (
    <div className="nx-page nx-page-center nx-w-sm">
      <div className="nx-card nx-error-card">
        <div className="nx-error-title">This page hit an error</div>
        <p className="nx-error-text">
          Nothing was lost — the rest of the app is still running. Try again, and if it
          keeps happening tell your administrator what you were doing.
        </p>
        {error?.digest && <p className="nx-error-ref">Reference: {error.digest}</p>}
        <div className="nx-actions">
          <button className="nx-btn nx-btn-md nx-btn-primary" onClick={() => reset()}>Try again</button>
          <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={() => window.location.reload()}>Reload page</button>
        </div>
      </div>
    </div>
  );
}
