// How much of a payout is interest / principal. An at-maturity payout pays the
// principal and the term's interest in one go (maturity_split), so under
// "Interest" it counts its interest part and under "Principal" its principal part.
// kind: 'both' | 'interest' | 'principal'; field: 'amount_due' or 'paid_amount'.
export function payoutPart(p, kind = 'both', field = 'amount_due') {
  const full = Number(p?.[field] ?? p?.amount_due) || 0;
  if (kind === 'both') return full;
  const ms = p?.maturity_split;
  if (ms) {
    const due = Number(p.amount_due) || 0;
    const part = Number(kind === 'interest' ? ms.interest : ms.principal) || 0;
    return due ? full * (part / due) : 0;
  }
  return (kind === 'interest') === (p?.payout_type === 'interest') ? full : 0;
}

// Does this payout carry any of the kind asked for?
export const hasPart = (p, kind) => kind === 'both' || payoutPart(p, kind) > 0;
