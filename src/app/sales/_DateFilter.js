'use client';
import { useState, useEffect } from 'react';

// Self-contained date filter (Today/Week/Month/All + Year/Month/Quarter dropdowns)
// used by the dashboards. Calls onChange({ from, to }) whenever the range changes.
export default function DateFilter({ onChange }) {
  const toIST = (d) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const today = toIST(new Date());
  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return toIST(d); };

  const [dateFrom,        setDateFrom]        = useState('');
  const [dateTo,          setDateTo]          = useState('');
  const [selectedMonths,  setSelectedMonths]  = useState([]);
  const [showMonthDrop,   setShowMonthDrop]   = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState([]);
  const [showQuarterDrop, setShowQuarterDrop] = useState(false);
  const [selectedFyYear,  setSelectedFyYear]  = useState(null);
  const [showYearDrop,    setShowYearDrop]    = useState(false);

  const currentYear    = new Date().getFullYear();
  const currentFyStart = new Date().getMonth() >= 3 ? currentYear : currentYear - 1;
  const fyY            = selectedFyYear ?? currentFyStart;

  const makeQuarters = (fy) => [
    { key: 'Q1', label: 'Q1', sub: 'Apr – Jun', from: `${fy}-04-01`,   to: `${fy}-06-30` },
    { key: 'Q2', label: 'Q2', sub: 'Jul – Sep', from: `${fy}-07-01`,   to: `${fy}-09-30` },
    { key: 'Q3', label: 'Q3', sub: 'Oct – Dec', from: `${fy}-10-01`,   to: `${fy}-12-31` },
    { key: 'Q4', label: 'Q4', sub: 'Jan – Mar', from: `${fy+1}-01-01`, to: `${fy+1}-03-31` },
  ];
  const makeMonthOptions = (fy) => Array.from({ length: 12 }, (_, i) => {
    const mIdx = (i + 3) % 12;
    const y = i < 9 ? fy : fy + 1;
    return { key: `${y}-${String(mIdx + 1).padStart(2, '0')}`, label: new Date(y, mIdx, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) };
  });

  const QUARTERS     = makeQuarters(fyY);
  const monthOptions = makeMonthOptions(fyY);
  const FY_OPTIONS   = Array.from({ length: 4 }, (_, i) => currentFyStart - i).filter(y => y >= 2020).map(y => ({ key: y, label: `FY ${y}-${String(y + 1).slice(2)}` }));

  const effectiveDates = (() => {
    if (selectedQuarter.length > 0) {
      const qs = QUARTERS.filter(q => selectedQuarter.includes(q.key));
      const froms = qs.map(q => q.from).sort();
      const tos   = qs.map(q => q.to).sort();
      return { from: froms[0], to: tos[tos.length - 1] };
    }
    if (selectedMonths.length > 0) {
      const sorted = [...selectedMonths].sort();
      const [ey, em] = sorted[0].split('-').map(Number);
      const [ly, lm] = sorted[sorted.length - 1].split('-').map(Number);
      const from = `${ey}-${String(em).padStart(2,'0')}-01`;
      const lastDay = new Date(ly, lm, 0).getDate();
      const to = `${ly}-${String(lm).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
      return { from, to };
    }
    if (selectedFyYear !== null) return { from: `${fyY}-04-01`, to: `${fyY + 1}-03-31` };
    return { from: dateFrom, to: dateTo };
  })();

  useEffect(() => { onChange && onChange(effectiveDates); }, [effectiveDates.from, effectiveDates.to]);

  const fSel    = { height: 36, padding: '0 10px', borderRadius: 8, border: '1.5px solid #E8ECF4', fontSize: 12, background: '#F8FAFD', cursor: 'pointer', outline: 'none', color: '#1A1A2E', fontWeight: 500 };
  const qBtn    = (active) => ({ height: 36, padding: '0 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: active ? '#182350' : '#F0F2F8', color: active ? '#fff' : '#8492A6' });
  const divider = { width: 1, height: 24, background: '#E8ECF4', flexShrink: 0 };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 20, padding: '10px 16px', background: '#fff', borderRadius: 12, border: '1px solid #F0F3FA' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#B0BAD0', letterSpacing: 0.5, textTransform: 'uppercase', marginRight: 2 }}>Date</span>
      <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setSelectedMonths([]); setSelectedQuarter([]); setSelectedFyYear(null); }} style={{ ...fSel, width: 136 }} />
      <span style={{ fontSize: 12, color: '#C0C8D8' }}>→</span>
      <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setSelectedMonths([]); setSelectedQuarter([]); setSelectedFyYear(null); }} style={{ ...fSel, width: 136 }} />
      <div style={divider} />
      <button onClick={() => { setDateFrom(today); setDateTo(today); setSelectedMonths([]); setSelectedQuarter([]); setSelectedFyYear(null); }} style={qBtn(dateFrom === today && dateTo === today)}>Today</button>
      <button onClick={() => { setDateFrom(daysAgo(6)); setDateTo(today); setSelectedMonths([]); setSelectedQuarter([]); setSelectedFyYear(null); }} style={qBtn(dateFrom === daysAgo(6) && dateTo === today)}>Week</button>
      <button onClick={() => { setDateFrom(daysAgo(29)); setDateTo(today); setSelectedMonths([]); setSelectedQuarter([]); setSelectedFyYear(null); }} style={qBtn(dateFrom === daysAgo(29) && dateTo === today)}>Month</button>
      <div style={divider} />
      <button onClick={() => { setDateFrom(''); setDateTo(''); setSelectedMonths([]); setSelectedQuarter([]); setSelectedFyYear(null); }} style={qBtn(!dateFrom && !dateTo && !selectedMonths.length && !selectedQuarter.length && !selectedFyYear)}>All</button>
      <div style={divider} />
      {/* Year */}
      <div style={{ position: 'relative' }}>
        <button onClick={() => { setShowYearDrop(v => !v); setShowMonthDrop(false); setShowQuarterDrop(false); }} style={{ ...qBtn(selectedFyYear !== null), display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          {selectedFyYear !== null ? `FY ${selectedFyYear}-${String(selectedFyYear + 1).slice(2)}` : 'Year'}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        {showYearDrop && (
          <>
            <div onClick={() => setShowYearDrop(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
            <div style={{ position: 'absolute', left: 0, top: '110%', zIndex: 20, background: '#fff', borderRadius: 12, boxShadow: '0 8px 32px rgba(24,35,80,0.14)', border: '1px solid #F0F3FA', minWidth: 170, padding: '8px 0' }}>
              {selectedFyYear !== null && <button onClick={() => { setSelectedFyYear(null); setShowYearDrop(false); }} style={{ width: '100%', padding: '8px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#EF4444', cursor: 'pointer', borderBottom: '1px solid #F0F3FA', marginBottom: 4 }}>Clear</button>}
              {FY_OPTIONS.map(({ key, label }) => {
                const sel = selectedFyYear === key;
                return (
                  <button key={key} onClick={() => { setSelectedFyYear(sel ? null : key); setSelectedMonths([]); setSelectedQuarter([]); setDateFrom(''); setDateTo(''); setShowYearDrop(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', background: sel ? '#EFF6FF' : 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}>
                    <div style={{ width: 17, height: 17, borderRadius: '50%', border: `2px solid ${sel ? '#182350' : '#CBD5E1'}`, background: sel ? '#182350' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{sel && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />}</div>
                    <span style={{ fontSize: 13, fontWeight: sel ? 700 : 500, color: sel ? '#182350' : '#4B5563' }}>{label}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
      <div style={divider} />
      {/* Month */}
      <div style={{ position: 'relative' }}>
        <button onClick={() => { setShowMonthDrop(v => !v); setShowQuarterDrop(false); setShowYearDrop(false); }} style={{ ...qBtn(selectedMonths.length > 0), display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          {selectedMonths.length > 0 ? `${selectedMonths.length} Month${selectedMonths.length > 1 ? 's' : ''}` : 'Month Filter'}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        {showMonthDrop && (
          <>
            <div onClick={() => setShowMonthDrop(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
            <div style={{ position: 'absolute', left: 0, top: '110%', zIndex: 20, background: '#fff', borderRadius: 12, boxShadow: '0 8px 32px rgba(24,35,80,0.14)', border: '1px solid #F0F3FA', minWidth: 210, maxHeight: 300, overflowY: 'auto', padding: '8px 0' }}>
              {selectedMonths.length > 0 && <button onClick={() => setSelectedMonths([])} style={{ width: '100%', padding: '8px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#EF4444', cursor: 'pointer', borderBottom: '1px solid #F0F3FA', marginBottom: 4 }}>Clear All</button>}
              {monthOptions.map(({ key, label }) => {
                const sel = selectedMonths.includes(key);
                return (
                  <button key={key} onClick={() => { setSelectedQuarter([]); setSelectedFyYear(null); setDateFrom(''); setDateTo(''); setSelectedMonths(prev => sel ? prev.filter(m => m !== key) : [...prev, key]); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', background: sel ? '#EFF6FF' : 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}>
                    <div style={{ width: 17, height: 17, borderRadius: 4, border: `2px solid ${sel ? '#182350' : '#CBD5E1'}`, background: sel ? '#182350' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{sel && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}</div>
                    <span style={{ fontSize: 13, fontWeight: sel ? 700 : 500, color: sel ? '#182350' : '#4B5563' }}>{label}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
      <div style={divider} />
      {/* Quarter */}
      <div style={{ position: 'relative' }}>
        <button onClick={() => { setShowQuarterDrop(v => !v); setShowMonthDrop(false); setShowYearDrop(false); }} style={{ ...qBtn(selectedQuarter.length > 0), display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          {selectedQuarter.length > 0 ? `${selectedQuarter.length} Quarter${selectedQuarter.length > 1 ? 's' : ''}` : 'Quarter'}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        {showQuarterDrop && (
          <>
            <div onClick={() => setShowQuarterDrop(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
            <div style={{ position: 'absolute', left: 0, top: '110%', zIndex: 20, background: '#fff', borderRadius: 12, boxShadow: '0 8px 32px rgba(24,35,80,0.14)', border: '1px solid #F0F3FA', minWidth: 210, padding: '8px 0' }}>
              {selectedQuarter.length > 0 && <button onClick={() => setSelectedQuarter([])} style={{ width: '100%', padding: '8px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#EF4444', cursor: 'pointer', borderBottom: '1px solid #F0F3FA', marginBottom: 4 }}>Clear All</button>}
              {QUARTERS.map(({ key, label, sub }) => {
                const sel = selectedQuarter.includes(key);
                return (
                  <button key={key} onClick={() => { setSelectedQuarter(prev => sel ? prev.filter(k => k !== key) : [...prev, key]); setSelectedMonths([]); setSelectedFyYear(null); setDateFrom(''); setDateTo(''); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', background: sel ? '#EFF6FF' : 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}>
                    <div style={{ width: 17, height: 17, borderRadius: 4, border: `2px solid ${sel ? '#182350' : '#CBD5E1'}`, background: sel ? '#182350' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{sel && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}</div>
                    <span style={{ fontSize: 13, fontWeight: sel ? 700 : 500, color: sel ? '#182350' : '#4B5563' }}>{label}</span>
                    <span style={{ fontSize: 11, color: '#8492A6', marginLeft: 'auto' }}>{sub}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
