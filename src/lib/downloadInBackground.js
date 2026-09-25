// Start a file download without touching the page.
//
// A link click to another origin is a navigation that happens to become a download,
// and Safari cancels the page's in-flight requests when it starts one — so the call
// made right after it (a reset, a delete) comes back "Load failed" and its real
// answer is lost. A hidden frame downloads on its own, leaving the page alone. It is
// also not a pop-up, so it works after an await, where window.open is blocked.
export function downloadInBackground(url) {
  const frame = document.createElement('iframe');
  frame.hidden = true;
  frame.src = url;
  document.body.appendChild(frame);
  // Long enough for the download to hand off to the browser, then tidy up.
  setTimeout(() => frame.remove(), 5 * 60 * 1000);
}
