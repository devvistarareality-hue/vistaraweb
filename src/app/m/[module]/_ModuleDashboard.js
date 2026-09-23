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
  const [rows, setRows] = useState(isAccounts ? null : []);

  useEffect(() => {
    if (!isAccounts) return;
    const q = companyId ? `?company_id=${companyId}` : '';
    apiFetch(SALES_ENDPOINTS.bookingsAll + q)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setRows(Array.isArray(d) ? d : (d?.results || [])))
      .catch(() => setRows([]));
  }, [isAccounts, companyId]);

  const kpis = useMemo(() => {
    const list = rows || [];
    const at = (s) => list.filter((b) => (b.accounts_status || b.status || '').toLowerCase() === s).length;
    return [
      { key: 'pending', icon: ClipboardCheck, label: 'Waiting for sign-off', value: at('pending'),
        sub: 'Bookings at the Accounts gate', href: `/m/${slug}/approvals` },
      { key: 'approved', icon: BookCheck, label: 'Approved', value: at('approved'),
        sub: 'Signed off by Accounts', href: `/m/${slug}/bookings` },
      { key: 'rejected', icon: CircleSlash, label: 'Sent back', value: at('rejected'),
        sub: 'Returned to Sales with remarks', href: `/m/${slug}/approvals` },
      { key: 'total', icon: Clock3, label: 'Bookings on the books', value: list.length,
        sub: 'Every booking this company has', href: `/m/${slug}/bookings` },
    ];
  }, [rows, slug]);

  return (
    <div className="nx-page">
      <div className="md-head">
        <div>
          <h1 className="nx-page-title">{meta.name}</h1>
          <p className="nx-page-sub">{meta.desc}</p>
        </div>
      </div>

      {rows === null ? <Loader label="Adding it up…" /> : (
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
