'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import Link from 'next/link';
import { ClipboardCheck, BookCheck, CircleSlash, Clock3, ArrowRight } from 'lucide-react';
import { SALES_ENDPOINTS } from '../../../constants/api';
import { apiFetch } from '../../../utils/apiFetch';
import Loader from '../../../components/Loader';
import { MODULE_META } from './moduleMeta';

// The dashboard every module opens on. Accounts & Finance reads its own figures
// — what is waiting for sign-off, what has been approved, what was cancelled;
// the modules whose own numbers are not wired yet show the same layout with
// nothing in it, so the tab looks and sits the same everywhere.
//
// Whatever role's dashboard you are looking at, the figures are the ones the
// signed-in person may see: the backend scopes every list by role and the
// reporting tree.
export default function ModuleDashboard({ slug }) {
  const meta = MODULE_META[slug] || { name: slug, desc: '' };
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const isAccounts = slug === 'accounts';
  const [counts, setCounts] = useState(isAccounts ? null : {});

  useEffect(() => {
    if (!isAccounts) return;
    // Counted on the server, so the tiles are not limited by how many bookings
    // the list endpoint will hand back.
    const q = `?counts_only=true${companyId ? `&company_id=${companyId}` : ''}`;
    apiFetch(SALES_ENDPOINTS.bookingsAll + q)
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => setCounts(d && typeof d === 'object' ? d : {}))
      .catch(() => setCounts({}));
  }, [isAccounts, companyId]);

  // Only a deal Sales or Channel Partner has already approved reaches the
  // Accounts gate, so every figure here counts those and nothing else — which is
  // what makes Approved equal the Sales and Channel Partner dashboards' closures
  // added together.
  const kpis = useMemo(() => {
    const n = counts || {};
    return [
      { key: 'pending', icon: ClipboardCheck, label: 'Waiting for sign-off', value: n.pending || 0,
        sub: 'Bookings at the Accounts gate', href: `/m/${slug}/approvals` },
      { key: 'approved', icon: BookCheck, label: 'Approved', value: n.approved || 0,
        sub: 'Signed off by Accounts', href: `/m/${slug}/bookings` },
      { key: 'rejected', icon: CircleSlash, label: 'Sent back', value: n.rejected || 0,
        sub: 'Returned to Sales with remarks', href: `/m/${slug}/approvals` },
      { key: 'total', icon: Clock3, label: 'Deals on the books', value: n.total || 0,
        sub: 'Approved by Sales or Channel Partner', href: `/m/${slug}/bookings` },
    ];
  }, [counts, slug]);

  return (
    <div className="nx-page">
      <div className="md-head">
        <div>
          <h1 className="nx-page-title">{meta.name}</h1>
          <p className="nx-page-sub">{meta.desc}</p>
        </div>
      </div>

      {counts === null ? <Loader label="Adding it up…" /> : (
        <>
          <div className="md-kpis">
            {kpis.map((k) => (
              <Link key={k.key} href={k.href} className="nx-card md-kpi">
                <span className="md-kpi-icon"><k.icon size={18} /></span>
                <span className="md-kpi-label">{k.label}</span>
                <b className="md-kpi-value">{isAccounts ? k.value : '—'}</b>
                <span className="md-kpi-sub">{k.sub}</span>
                <ArrowRight size={14} className="md-kpi-go" />
              </Link>
            ))}
          </div>

          <section className="nx-card md-panel">
            <h2>What this module does</h2>
            <p>{meta.desc || 'Its tabs are in the menu on the left.'}</p>
            {!isAccounts && (
              <p className="md-muted">Its own figures are not wired up yet — the tabs in the menu are.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
