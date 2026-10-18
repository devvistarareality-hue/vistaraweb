// A renewed investment's earlier terms for its LOI's Investment History — from the
// Ledger's own term figures (each finished term with how it ended), plus the term
// running now, which a revised LOI is re-issuing.
import { apiFetch } from '../utils/apiFetch';
import { CLUB1000_ENDPOINTS } from '../constants/api';

export async function earlierTerms(investorId) {
  try {
    const r = await apiFetch(CLUB1000_ENDPOINTS.investorLedger(investorId));
    const d = r.ok ? await r.json() : null;
    const terms = d?.terms || [];
    return { history: terms.filter((t) => !t.current), current: terms.find((t) => t.current) || null };
  } catch (_) {
    return { history: [], current: null };
  }
}
