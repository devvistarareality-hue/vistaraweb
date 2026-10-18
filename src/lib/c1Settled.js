// A payout closed by a renewal (not cash handed over on its own) carries a note like
// 'Settled to renewal R2' — older ones 'Added to renewal R1' / 'Settled at renewal R1'.
// Returns 'Settled to Renewal 2', or '' for an ordinary payment.
export function settledTo(notes) {
  const m = /^(?:Settled to|Settled at|Added to) renewal R(\d+)/i.exec(String(notes || ''));
  return m ? `Settled to Renewal ${m[1]}` : '';
}

// The remarks left after the renewal note (a UTR typed at the renewal).
export function settledRemark(notes) {
  return String(notes || '').replace(/^(?:Settled to|Settled at|Added to) renewal R\d+\s*(?:·\s*)?/i, '');
}
