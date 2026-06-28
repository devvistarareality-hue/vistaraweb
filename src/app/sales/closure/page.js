'use client';
import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { SALES_ENDPOINTS, authHeaders } from '../../../constants/api';
import { getCache, setCache } from '../_cache';
import { MyBookingsList } from '../_MyBookings';


// Read-only project picker for the Record Closure flow. Looks like the admin
// Projects grid (screenshot) but with no Add/Edit/Deactivate/Manage-Plots — the
// STM only selects a project to drill into its unit map.
export default function ClosureProjectsPage() {
  const router    = useRouter();
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const cKey      = `projects_${companyId || 'all'}`;
  const cq        = companyId ? `?company_id=${companyId}` : '';

  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [sv,       setSv]       = useState(null);
  const [view,     setView]     = useState('closures'); // 'closures' | 'mybookings'

  // Reached via "Record Closure" → has ?sv=<id> and a stashed site visit.
  // Reached via the "Booking" nav → no ?sv=, so browse projects/units only
  // (clear any stale closure context so the viewer doesn't record against it).
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    if (qs.has('sv')) {
      try { setSv(JSON.parse(sessionStorage.getItem('closure_sv') || 'null')); } catch (_) {}
    } else {
      try { sessionStorage.removeItem('closure_sv'); } catch (_) {}
      setSv(null);
    }
    // Deep-linked from a booking-approved/rejected notification → open My Bookings.
    if (qs.get('view') === 'mybookings') setView('mybookings');
  }, []);

  useEffect(() => {
    const cached = getCache(cKey);
    if (cached) { setProjects(cached); setLoading(false); return; }
    fetch(SALES_ENDPOINTS.projects + cq, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { const list = Array.isArray(d) ? d : []; setCache(cKey, list); setProjects(list); setLoading(false); })
      .catch(() => setLoading(false));
  }, [companyId]);

  // Only active projects are bookable.
  const visible = projects.filter(p => p.is_active);

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <button onClick={() => router.push('/sales/site-visits')} style={backBtn}>← Back</button>
      </div>
      {/* Toggle: Record Closure ↔ My Bookings */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        {[['closures', 'Record Closure'], ['mybookings', 'My Bookings']].map(([k, label]) => (
          <button key={k} onClick={() => setView(k)} style={{ padding: '8px 18px', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: view === k ? '#3D5AFE' : '#EEF1F7', color: view === k ? '#fff' : '#8492A6' }}>{label}</button>
        ))}
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>{view === 'mybookings' ? 'My Bookings' : 'Record Closure — Select Project'}</h1>
      {view === 'closures' && (
        <p style={{ fontSize: 13, color: '#8492A6', marginBottom: 22 }}>
          {sv ? <>For <strong style={{ color: '#3D5AFE' }}>{sv.lead_name}</strong> · {sv.lead_phone}. Pick the project, then choose the booked unit.</>
              : <>Pick a project to view its units.</>}
        </p>
      )}

      {view === 'mybookings' ? <MyBookingsList /> : (
        loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px,1fr))', gap: 24 }}>
          {[...Array(4)].map((_, i) => <div key={i} className="s-skel" style={{ height: 200, borderRadius: 18, background: '#EEF1F7' }} />)}
        </div>
      ) : !visible.length ? (
        <p style={{ textAlign: 'center', color: '#8492A6', padding: '60px 0' }}>No active projects available.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px,1fr))', gap: 24 }}>
          {visible.map(p => {
            const pc = p.plot_counts || {};
            const total = pc.total || 0;
            const sold = pc.sold || 0;
            const pct = total ? Math.round(sold / total * 100) : 0;
            return (
              <div key={p.id} onClick={() => router.push(`/sales/closure/${p.id}`)}
                style={{ ...card, cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 36px rgba(100,120,160,0.24)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = card.boxShadow; }}>
                <div style={{ position: 'relative', background: '#F2F4F8', height: 180, overflow: 'hidden' }}>
                  {p.cover_image_url ? (
                    <img src={p.cover_image_url} alt={p.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }} />
                  ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#C0C8D8" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                      <span style={{ fontSize: 12, color: '#C0C8D8' }}>No cover image</span>
                    </div>
                  )}
                  <div style={{ position: 'absolute', top: 10, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 9px', borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.92)', color: '#8492A6', textTransform: 'capitalize', backdropFilter: 'blur(4px)' }}>
                      {p.project_type}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 20, backgroundColor: '#E8F5E9', color: '#2E7D32', boxShadow: '0 1px 6px rgba(0,0,0,0.10)' }}>
                      ACTIVE
                    </span>
                  </div>
                </div>

                <div style={{ padding: '14px 16px 16px' }}>
                  <p style={{ fontSize: 16, fontWeight: 800, color: '#1A1A2E', marginBottom: 2 }}>{p.name}</p>
                  {p.location && <p style={{ fontSize: 12, color: '#8492A6', marginBottom: 6 }}>📍 {p.location}</p>}
                  {p.tagline && <p style={{ fontSize: 11, color: '#A0AABA', fontStyle: 'italic', marginBottom: 6 }}>{p.tagline}</p>}

                  {(p.total_area || p.price_range || p.possession) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                      {p.total_area   && <span style={metaChip}>{p.total_area}</span>}
                      {p.price_range  && <span style={metaChip}>{p.price_range}</span>}
                      {p.possession   && <span style={metaChip}>📅 {p.possession}</span>}
                    </div>
                  )}

                  {total > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8492A6', marginBottom: 5 }}>
                        <span style={{ fontWeight: 600 }}>{total} plots</span>
                        <span style={{ display: 'flex', gap: 10 }}>
                          <span style={{ color: '#2E7D32', fontWeight: 600 }}>✓ {pc.available}</span>
                          <span style={{ color: '#E65100', fontWeight: 600 }}>⏸ {pc.hold}</span>
                          <span style={{ color: '#EF4444', fontWeight: 600 }}>✕ {pc.sold}</span>
                        </span>
                      </div>
                      <div style={{ height: 4, borderRadius: 4, background: '#EEF1F7', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#3D5AFE,#E91E63)', borderRadius: 4 }} />
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: 4, padding: '8px 12px', borderRadius: 10, background: '#F0F3FF', border: '1.5px solid #3D5AFE30', fontSize: 12, fontWeight: 700, color: '#3D5AFE', textAlign: 'center' }}>
                    View units →
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

const card     = { backgroundColor: '#fff', borderRadius: 18, boxShadow: '0 6px 28px rgba(100,120,160,0.16)', border: '1.5px solid #DDE3EE', overflow: 'hidden', transition: 'transform 0.15s, box-shadow 0.15s' };
const metaChip = { fontSize: 11, fontWeight: 600, color: '#6B7A90', backgroundColor: '#F0F3F8', padding: '3px 8px', borderRadius: 6 };
const backBtn  = { padding: '7px 14px', backgroundColor: '#F0F3FA', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, color: '#5C6BC0', cursor: 'pointer' };
