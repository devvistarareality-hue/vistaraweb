// Open a file whose URL has to be fetched first (a short-lived signed URL).
//
// The catch: a pop-up opened AFTER an await is no longer tied to the click that
// started it, and browsers block it. So a button that fetched the URL and then
// called window.open did nothing at all — no tab, no error, nothing to see. The
// tab has to be opened synchronously with the click and pointed at the URL once
// it arrives.
//
// If even that is blocked (pop-ups off entirely), it falls back to downloading
// in a hidden frame — see downloadInBackground, which works after an await
// precisely because it is not a pop-up.
import { downloadInBackground } from './downloadInBackground';

export function openPendingUrl() {
  // Called synchronously from the click handler.
  let win = null;
  try {
    win = window.open('', '_blank');
  } catch (_) {
    win = null;
  }
  return {
    // The URL arrived: send the tab there.
    show(url) {
      if (win) {
        // Opened without rel=noopener, so sever the link by hand.
        try { win.opener = null; } catch (_) { /* cross-origin already */ }
        win.location.replace(url);
      } else {
        downloadInBackground(url);
      }
    },
    // It did not: close the blank tab rather than leaving one sitting there.
    cancel() {
      if (win) {
        try { win.close(); } catch (_) { /* already gone */ }
      }
    },
  };
}
