/**
 * Turning a failed API response into something a person can act on.
 *
 * The booking form used to say `Error: {}` — the literal output of
 * `JSON.stringify(await res.json().catch(() => ({})))` when the body was not
 * JSON. That is the worst possible message: it appears exactly when something
 * unexpected happened and tells you nothing about it, not even that the server
 * was unreachable rather than unhappy.
 *
 * DRF answers a rejected write in three shapes, and all three need handling:
 *   {"detail": "..."}                        one sentence, already readable
 *   {"plot": ["This field is required."]}    per-field, the common validation case
 *   ["Something went wrong."]                a bare list from a custom validator
 * Anything else — an HTML 502 from the proxy, an empty body, a gateway timeout —
 * falls back to what the status code actually means.
 */

// Field names as they read on the form, not as the serializer spells them.
const FIELD_LABELS = {
  client_name: 'Client name', phone: 'Phone', alt_phone: 'Alternate phone',
  land_rate: 'Land rate', area: 'Area', plot: 'Plot', project: 'Project',
  lead: 'Lead', closure: 'Closure', source: 'Source', cp_name: 'Channel partner',
  final_amount: 'Final amount', discount: 'Discount', installments: 'Installments',
  loi_file: 'Signed LOI', loi_document: 'Signed LOI', booking_date: 'Booking date',
  extra_terms: 'Extra terms', unit_type: 'Unit type', non_field_errors: '',
  detail: '',
};

// What a status code means here, when the body did not say.
const BY_STATUS = {
  400: 'The server rejected the details on this form but did not say which field. Check the amounts and dates, then try again.',
  401: 'Your session has expired. Sign in again and resubmit — nothing was saved.',
  403: 'You do not have permission to submit this. Ask an admin to check your role.',
  404: 'The lead, project or plot this points at no longer exists. Go back and reopen the closure.',
  409: 'Someone else changed this while you were filling it in. Reopen it and check before resubmitting.',
  413: 'The attached file is too large. Attach a smaller scan of the signed LOI.',
  429: 'Too many attempts in a short time. Wait a minute and try again.',
  500: 'The server hit an error handling this booking. Nothing was saved. Report it with the time and the client name.',
  502: 'Could not reach the server. Check your connection and try again — nothing was saved.',
  503: 'The server is temporarily unavailable. Try again in a minute — nothing was saved.',
  504: 'The server took too long to answer. Your booking may or may not have saved — check My Bookings before resubmitting.',
};

const label = (key) => (key in FIELD_LABELS
  ? FIELD_LABELS[key]
  : key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()));

function flatten(value) {
  if (value == null) return [];
  if (typeof value === 'string') return [value.trim()].filter(Boolean);
  if (Array.isArray(value)) return value.flatMap(flatten);
  if (typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => {
      const name = label(k);
      return flatten(v).map((m) => (name ? `${name}: ${m}` : m));
    });
  }
  return [String(value)];
}

/**
 * @param {Response|null} res  the fetch Response, for its status
 * @param {any} body           the parsed body, or {} / null when it would not parse
 * @param {string} [fallback]  what to say when nothing else fits
 * @returns {string} one or more sentences, never "{}"
 */
export function explainApiError(res, body, fallback = 'Something went wrong. Nothing was saved.') {
  const parts = flatten(body);
  if (parts.length) return parts.join('\n');

  const status = res?.status;
  if (status && BY_STATUS[status]) return BY_STATUS[status];
  if (status) return `The server refused this (HTTP ${status}) without saying why. Nothing was saved.`;
  return fallback;
}

/** A thrown fetch error — no response at all. */
export function explainNetworkError(err) {
  const raw = (err && err.message) || '';
  if (/abort|timeout/i.test(raw)) {
    return 'The request timed out. Check your connection — your booking may not have been saved.';
  }
  return 'Could not reach the server. Check your internet connection and try again — nothing was saved.';
}
