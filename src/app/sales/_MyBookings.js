'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { SALES_ENDPOINTS, loiHref } from '../../constants/api';

function authHeaders() {
  const t = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` };
}
const rupee = (n) => '₹ ' + Math.round(Number(n) || 0).toLocaleString('en-IN');

// Open the confidential LOI via a short-lived signed URL (never a public link).
async function openLoi(id) {
  try {
    const r = await fetch(SALES_ENDPOINTS.bookingLoiUrl(id), { headers: authHeaders() });
    const d = await r.json();
    if (r.ok && d.url) window.open(d.url, '_blank', 'noopener,noreferrer');
    else alert('Could not open the LOI.');
  } catch { alert('Could not open the LOI.'); }
}

// "My Bookings" — the bookings the logged-in user submitted, grouped project → plot,
// with a Revise LOI action. Rendered inside the Booking page under a toggle.
export function MyBookingsList() {
  const router = useRouter();
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(SALES_ENDPOINTS.bookings + '?mine=1' + (companyId ? `&company_id=${companyId}` : ''), { headers: authHeaders() })
      .then((r) => r.json()).then((d) => { setRows(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [companyId]);

  const groups = {};
  rows.forEach((b) => { const k = b.project_name || '—'; (groups[k] = groups[k] || []).push(b); });
  const projectNames = Object.keys(groups).sort();
  projectNames.forEach((pn) => groups[pn].sort((a, b) => String(a.plot_number || a.area).localeCompare(String(b.plot_number || b.area))));

  return (
    <>
      <p style={{ fontSize: 13, color: '#8492A6', marginBottom: 18 }}>{rows.length} booking{rows.length === 1 ? '' : 's'} you submitted · revise the LOI anytime</p>

      {loading ? <p style={{ color: '#8492A6' }}>Loading…</p> : projectNames.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: 40, textAlign: 'center', color: '#8492A6', boxShadow: '0 2px 8px rgba(184,196,214,0.18)' }}>You haven&apos;t booked any units yet.</div>
      ) : projectNames.map((pn) => (
        <div key={pn} style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#3D5AFE', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
            🏢 {pn} <span style={{ color: '#8492A6', fontWeight: 600 }}>· {groups[pn].length} unit{groups[pn].length === 1 ? '' : 's'}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {groups[pn].map((b) => (
              <div key={b.id} style={{ background: '#fff', borderRadius: 14, padding: '14px 18px', boxShadow: '0 2px 8px rgba(184,196,214,0.18)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E' }}>
                      Plot {b.plot_number || b.area} <span style={{ color: '#8492A6', fontWeight: 600 }}>· {b.client_name || '—'}</span>
                      {b.revision_no > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: '#B45309', background: '#FEF3C7', padding: '2px 6px', borderRadius: 20, marginLeft: 6 }}>R{b.revision_no}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#8492A6', marginTop: 3 }}>{b.phone} · Booked {b.booking_date || '—'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#0D47A1' }}>{rupee(b.final_amount)}</div>
                    <span style={statusPill(b.status)}>{(b.approval_status || b.status || '').toUpperCase()}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                  {b.loi_document && <button onClick={() => openLoi(b.id)} style={{ ...linkBtn, background: '#fff', cursor: 'pointer' }}>📄 Signed LOI</button>}
                  {b.status === 'sold' && (
                    <button onClick={() => router.push(`/sales/booking?revise=${b.id}`)} style={{ ...actBtn, background: '#7C3AED' }}>↻ Revise LOI</button>
                  )}
                  {b.status === 'pending' && <span style={{ fontSize: 12, color: '#B45309', alignSelf: 'center' }}>Awaiting approval</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function statusPill(s) {
  const map = { pending: ['#B45309', '#FEF3C7'], sold: ['#15803D', '#E8F5E9'], rejected: ['#DC2626', '#FEE2E2'], hold: ['#B45309', '#FEF3C7'] };
  const [c, bg] = map[s] || ['#6B7280', '#F3F4F6'];
  return { display: 'inline-block', marginTop: 4, fontSize: 10, fontWeight: 800, color: c, background: bg, padding: '3px 9px', borderRadius: 20 };
}
const actBtn = { padding: '8px 16px', borderRadius: 8, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const linkBtn = { padding: '8px 14px', borderRadius: 8, border: '1.5px solid #C7D2FE', color: '#3D5AFE', fontSize: 13, fontWeight: 700, textDecoration: 'none' };
