'use client';
import { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useParams, useRouter } from 'next/navigation';
import { SALES_ENDPOINTS, authHeaders } from '../../../../constants/api';
import { stripPlotPrefix } from '../../../../lib/plotNumber';
import { isManagerRole } from '../../../../lib/moduleAccess';


const isPdfUrl   = (u) => !!u && u.split('?')[0].toLowerCase().endsWith('.pdf');
const isImageUrl = (u) => !!u && /\.(png|jpe?g|webp|gif|svg)$/i.test(u.split('?')[0]);

// Status config keyed to vistaraweb plot statuses. Only "available" is selectable
// for a closure (Sold/Hold are shown for context but not clickable).
// Stored as 'road' / 'garden'; shown in full wherever a unit is surfaced.
const FACING_LABEL = { road: 'Road Facing', garden: 'Garden Facing' };

const STATUS = {
  available: { label: 'Available', dot: '#22c55e', text: '#064E3B', bg: '#E8F5E9' },
  // Covers two different things under one status: a soft pick that auto-expires
  // in 10 minutes (someone just tapped it), and a hard hold backed by an actual
  // pending-approval booking. "Hold" read as a deliberate pause either way and
  // confused people about which one they were looking at — "In Progress" reads
  // correctly for both ("something is actively happening with this unit").
  hold:      { label: 'In Progress', dot: '#94A3B8', text: '#334155', bg: '#F1F5F9' },
  sold:      { label: 'Sold',      dot: '#ef4444', text: '#7F1D1D', bg: '#FEE2E2' },
  // A previously-sold unit put back on the market — bookable exactly like
  // Available, just purple instead of green so it reads as "resold", not new.
  resale:    { label: 'Resale',    dot: '#a78bfa', text: '#4C1D95', bg: '#F3E8FF' },
  // A unit with a saved (unsubmitted) draft — same underlying plot.status='hold' as a
  // bare in-progress selection, but shown grey and distinct so the team can tell "someone
  // is mid-paperwork on this" from "someone just clicked it a second ago".
  drafted:   { label: 'Drafted',   dot: '#9CA3AF', text: '#374151', bg: '#F3F4F6' },
};
// Visual state for a plot, folding in the drafted override — everywhere the map colours
// a unit should go through this instead of indexing STATUS[plot.status] directly.
const plotCfg = (plot) => (plot.drafted_booking_id ? STATUS.drafted : (STATUS[plot.status] || STATUS.available));

// Visual centre of a zone. Uses the polygon's area centroid (shoelace), not the average
// of its vertices — unit outlines are notched, and a vertex average drifts toward
// wherever points cluster, which floated labels above their unit. Falls back to the
// bounding box for degenerate (zero-area) shapes.
function zoneCenter(zone) {
  const pts = zone.points || [];
  if (pts.length) {
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const bbox = { cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2 };
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[i], p1 = pts[(i + 1) % pts.length];
      const cross = p0.x * p1.y - p1.x * p0.y;
      a += cross; cx += (p0.x + p1.x) * cross; cy += (p0.y + p1.y) * cross;
    }
    a *= 0.5;
    if (Math.abs(a) < 1e-9) return bbox;
    return { cx: cx / (6 * a), cy: cy / (6 * a) };
  }
  return { cx: (zone.x || 0) + (zone.width || zone.w || 0) / 2, cy: (zone.y || 0) + (zone.height || zone.h || 0) / 2 };
}

function zoneTopCenter(zone) {
  if (zone.points?.length) {
    const xs = zone.points.map(p => p.x), ys = zone.points.map(p => p.y);
    return { tx: (Math.min(...xs) + Math.max(...xs)) / 2, ty: Math.min(...ys) };
  }
  return { tx: zone.x + zone.width / 2, ty: zone.y };
}

// Type badge colours (mirrors the CP portal hover tooltip).
const TYPE_COLORS = {
  Ananda:  { bg: 'rgba(139,92,246,0.18)', color: '#c4b5fd', border: 'rgba(139,92,246,0.5)' },
  Maitri:  { bg: 'rgba(37,99,235,0.18)',  color: '#93c5fd', border: 'rgba(37,99,235,0.5)'  },
  Karuna:  { bg: 'rgba(217,119,6,0.18)',  color: '#fcd34d', border: 'rgba(217,119,6,0.5)'  },
  Hridaya: { bg: 'rgba(5,150,105,0.18)',  color: '#6ee7b7', border: 'rgba(5,150,105,0.5)'  },
};

export function ClosureViewerContent({ backHref = '/sales/closure' }) {
  const { id }  = useParams();
  const router  = useRouter();
  const user    = useSelector((s) => s.auth.user);
  const isManager = user?.role === 'Admin' || isManagerRole(user) || user?.is_staff;

  const [project, setProject] = useState(null);
  const [plots,   setPlots]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [sv,      setSv]      = useState(null);
  const [selectedIds, setSelectedIds] = useState([]); // multi-select: plot ids to book together
  const [hovered,  setHovered]  = useState(null);  // hovered zone id
  const [draftPanelPlot, setDraftPanelPlot] = useState(null); // drafted unit clicked into
  const [soldPanelPlot, setSoldPanelPlot] = useState(null); // sold unit clicked into (Manager+ only) — offers Move to Resale
  const [resaleBusy, setResaleBusy] = useState(false);
  const [filter,     setFilter]     = useState('all'); // all | available | hold | sold
  const [typeFilter, setTypeFilter] = useState('all'); // all | <cluster_type>
  const [sources,    setSources]    = useState([]);
  const [notice,     setNotice]     = useState(''); // transient banner (unit taken / hold expired)
  const [busyIds,    setBusyIds]    = useState(() => new Set()); // plot ids with an in-flight hold/release call
  const [blockDropdownOpen, setBlockDropdownOpen] = useState(false);

  function flash(text) {
    setNotice(text);
    setTimeout(() => setNotice((n) => (n === text ? '' : n)), 4500);
  }

  useEffect(() => {
    try { setSv(JSON.parse(sessionStorage.getItem('closure_sv') || 'null')); } catch (_) {}
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(SALES_ENDPOINTS.project(id), { headers: authHeaders() }).then(r => r.json()).catch(() => null),
      fetch(`${SALES_ENDPOINTS.plots}?project=${id}`, { headers: authHeaders() }).then(r => r.json()).catch(() => []),
      fetch(SALES_ENDPOINTS.sources, { headers: authHeaders() }).then(r => r.json()).catch(() => []),
    ]).then(([p, pl, src]) => {
      setProject(p);
      setPlots(Array.isArray(pl) ? pl : (pl?.results ?? []));
      setSources(Array.isArray(src) ? src : (src?.results ?? []));
      setLoading(false);
    });
  }, [id]);

  // Other reps hold/release units live — poll so this rep sees a unit turn orange
  // (or free up again) without a manual refresh. Same interval as the notification bell.
  useEffect(() => {
    const poll = setInterval(() => {
      fetch(`${SALES_ENDPOINTS.plots}?project=${id}`, { headers: authHeaders() })
        .then((r) => r.json()).then((pl) => {
          const fresh = Array.isArray(pl) ? pl : (pl?.results ?? []);
          setPlots(fresh);
          // If a unit this rep had selected is no longer their own hold (it expired
          // and someone else grabbed it, or an admin cleared it), drop it and say so.
          const freshById = new Map(fresh.map((p) => [p.id, p]));
          setSelectedIds((ids) => ids.filter((pid) => {
            const fp = freshById.get(pid);
            // Not 'hold' at all → definitely no longer mine. Still 'hold' but held by
            // someone whose name doesn't match ours → expired and re-grabbed underneath us.
            const stillMine = !!fp && fp.status === 'hold' && (!user?.name || fp.held_by_name === user.name);
            if (!stillMine && fp) flash(`Your hold on Plot ${fp.number} expired or was released — please reselect.`);
            return stillMine;
          }));
        }).catch(() => {});
    }, 30_000);
    return () => clearInterval(poll);
  }, [id, user]);

  // A tower is browsed one floor at a time: each floor has its own plan and its own
  // zones, so the map, the unit list and the counts are all scoped to the chosen floor.
  const floorWise = !!project?.floor_wise;
  const allFloors = useMemo(() => (project?.floor_plans || []), [project]);
  // A tower may be one block or several (A, B, C…), each with its own floor count —
  // so pick the block first, then the floor within it.
  const blocks = useMemo(() => {
    const seen = [];
    allFloors.forEach(f => { const b = f.block || ''; if (!seen.includes(b)) seen.push(b); });
    return seen.length ? seen : [''];
  }, [allFloors]);
  // A block's height is quoted the way the trade quotes it — "G+12", ground plus the
  // floors above it — not as a raw floor count. A block with no ground floor falls
  // back to counting.
  const blockHeight = (b) => {
    const fs = allFloors.filter(f => (f.block || '') === b);
    const upper = fs.filter(f => Number(f.floor) > 0).length;
    return fs.some(f => Number(f.floor) === 0)
      ? `G+${upper}`
      : `${fs.length} floor${fs.length === 1 ? '' : 's'}`;
  };
  // Multiple blocks can be viewed side by side on the same floor (e.g. Block A's
  // and Block B's 1st floor both up at once) — an STM picks a unit from whichever
  // block it's actually in instead of switching back and forth. Defaults to just
  // the first block, same as the old single-select behaviour; at least one stays
  // selected always (there's nothing useful to show with zero).
  const [selectedBlocks, setSelectedBlocks] = useState(() => new Set());
  useEffect(() => {
    if (blocks.length && selectedBlocks.size === 0) setSelectedBlocks(new Set([blocks[0]]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);
  function toggleBlock(b) {
    setSelectedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(b)) { if (next.size > 1) next.delete(b); }
      else next.add(b);
      return next;
    });
  }
  // Floor options are the union across every selected block — blocks can differ
  // in height, so this is whichever floor numbers exist among the blocks
  // currently checked, not any one block's own list.
  const floorOptions = useMemo(() => {
    const relevant = allFloors.filter(f => selectedBlocks.has(f.block || ''));
    const byNum = new Map();
    relevant.forEach(f => { const n = Number(f.floor) || 0; if (!byNum.has(n)) byNum.set(n, f); });
    return [...byNum.values()].sort((a, b) => (Number(a.floor) || 0) - (Number(b.floor) || 0));
  }, [allFloors, selectedBlocks]);
  const [selectedFloorNum, setSelectedFloorNum] = useState(0);
  // Open on the ground floor — that's where a walk-in starts. Only resets when
  // the currently-picked floor doesn't exist for any newly-selected block;
  // otherwise toggling a block on/off keeps you where you were.
  useEffect(() => {
    if (!floorWise || !floorOptions.length) return;
    if (floorOptions.some(f => Number(f.floor) === selectedFloorNum)) return;
    const g = floorOptions.find(f => Number(f.floor) === 0);
    setSelectedFloorNum(g ? 0 : (Number(floorOptions[0].floor) || 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorWise, floorOptions]);
  // One floor_plans entry per selected block that actually has this floor number
  // (a shorter block may not) — each becomes its own map/fallback card below.
  const activeEntries = useMemo(() => {
    if (!floorWise) return [];
    return blocks
      .filter((b) => selectedBlocks.has(b))
      .map((b) => allFloors.find((f) => (f.block || '') === b && Number(f.floor) === selectedFloorNum))
      .filter(Boolean);
  }, [allFloors, blocks, selectedBlocks, selectedFloorNum, floorWise]);

  // Units belonging to the chosen floor — by the floor field, falling back to the
  // floor's own numbering run for units created before that field existed.
  const onFloor = (p, f) => {
    if (!f) return true;
    // Both blocks have a floor 1, so the floor number alone is not enough — units
    // carry their block as a prefix ("A-101"), which is what separates them.
    const bp = f.block ? `${f.block}-` : '';
    if (bp && !String(p.number || '').startsWith(bp)) return false;
    if (p.floor !== null && p.floor !== undefined) return Number(p.floor) === Number(f.floor);
    const from = parseInt(f.from, 10), to = parseInt(f.to, 10);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return false;
    const n = String(p.number);
    for (let i = from; i <= to; i++) if (`${f.prefix || ''}${i}` === n) return true;
    return false;
  };
  const visiblePlots = useMemo(() => {
    if (!floorWise) return plots;
    if (!activeEntries.length) return [];
    return plots.filter((p) => activeEntries.some((f) => onFloor(p, f)));
  }, [plots, floorWise, activeEntries]);

  // A plotted (non-floorwise) scheme has one project-wide map. A tower instead
  // shows one map card per selected block that has a plan drawn for this floor —
  // any selected block without one falls into the shared fallback grid below.
  const mapEntries = floorWise
    ? activeEntries.filter((f) => !!f.image_url && (f.zones || []).length > 0)
    : ((project?.site_map_image_url || isImageUrl(project?.master_plan_url))
        ? [{ block: '', floor: null, label: null, image_url: project?.site_map_image_url || project?.master_plan_url, zones: project?.site_map_zones || [] }]
        : []);
  const noMapEntries = floorWise ? activeEntries.filter((f) => !(f.image_url && (f.zones || []).length > 0)) : [];
  const noMapPlots = floorWise
    ? (mapEntries.length ? plots.filter((p) => noMapEntries.some((f) => onFloor(p, f))) : visiblePlots)
    : visiblePlots;

  // The floor row is only meaningful when a floor is actually selected — a plotted
  // scheme has none, so it shows the project row alone.
  const floorRowLabel = floorWise && activeEntries.length
    ? `${activeEntries.map((f) => f.block).filter(Boolean).join(' + ') ? `Block ${activeEntries.map((f) => f.block).filter(Boolean).join(' + ')} · ` : ''}${activeEntries[0].label || `Floor ${activeEntries[0].floor}`}`
    : null;

  // One row of stat cards over whatever set of units it is handed, so the floor row and
  // the project row are counted and shown identically.
  const statRow = (title, list) => {
    if (!title) return null;
    const c = { available: 0, hold: 0, sold: 0 };
    list.forEach(p => { if (c[p.status] != null) c[p.status]++; });
    const t = list.length;
    const share = (n) => (t ? Math.round(n / t * 100) : 0);
    const card = { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderRadius: 14, background: '#fff', border: '1px solid #E6EBF4', boxShadow: '0 2px 8px rgba(184,196,214,0.12)' };
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#8492A6', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 7 }}>{title}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <div style={card}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: '#EEF1FF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#3D5AFE', fontSize: 17, fontWeight: 900 }}>▦</span>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#1A1A2E', lineHeight: 1 }}>{t}</div>
              <div style={{ fontSize: 12, color: '#8492A6', marginTop: 3 }}>Total Units</div>
            </div>
          </div>
          {[['available', c.available], ['hold', c.hold], ['sold', c.sold]].map(([key, n]) => {
            const cfg = STATUS[key];
            return (
              <div key={key} style={card}>
                <span style={{ width: 36, height: 36, borderRadius: 10, background: cfg.bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: cfg.dot, fontSize: 18, fontWeight: 900 }}>•</span>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#1A1A2E', lineHeight: 1 }}>{n}</div>
                  <div style={{ fontSize: 12, color: '#8492A6', marginTop: 3 }}>{cfg.label} · {share(n)}%</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const plotByNumber = useMemo(() => {
    const m = {};
    visiblePlots.forEach(p => { m[String(p.number)] = p; });
    return m;
  }, [visiblePlots]);

  const types = useMemo(
    () => [...new Set(visiblePlots.map(p => p.cluster_type).filter(Boolean))].sort(),
    [visiblePlots],
  );

  // A plot is dimmed (not removed) when it doesn't match the active status/type filter.
  const isHidden = (plot) =>
    (filter !== 'all' && plot.status !== filter) ||
    (typeFilter !== 'all' && plot.cluster_type !== typeFilter);

  const shownCount = visiblePlots.filter(p => !isHidden(p)).length;
  const total      = visiblePlots.length;

  // Multi-select: a client can buy several plots in one booking. Tapping an
  // available unit toggles it; the action bar books all selected together.
  // Selecting soft-locks the unit server-side immediately (turns it orange for every
  // other rep), so two salespeople can't both spend time signing an LOI for the same
  // unit — deselecting (or Clear) releases it again.
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  async function releasePlots(ids) {
    if (!ids.length) return;
    try {
      await fetch(SALES_ENDPOINTS.plotsRelease, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ plot_ids: ids }) });
    } catch (_) {}
    setPlots((ps) => ps.map((p) => (ids.includes(p.id) ? { ...p, status: 'available', held_by_name: null } : p)));
  }

  // Put a sold unit back on the market from the map's panel — Manager/Director/
  // Admin only (isManager gate mirrors the backend's is_admin_or_manager check
  // on PlotDetailView.patch, the same endpoint Manage Plots uses for this).
  // Doesn't touch the original booking or its signed LOI — see PlotDetailView,
  // it only ever updates the Plot row itself.
  async function moveToResaleFromPanel(plotId) {
    if (!window.confirm('Move this unit to Resale? It becomes bookable again — the original booking and its LOI are left untouched.')) return;
    setResaleBusy(true);
    try {
      const res = await fetch(SALES_ENDPOINTS.plot(plotId), {
        method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ status: 'resale' }),
      });
      if (res.ok) {
        setPlots((ps) => ps.map((p) => (p.id === plotId ? { ...p, status: 'resale', held_by_name: null, agent_name: null } : p)));
        setSoldPanelPlot(null);
      } else {
        flash('Could not move this unit to resale. Please try again.');
      }
    } catch (_) {
      flash('Could not move this unit to resale. Please try again.');
    } finally {
      setResaleBusy(false);
    }
  }

  // Discard a draft from the map's panel — the drafter or a manager/admin, matching
  // the backend permission on BookingDiscardDraftView.
  async function discardDraftFromPanel(bookingId) {
    if (!window.confirm('Discard this draft? This can\'t be undone.')) return;
    setDraftPanelPlot(null);
    try {
      await fetch(SALES_ENDPOINTS.bookingDiscard(bookingId), { method: 'POST', headers: authHeaders() });
    } catch (_) {}
    fetch(`${SALES_ENDPOINTS.plots}?project=${id}`, { headers: authHeaders() })
      .then((r) => r.json()).then((pl) => setPlots(Array.isArray(pl) ? pl : (pl?.results ?? []))).catch(() => {});
  }

  async function pickPlot(plot) {
    if (!plot || busyIds.has(plot.id)) return;
    // A drafted unit is out of the normal select/hold flow entirely — it's not
    // something to select for a new booking. Clicking it opens a small panel: the
    // drafter can resume or discard it, a manager/admin can discard it, anyone else
    // just sees who has it.
    if (plot.drafted_booking_id) {
      setDraftPanelPlot(plot);
      return;
    }
    if (selectedSet.has(plot.id)) {
      setSelectedIds((ids) => ids.filter((x) => x !== plot.id));
      releasePlots([plot.id]);
      return;
    }
    // A sold unit isn't for booking, but a Manager/Director/Admin can open it to
    // put it back on the market — same "Move to Resale" action as Manage Plots,
    // just reachable straight from this map instead of a separate admin screen.
    if (plot.status === 'sold') {
      if (isManager) setSoldPanelPlot(plot);
      return;
    }
    if (plot.status !== 'available' && plot.status !== 'resale') return; // Available or Resale selectable
    setBusyIds((s) => new Set(s).add(plot.id));
    try {
      const res = await fetch(SALES_ENDPOINTS.plotsHold, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ plot_ids: [plot.id] }) });
      const data = await res.json().catch(() => ({}));
      if (data.held?.includes(plot.id)) {
        setPlots((ps) => ps.map((p) => (p.id === plot.id ? { ...p, status: 'hold', held_by_name: user?.name || p.held_by_name } : p)));
        setSelectedIds((ids) => (ids.includes(plot.id) ? ids : [...ids, plot.id]));
      } else {
        const f = (data.failed || [])[0];
        flash(f?.reason === 'sold'
          ? `Plot ${f.number || plot.number} was just sold — pick a different unit.`
          : `Plot ${f?.number || plot.number} was just selected by another salesperson — pick a different one.`);
        fetch(`${SALES_ENDPOINTS.plots}?project=${id}`, { headers: authHeaders() })
          .then((r) => r.json()).then((pl) => setPlots(Array.isArray(pl) ? pl : (pl?.results ?? []))).catch(() => {});
      }
    } finally {
      setBusyIds((s) => { const n = new Set(s); n.delete(plot.id); return n; });
    }
  }

  const selPlots = useMemo(
    () => selectedIds.map((pid) => plots.find((p) => p.id === pid)).filter(Boolean),
    [selectedIds, plots],
  );
  // Which floor each selected unit sits on — shown only when the selection spans
  // several, so picking a shop and a flat together reads clearly.
  const floorOf = (p) => (allFloors.find((f) => onFloor(p, f))?.label) || '';
  const selFloors = [...new Set(selPlots.map(floorOf).filter(Boolean))];
  const selSummary = (floorWise && selFloors.length > 1)
    ? selFloors.map((lbl) => `${lbl}: ${selPlots.filter((p) => floorOf(p) === lbl).map((p) => p.number).join(', ')}`).join(' · ')
    : `Plot ${selPlots.map((p) => p.number).join(', ')}`;

  const selArea = useMemo(
    () => selPlots.reduce((a, p) => a + (parseFloat(String(p.size || '').replace(/[^\d.]/g, '')) || 0), 0),
    [selPlots],
  );

  function bookSelected() {
    if (!selectedIds.length) return;
    const q = new URLSearchParams({ project: String(project?.id || ''), plots: selectedIds.join(',') });
    if (sv) {
      if (sv.lead)       q.set('lead', String(sv.lead));
      if (sv.lead_name)  q.set('client', sv.lead_name);
      if (sv.lead_phone) q.set('phone', sv.lead_phone);
    }
    // Converting an EOI into a plot booking — carry the source EOI id through.
    const convertEoi = new URLSearchParams(window.location.search).get('convertEoi');
    if (convertEoi) q.set('convertEoi', convertEoi);
    router.push(`/sales/booking?${q.toString()}`);
  }

  if (loading) {
    return <div style={{ padding: '60px 28px', textAlign: 'center', color: '#8492A6' }}>Loading project…</div>;
  }
  if (!project) {
    return <div style={{ padding: '60px 28px', textAlign: 'center', color: '#8492A6' }}>Project not found.</div>;
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <button onClick={() => router.push(backHref)} style={backBtn}>← All projects</button>
      </div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>{project.name}</h1>
        {project.location && <p style={{ fontSize: 13, color: '#8492A6' }}>📍 {project.location}</p>}
        {sv && (
          <p style={{ fontSize: 13, color: '#3D5AFE', marginTop: 6, fontWeight: 600 }}>
            Recording closure for {sv.lead_name} · {sv.lead_phone} — tap an available unit.
          </p>
        )}
      </div>

      {/* Filters — status + type (dim non-matching units) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {[['all', 'All'], ['available', 'Available'], ['sold', 'Sold'], ['hold', 'In Progress']].map(([key, label]) => {
          const active = filter === key;
          const dot = STATUS[key]?.dot;
          return (
            <button key={key} onClick={() => setFilter(key)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: `1.5px solid ${active ? '#C9A84C' : '#E6EBF4'}`, background: active ? '#FBF4DF' : '#fff', color: active ? '#8a6d1f' : '#6B7280',
            }}>
              {dot && <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot }} />}
              {label}
            </button>
          );
        })}
      </div>
      {/* Tower: choose the floor first — its plan(s) and its units are what's shown below. */}
      {floorWise && allFloors.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          {/* Block — a dropdown with checkboxes, only shown when the tower actually
              has more than one block. Checking several shows all of their maps for
              the same floor together, so an STM can pick a unit from any of them. */}
          {blocks.filter(Boolean).length > 1 && (
            <>
              <label style={{ fontSize: 12, fontWeight: 800, color: '#8492A6', textTransform: 'uppercase', letterSpacing: 0.5 }}>Block</label>
              <div style={{ position: 'relative' }}>
                <button type="button" onClick={() => setBlockDropdownOpen((o) => !o)} style={{
                  height: 38, padding: '0 14px', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  border: '1.5px solid #E6EBF4', background: '#fff', fontSize: 13, fontWeight: 700, color: '#1A1A2E', minWidth: 190,
                }}>
                  <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedBlocks.size === blocks.length
                      ? 'All Blocks'
                      : [...selectedBlocks].map((b) => `Block ${b || '—'}`).join(', ') || 'Select block(s)'}
                  </span>
                  <span style={{ fontSize: 10, color: '#8492A6' }}>{blockDropdownOpen ? '▲' : '▼'}</span>
                </button>
                {blockDropdownOpen && (
                  <>
                    <div onClick={() => setBlockDropdownOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 41, minWidth: 220,
                      background: '#fff', border: '1.5px solid #E6EBF4', borderRadius: 10, boxShadow: '0 8px 24px rgba(100,120,160,0.18)', padding: 6,
                    }}>
                      {blocks.map((b) => {
                        const on = selectedBlocks.has(b);
                        return (
                          <div key={b} onClick={() => toggleBlock(b)} style={{
                            display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                            background: on ? '#EEF1FF' : 'transparent',
                          }}>
                            <span style={{
                              width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              border: `1.5px solid ${on ? '#3D5AFE' : '#C6D0DB'}`, background: on ? '#3D5AFE' : '#fff', color: '#fff', fontSize: 11, lineHeight: 1,
                            }}>{on ? '✓' : ''}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E' }}>
                              Block {b || '—'}{project?.block_industrial ? '' : ` · ${blockHeight(b)}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
          {/* A block-industrial block is always a single ground-level entry — no real
              floor concept, so picking one is redundant clutter, unlike an actual tower. */}
          {!project?.block_industrial && (
            <>
              <label style={{ fontSize: 12, fontWeight: 800, color: '#8492A6', textTransform: 'uppercase', letterSpacing: 0.5 }}>Floor</label>
              <select value={selectedFloorNum} onChange={(e) => setSelectedFloorNum(Number(e.target.value))}
                style={{ height: 38, padding: '0 12px', borderRadius: 10, border: '1.5px solid #E6EBF4', background: '#fff',
                  fontSize: 13, fontWeight: 700, color: '#1A1A2E', cursor: 'pointer', minWidth: 190 }}>
                {floorOptions.map((f) => {
                  const num = Number(f.floor) || 0;
                  const entriesForNum = blocks
                    .filter((b) => selectedBlocks.has(b))
                    .map((b) => allFloors.find((ff) => (ff.block || '') === b && Number(ff.floor) === num))
                    .filter(Boolean);
                  const n = plots.filter((p) => entriesForNum.some((ff) => onFloor(p, ff))).length;
                  return <option key={num} value={num}>{f.label || `Floor ${num}`} · {n} unit{n === 1 ? '' : 's'}</option>;
                })}
              </select>
            </>
          )}
          {activeEntries.length > 0 && mapEntries.length === 0 && (
            <span style={{ fontSize: 12, color: '#B45309' }}>No plan uploaded for this {project?.block_industrial ? 'block' : 'floor'} — units are listed below.</span>
          )}
        </div>
      )}

      {types.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
          {['all', ...types].map((t) => {
            const active = typeFilter === t;
            return (
              <button key={t} onClick={() => setTypeFilter(t)} style={{
                padding: '6px 13px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: `1.5px solid ${active ? '#C9A84C' : '#E6EBF4'}`, background: active ? '#FBF4DF' : '#fff', color: active ? '#8a6d1f' : '#6B7280',
              }}>
                {t === 'all' ? 'All Types' : t}
              </button>
            );
          })}
        </div>
      )}

      {notice && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: '#FEF3C7', border: '1px solid #f59e0b', color: '#78350F', fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
          ⚠ {notice}
        </div>
      )}

      {/* Two rows of stat cards: the floor on view (what the map below shows), then the
          whole project. A plotted scheme has no floors, so it gets the project row only. */}
      {statRow(floorRowLabel, visiblePlots)}
      {statRow('Whole Project', plots)}

      {mapEntries.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#8a6d1f', background: '#FBF4DF', border: '1px solid #EBD9A3', padding: '5px 12px', borderRadius: 20 }}>
            🏠 Showing {shownCount} of {total} units
          </span>
        </div>
      )}
      {/* Interactive unit map(s) — one card per selected block that has a plan
          drawn for this floor (usually one, but several when multiple blocks
          are checked above, so an STM can pick a unit from any of them). */}
      {mapEntries.map((entry, idx) => {
        const entryZones = entry.zones || [];
        const hoverPrefix = `${idx}:`;
        return (
          <div key={`${entry.block}-${entry.floor}-${idx}`} style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', border: '1px solid #E6EBF4', boxShadow: '0 4px 20px rgba(100,120,160,0.12)', marginBottom: 18 }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #F0F3FA', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1A1A2E' }}>
                  Interactive Unit Map{entry.block ? ` · Block ${entry.block}` : ''}
                </h2>
                <p style={{ fontSize: 12, color: '#8492A6', marginTop: 2 }}>Tap available (green) units to select — pick one or several to book together.</p>
              </div>
            </div>
            <div style={{ position: 'relative', width: '100%', userSelect: 'none' }}>
              <img src={entry.image_url} alt="Site Map" draggable={false} style={{ width: '100%', display: 'block' }} />
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 100 100" preserveAspectRatio="none">
                {entryZones.map(zone => {
                  const plot = plotByNumber[String(zone.plotNumber)];
                  if (!plot) return null;
                  const cfg = plotCfg(plot);
                  const dim = isHidden(plot);
                  const isHover = hovered === hoverPrefix + zone.id;
                  const isSel = selectedSet.has(plot.id);
                  const isMineDraft = !!plot.drafted_booking_id && !!plot.held_by_name && plot.held_by_name === user?.name;
                  // Any drafted unit is clickable — it opens the draft panel for everyone,
                  // just with different actions inside depending on who's looking.
                  const clickable = plot.status === 'available' || plot.status === 'resale' || isSel || !!plot.drafted_booking_id || (plot.status === 'sold' && isManager);
                  const pts = zone.points?.length ? zone.points.map(p => `${p.x},${p.y}`).join(' ') : null;
                  const fillC   = isSel ? '#3D5AFE' : cfg.dot + (isHover ? 'cc' : '99');
                  const strokeC = isSel ? '#1A237E' : cfg.dot;
                  const sw      = isSel ? 0.95 : (isHover ? 0.7 : 0.45);
                  const topStyle = { cursor: clickable ? 'pointer' : 'not-allowed', transition: 'fill 0.13s, opacity 0.13s', opacity: dim ? 0.08 : 1, filter: (isSel || isHover) ? `drop-shadow(0 0 1.5px ${isSel ? '#3D5AFE' : cfg.dot})` : 'none' };
                  const ev = {
                    onClick: () => pickPlot(plot),
                    onMouseEnter: () => setHovered(hoverPrefix + zone.id),
                    onMouseLeave: () => setHovered(null),
                  };
                  const tooltip = plot.drafted_booking_id
                    ? (isMineDraft || isManager ? `${cfg.label} · by ${plot.held_by_name || 'someone'} — tap for options` : `${cfg.label} · by ${plot.held_by_name || 'someone'}`)
                    : (plot.held_by_name && !isSel ? `${cfg.label} · selected by ${plot.held_by_name}` : cfg.label);
                  return (
                    <g key={zone.id}>
                      {pts
                        ? <polygon points={pts} fill="rgba(255,255,255,0.92)" stroke="none" style={{ pointerEvents: 'none' }} />
                        : <rect x={zone.x} y={zone.y} width={zone.width} height={zone.height} rx={0.4} fill="rgba(255,255,255,0.92)" stroke="none" style={{ pointerEvents: 'none' }} />}
                      {pts
                        ? <polygon points={pts} fill={fillC} stroke={strokeC} strokeWidth={sw} style={topStyle} {...ev}><title>{tooltip}</title></polygon>
                        : <rect x={zone.x} y={zone.y} width={zone.width} height={zone.height} rx={0.4} fill={fillC} stroke={strokeC} strokeWidth={sw} style={topStyle} {...ev}><title>{tooltip}</title></rect>}
                    </g>
                  );
                })}
              </svg>
              {/* Number labels */}
              {entryZones.map(zone => {
                const plot = plotByNumber[String(zone.plotNumber)];
                if (!plot) return null;
                const cfg = plotCfg(plot);
                const isSel = selectedSet.has(plot.id);
                const { cx, cy } = zoneCenter(zone);
                // Labels overlap on small plots when the number is type-prefixed
                // (e.g. "Karuna24"). The type is already conveyed by colour/legend,
                // so show just the numeric part; fall back to the full value.
                const labelText = stripPlotPrefix(zone.plotNumber);
                return (
                  <div key={zone.id + '-lbl'}>
                    <div style={{
                      position: 'absolute', left: `${cx}%`, top: `${cy}%`, transform: 'translate(-50%,-50%)',
                      opacity: isHidden(plot) ? 0.08 : 1, transition: 'opacity 0.13s',
                      pointerEvents: 'none', zIndex: 3, background: isSel ? '#3D5AFE' : 'rgba(255,255,255,0.96)', color: isSel ? '#fff' : cfg.text,
                      fontWeight: 800, fontSize: 'clamp(6px,0.8vw,11px)', lineHeight: 1, padding: '1px 5px',
                      borderRadius: 4, boxShadow: `0 1px 3px rgba(0,0,0,0.18), 0 0 0 1px ${isSel ? '#1A237E' : cfg.dot + '66'}`, whiteSpace: 'nowrap',
                    }}>{isSel ? `✓ ${labelText}` : labelText}</div>
                    {/* Drafted units name their drafter right on the map, not just on
                        hover — a tablet has no hover, and this is who everyone else
                        needs to know to ask about the unit. */}
                    {plot.drafted_booking_id && plot.held_by_name && (
                      <div style={{
                        position: 'absolute', left: `${cx}%`, top: `${cy}%`, transform: 'translate(-50%, 6px)',
                        opacity: isHidden(plot) ? 0.08 : 1, transition: 'opacity 0.13s', pointerEvents: 'none', zIndex: 3,
                        background: 'rgba(55,65,81,0.92)', color: '#fff', fontWeight: 700, fontSize: 'clamp(5px,0.6vw,9px)',
                        lineHeight: 1, padding: '1px 5px', borderRadius: 4, whiteSpace: 'nowrap',
                      }}>{plot.held_by_name}</div>
                    )}
                  </div>
                );
              })}

              {/* Hover tooltip — plot summary (mirrors CP portal) */}
              {hovered && hovered.startsWith(hoverPrefix) && (() => {
                const zoneId = hovered.slice(hoverPrefix.length);
                const zone = entryZones.find(z => String(z.id) === zoneId);
                const plot = zone && plotByNumber[String(zone.plotNumber)];
                if (!plot || isHidden(plot)) return null;
                const cfg = plotCfg(plot);
                const tc  = plot.cluster_type ? TYPE_COLORS[plot.cluster_type] : null;
                const { tx, ty } = zoneTopCenter(zone);
                const isRight = tx > 68;
                // The map card clips its overflow, so a tooltip drawn above a unit near
                // the top gets cut. Flip it below the unit in that band instead.
                const ys = zone.points?.length ? zone.points.map(p => p.y) : [zone.y, zone.y + zone.height];
                const below = ty < 26;
                const anchorY = below ? Math.max(...ys) : ty;
                const shiftX = isRight ? '-92%' : '-8%';
                return (
                  <div style={{
                    position: 'absolute', left: `${tx}%`, top: `${anchorY}%`,
                    transform: below ? `translate(${shiftX}, 10px)` : `translate(${shiftX}, calc(-100% - 10px))`,
                    background: 'rgba(10,18,30,0.96)', color: '#fff', padding: '10px 14px', borderRadius: 12,
                    whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 20, minWidth: 140,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)',
                  }}>
                    <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>Plot {plot.number}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: plot.size ? 5 : 0 }}>
                      <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: cfg.dot + '30', color: cfg.dot, border: `1px solid ${cfg.dot}60` }}>{cfg.label}</span>
                      {plot.cluster_type && tc && (
                        <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>{plot.cluster_type}</span>
                      )}
                    </div>
                    {/* A drafted unit is visible to everyone, but only its drafter can act
                        on it — surface who so the rest of the team knows who to ask. */}
                    {plot.drafted_booking_id && plot.held_by_name && (
                      <div style={{ color: '#D1D5DB', fontSize: 11, fontWeight: 600, marginTop: 3 }}>Drafted by {plot.held_by_name}</div>
                    )}
                    {plot.size && <div style={{ color: '#C9A84C', fontSize: 11, fontWeight: 600 }}>{plot.size}</div>}
                    {/* Facing and terrace both move the price, so surface them on hover
                        rather than making the user open the unit to find out. */}
                    {plot.facing && (
                      <div style={{ color: '#93C5FD', fontSize: 11, fontWeight: 600, marginTop: 3 }}>
                        {FACING_LABEL[plot.facing] || plot.facing}
                      </div>
                    )}
                    {(plot.terrace_area || '').trim() && (
                      <div style={{ color: '#6EE7B7', fontSize: 11, fontWeight: 600, marginTop: 3 }}>
                        Terrace {plot.terrace_area} sq.yd
                      </div>
                    )}
                    {/* Who is on a booked unit — so the team can see it without opening the plot. */}
                    {plot.agent_name && (
                      <div style={{ color: '#E2E8F0', fontSize: 11, fontWeight: 600, marginTop: 3 }}>
                        {plot.status === 'hold' ? 'In progress by' : 'Sold by'} {plot.agent_name}
                      </div>
                    )}
                    {(plot.status === 'available' || plot.status === 'resale') && (
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 5 }}>Click to view details →</div>
                    )}
                    {plot.status === 'sold' && isManager && (
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 5 }}>Click to move to resale →</div>
                    )}
                    {plot.drafted_booking_id && plot.held_by_name === user?.name && (
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 5 }}>Click to resume →</div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        );
      })}

      {/* Fallback grid — units for any selected block/floor that has no drawn map
          (or, for a plotted scheme, the whole project when it has none). Never
          duplicates a plot already shown on a map card above. */}
      {(floorWise ? (noMapEntries.length > 0 || activeEntries.length === 0) : mapEntries.length === 0) && (
        <div style={{ background: '#fff', borderRadius: 16, padding: '18px', border: '1px solid #E6EBF4', boxShadow: '0 4px 20px rgba(100,120,160,0.12)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>Units</h2>
          <p style={{ fontSize: 12, color: '#8492A6', marginBottom: 14 }}>No site map drawn for this project. Tap an available unit below.</p>
          {!noMapPlots.length && project?.block_industrial ? (
            // Block-wise industrial, this block has no plots yet — nothing to pick, so
            // raise an EOI against the block instead of a dead end. The EOI code is
            // block-prefixed (e.g. Block E → E1, E2…) via ?block= on the booking form.
            <div style={{ textAlign: 'center', padding: '28px 12px' }}>
              <p style={{ color: '#374151', fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                Block {[...selectedBlocks].join(', ') || '—'} hasn't been mapped yet.
              </p>
              <p style={{ color: '#8492A6', fontSize: 12, marginBottom: 16 }}>
                No units are defined here yet — raise an EOI to hold interest until it's surveyed.
              </p>
              <button
                onClick={() => router.push(`/sales/booking?project=${id}&eoi=1&block=${encodeURIComponent([...selectedBlocks][0] || '')}`)}
                style={{ padding: '10px 22px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 800, color: '#fff',
                  background: 'linear-gradient(135deg,#182350,#3D5AFE)', cursor: 'pointer' }}>
                Raise EOI for Block {[...selectedBlocks][0] || 'this project'}
              </button>
            </div>
          ) : !noMapPlots.length ? (
            <p style={{ color: '#8492A6', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No units defined for this project.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {noMapPlots.filter(p => !isHidden(p)).map(plot => {
                const cfg = plotCfg(plot);
                const isSel = selectedSet.has(plot.id);
                const isMineDraft = !!plot.drafted_booking_id && !!plot.held_by_name && plot.held_by_name === user?.name;
                const clickable = plot.status === 'available' || plot.status === 'resale' || isSel || !!plot.drafted_booking_id || (plot.status === 'sold' && isManager);
                const title = plot.drafted_booking_id
                  ? (isMineDraft || isManager ? `${cfg.label} · by ${plot.held_by_name || 'someone'} — tap for options` : `${cfg.label} · by ${plot.held_by_name || 'someone'}`)
                  : (plot.held_by_name && !isSel ? `${cfg.label} · selected by ${plot.held_by_name}` : cfg.label);
                return (
                  <button key={plot.id} onClick={() => pickPlot(plot)} disabled={!clickable}
                    title={title}
                    style={{
                      minWidth: 84, padding: '10px 12px', borderRadius: 10,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                      border: `1.5px solid ${isSel ? '#1A237E' : cfg.dot}`,
                      background: isSel ? '#3D5AFE' : cfg.dot + (clickable ? '22' : '14'),
                      color: isSel ? '#fff' : cfg.text, fontWeight: 800, fontSize: 13,
                      cursor: clickable ? 'pointer' : 'not-allowed', opacity: clickable ? 1 : 0.6,
                    }}>
                    <span>{isSel ? `✓ ${plot.number}` : plot.number}</span>
                    {/* No plan drawn for this floor, so the chip is the only place these
                        price-affecting details can surface — a hover title is no use on a
                        tablet, which is what the sales team books on. Same reasoning for
                        who drafted a grey unit: print the name, don't rely on hover. */}
                    {plot.drafted_booking_id && plot.held_by_name && <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.8 }}>{plot.held_by_name}</span>}
                    {plot.size && <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.8 }}>{plot.size}</span>}
                    {plot.facing && <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.8 }}>{FACING_LABEL[plot.facing] || plot.facing}</span>}
                    {(plot.terrace_area || '').trim() && <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.8 }}>Terrace {plot.terrace_area} sq.yd</span>}
                    {plot.agent_name && <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.8 }}>{plot.status === 'hold' ? 'In progress by' : 'Sold by'} {plot.agent_name}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Multi-select action bar — books all selected plots in one booking. */}
      {selPlots.length > 0 && (
        <div style={selBar}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#1A1A2E' }}>
              {selPlots.length} plot{selPlots.length > 1 ? 's' : ''} selected
              {selArea > 0 && <span style={{ color: '#2E7D32', marginLeft: 8 }}>· {+selArea.toFixed(2)} total area</span>}
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {sv ? `${sv.lead_name} · ` : ''}{selSummary}
            </div>
          </div>
          <button onClick={() => { const ids = [...selectedIds]; setSelectedIds([]); releasePlots(ids); }} style={cancelBtn}>Clear</button>
          <button onClick={bookSelected} style={primaryBtn2}>
            {sv ? 'Record Closure' : 'Book'} · {selPlots.length} plot{selPlots.length > 1 ? 's' : ''} →
          </button>
        </div>
      )}

      {/* Drafted-unit panel — resume (drafter) / discard (drafter or manager/admin). */}
      {draftPanelPlot && (() => {
        const p = draftPanelPlot;
        const mine = !!p.held_by_name && p.held_by_name === user?.name;
        const canDiscard = mine || isManager;
        return (
          <div onClick={() => setDraftPanelPlot(null)} style={overlay}>
            <div onClick={(e) => e.stopPropagation()} style={{ ...panel, maxWidth: 360, padding: 22 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#8492A6', textTransform: 'uppercase', letterSpacing: 0.5 }}>Unit {p.number} · Drafted</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#1A1A2E', margin: '4px 0 18px' }}>
                {p.held_by_name ? `Drafted by ${p.held_by_name}` : 'Drafted'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {mine && (
                  <button onClick={() => router.push(`/sales/booking?draft=${p.drafted_booking_id}`)}
                    style={{ padding: '11px 16px', borderRadius: 10, border: 'none', background: '#3D5AFE', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    ▸ Resume
                  </button>
                )}
                {canDiscard && (
                  <button onClick={() => discardDraftFromPanel(p.drafted_booking_id)}
                    style={{ padding: '11px 16px', borderRadius: 10, border: '1.5px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    ✕ Discard Draft
                  </button>
                )}
                {!canDiscard && (
                  <p style={{ fontSize: 12, color: '#8492A6', margin: 0 }}>Only {p.held_by_name || 'the drafter'} or a manager can resume or discard this.</p>
                )}
                <button onClick={() => setDraftPanelPlot(null)} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: '#F3F4F6', color: '#6B7280', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Sold-unit panel — Manager/Director/Admin only: put the unit back on the
          market for resale without touching the original booking or its LOI. */}
      {soldPanelPlot && (() => {
        const p = soldPanelPlot;
        return (
          <div onClick={() => !resaleBusy && setSoldPanelPlot(null)} style={overlay}>
            <div onClick={(e) => e.stopPropagation()} style={{ ...panel, maxWidth: 360, padding: 22 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#8492A6', textTransform: 'uppercase', letterSpacing: 0.5 }}>Unit {p.number} · Sold</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#1A1A2E', margin: '4px 0 18px' }}>
                {p.agent_name ? `Sold by ${p.agent_name}` : 'Sold'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={() => moveToResaleFromPanel(p.id)} disabled={resaleBusy}
                  style={{ padding: '11px 16px', borderRadius: 10, border: 'none', background: '#7C3AED', color: '#fff', fontWeight: 700, fontSize: 14, cursor: resaleBusy ? 'default' : 'pointer', opacity: resaleBusy ? 0.7 : 1 }}>
                  {resaleBusy ? 'Moving…' : '↻ Move to Resale'}
                </button>
                <button onClick={() => setSoldPanelPlot(null)} disabled={resaleBusy}
                  style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: '#F3F4F6', color: '#6B7280', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default function ClosureViewerPage() {
  return <ClosureViewerContent />;
}

/* ── Unit detail: floor-plan layouts + record-closure / direct-booking form ── */
// Booking web app (records the booking, auto-generates the LOI and stores it in
// the Google Sheet). Opening it navigates the current tab — no new window.
const BOOKING_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbypnmUmBmBIrL5rC6xqSEbLFDvSw1XvES6D-JyL1beY8-AeEREnfvVM_TbbbV1t1i883g/exec';

function UnitPanel({ plot, project, sv, user, sources = [], onClose, onClosed }) {
  const cfg = plotCfg(plot);
  const router = useRouter();

  function openBookingScript() {
    // Native ERP booking form (replaces the GAS web app).
    const q = new URLSearchParams({ project: String(project?.id || ''), plot: String(plot?.id || '') });
    if (sv) {
      if (sv.lead) q.set('lead', String(sv.lead));
      if (sv.lead_name)  q.set('client', sv.lead_name);
      if (sv.lead_phone) q.set('phone', sv.lead_phone);
    }
    const convertEoi = new URLSearchParams(window.location.search).get('convertEoi');
    if (convertEoi) q.set('convertEoi', convertEoi);
    router.push(`/sales/booking?${q.toString()}`);
  }

  const typePlans = useMemo(() => {
    const entry = (project.plot_type_plans || []).find(t => t.name === plot.cluster_type);
    return entry?.floor_plans || [];
  }, [project, plot]);
  const booking = !sv; // no site-visit context → direct booking from the Booking nav

  const [viewing, setViewing] = useState(null); // url in lightbox

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={panel}>
        {/* Header */}
        <div style={{ padding: '18px 20px', background: cfg.bg, borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: cfg.text, opacity: 0.8 }}>Unit No.</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: cfg.text }}>{plot.number}</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {plot.cluster_type && (
              <span style={{ fontSize: 11, fontWeight: 800, padding: '5px 10px', borderRadius: 8, background: '#fff', color: '#673AB7', border: '1px solid #E0D6F5' }}>
                {plot.cluster_type}
              </span>
            )}
            <span style={{ fontSize: 11, fontWeight: 800, padding: '5px 12px', borderRadius: 20, background: '#fff', color: cfg.dot, border: `1px solid ${cfg.dot}55` }}>
              {cfg.label}{plot.held_by_name && plot.status === 'hold' ? ` · ${plot.held_by_name}` : ''}
            </span>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', fontSize: 15, color: '#374151' }}>✕</button>
          </div>
        </div>

        <div style={{ padding: 20 }}>
          {/* Unit info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
            {plot.size   && <InfoBox label="Unit Area" value={plot.size} />}
            {plot.facing && <InfoBox label="Facing" value={plot.facing} />}
            {plot.price  && <InfoBox label="Price" value={plot.price} full={!plot.size || !plot.facing} />}
          </div>

          {/* Floor plan layouts — per-unit only. The master/site layout is the map
              behind this panel, so it's intentionally not repeated here. */}
          {typePlans.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 10 }}>
                Floor Plan Layouts
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {typePlans.map((fp, i) => (
                  <button key={i} onClick={() => setViewing(fp.url)} style={planBtn}>🔍 {fp.label}</button>
                ))}
              </div>
            </div>
          )}

          {/* Booking & closure are both handled by the booking web app (own login,
              auto-LOI, Google Sheet). The button opens it in the same window. */}
          <button onClick={openBookingScript} style={primaryBtn}>
            {sv ? `Record Closure for Unit ${plot.number}` : `Book Unit ${plot.number}`}
          </button>
        </div>
      </div>

      {/* Lightbox */}
      {viewing && (
        <div onClick={() => setViewing(null)} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          {isPdfUrl(viewing)
            ? <embed src={viewing} type="application/pdf" style={{ width: '90vw', height: '88vh', borderRadius: 8 }} />
            : <img src={viewing} alt="Layout" style={{ maxWidth: '92vw', maxHeight: '90vh', borderRadius: 8, boxShadow: '0 10px 50px rgba(0,0,0,0.5)' }} />}
          <button onClick={() => setViewing(null)} style={{ position: 'absolute', top: 20, right: 24, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '50%', width: 40, height: 40, fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
      )}
    </div>
  );
}

function InfoBox({ label, value, full }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : 'auto', borderRadius: 12, padding: '12px 14px', background: '#FAFBFF', border: '1px solid #EDF0F7' }}>
      <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E' }}>{value}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      {children}
    </div>
  );
}

const overlay    = { position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,28,46,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
const panel      = { background: '#fff', borderRadius: 18, width: '94%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(24,35,80,0.22)' };
const planBtn    = { padding: '11px', borderRadius: 12, fontSize: 12, fontWeight: 700, color: '#B8960C', background: 'rgba(184,150,12,0.08)', border: '1px solid rgba(184,150,12,0.22)', cursor: 'pointer' };
const primaryBtn = { width: '100%', padding: '12px', background: '#2E7D32', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer' };
const primaryBtn2 = { padding: '11px 18px', background: '#2E7D32', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' };
const selBar     = { position: 'fixed', left: '50%', bottom: 20, transform: 'translateX(-50%)', zIndex: 900, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#fff', borderRadius: 14, boxShadow: '0 10px 40px rgba(24,35,80,0.22)', border: '1px solid #E6EBF4', width: 'min(680px, calc(100% - 40px))' };
const cancelBtn  = { padding: '11px 18px', background: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const backBtn    = { padding: '7px 14px', backgroundColor: '#F0F3FA', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, color: '#5C6BC0', cursor: 'pointer' };
const lbl        = { fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4, display: 'block' };
const inp        = { width: '100%', height: 40, padding: '0 12px', borderRadius: 10, border: '1.5px solid #E5E7EB', fontSize: 13, boxSizing: 'border-box', outline: 'none', background: '#FAFAFA' };
