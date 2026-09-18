'use client';
import { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useParams, useRouter } from 'next/navigation';
import { SALES_ENDPOINTS, authHeaders } from '../../../../constants/api';
import { stripPlotPrefix } from '../../../../lib/plotNumber';
import { isManagerRole } from '../../../../lib/moduleAccess';


import Icon from '../../../../components/Icon';
import { confirmDialog, notify } from '../../../../lib/notify';
import Loader from '../../../../components/Loader';
import { mapHex, MAP_SELECTED, MAP_INK, MAP_TIP_BG } from '../../../../lib/mapColors';
const isPdfUrl   = (u) => !!u && u.split('?')[0].toLowerCase().endsWith('.pdf');
const isImageUrl = (u) => !!u && /\.(png|jpe?g|webp|gif|svg)$/i.test(u.split('?')[0]);

// Status config keyed to vistaraweb plot statuses. Only "available" is selectable
// for a closure (Sold/Hold are shown for context but not clickable).
// Stored as 'road' / 'garden'; shown in full wherever a unit is surfaced.
const FACING_LABEL = { road: 'Road Facing', garden: 'Garden Facing' };

const STATUS = {
  available: { label: 'Available', dot: 'var(--success)', text: 'var(--success-deep)', bg: 'var(--success-soft)' },
  // Covers two different things under one status: a soft pick that auto-expires
  // in 10 minutes (someone just tapped it), and a hard hold backed by an actual
  // pending-approval booking. "Hold" read as a deliberate pause either way and
  // confused people about which one they were looking at — "In Progress" reads
  // correctly for both ("something is actively happening with this unit").
  hold:      { label: 'In Progress', dot: 'var(--accent)', text: 'var(--text)', bg: 'var(--surface-2)' },
  // Submitted and waiting on a manager. Shares plot.status='hold' with the two
  // states above — submission is what clears held_by — so it is told apart by the
  // pending booking the server reports, and coloured amber because it is a real
  // commitment the team should not treat as still up for grabs.
  pending:   { label: 'Hold',        dot: 'var(--warning-2)', text: 'var(--warning-deep)', bg: 'var(--warning-soft)' },
  sold:      { label: 'Sold',      dot: 'var(--danger)', text: 'var(--danger-deep)', bg: 'var(--danger-soft)' },
  // A previously-sold unit put back on the market — bookable exactly like
  // Available, just purple instead of green so it reads as "resold", not new.
  resale:    { label: 'Resale',    dot: '#a2d2ff', text: 'var(--accent-deep)', bg: 'var(--accent-soft)' },
  // A unit with a saved (unsubmitted) draft — same underlying plot.status='hold' as a
  // bare in-progress selection, but shown grey and distinct so the team can tell "someone
  // is mid-paperwork on this" from "someone just clicked it a second ago".
  drafted:   { label: 'Drafted',   dot: 'var(--faint)', text: 'var(--text-2)', bg: 'var(--surface-2)' },
};
// Visual state for a plot, folding in the drafted override — everywhere the map colours
// a unit should go through this instead of indexing STATUS[plot.status] directly.
const plotCfg = (plot) => (
  plot.pending_booking_id ? STATUS.pending
    : plot.drafted_booking_id ? STATUS.drafted
      : (STATUS[plot.status] || STATUS.available));
// The filter chips and the count tiles key off this, not plot.status, so
// "In Progress" means only what is still being worked on.
const plotState = (plot) => (
  plot.pending_booking_id ? 'pending' : (plot.status === 'hold' ? 'hold' : plot.status));

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
  Ananda:  { bg: 'rgba(47,109,181,0.18)', color: '#a2d2ff', border: 'rgba(47,109,181,0.5)' },
  Maitri:  { bg: 'rgba(47,109,181,0.18)',  color: '#a2d2ff', border: 'rgba(47,109,181,0.5)'  },
  Karuna:  { bg: 'rgba(163,103,26,0.18)',  color: '#f5b453', border: 'rgba(163,103,26,0.5)'  },
  Hridaya: { bg: 'rgba(35,135,74,0.18)',  color: '#a4f5a6', border: 'rgba(35,135,74,0.5)'  },
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
  const [holdPanelPlot, setHoldPanelPlot] = useState(null);   // in-progress unit clicked into
  const [cancelBusy, setCancelBusy] = useState(false);
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
    const c = { available: 0, hold: 0, pending: 0, sold: 0 };
    list.forEach(p => { const k = plotState(p); if (c[k] != null) c[k]++; });
    const t = list.length;
    const share = (n) => (t ? Math.round(n / t * 100) : 0);

    return (
      <div style={{ marginBottom: 14 }}>
        <div className="nx-eyebrow">{title}</div>
        <div className="nx-stat-row">
          <div className="nx-card nx-stat-tile">
            <span style={{ width: 36, height: 36, borderRadius: 14, background: 'var(--accent-softer)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: 17, fontWeight: 900 }}>▦</span>
            <div>
              <div className="nx-stat-n">{t}</div>
              <div className="nx-stat-l">Total Units</div>
            </div>
          </div>
          {[['available', c.available], ['hold', c.hold], ['pending', c.pending], ['sold', c.sold]].map(([key, n]) => {
            const cfg = STATUS[key];
            return (
              <div className="nx-card nx-stat-tile" key={key}>
                <span style={{ width: 36, height: 36, borderRadius: 14, background: cfg.bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: cfg.dot, fontSize: 18, fontWeight: 900 }}>•</span>
                <div>
                  <div className="nx-stat-n">{n}</div>
                  <div className="nx-stat-l">{cfg.label} · {share(n)}%</div>
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
    (filter !== 'all' && plotState(plot) !== filter) ||
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
    if (!(await confirmDialog('Move this unit to Resale? It becomes bookable again — the original booking and its LOI are left untouched.'))) return;
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
    if (!(await confirmDialog('Discard this draft? This can\'t be undone.'))) return;
    setDraftPanelPlot(null);
    try {
      await fetch(SALES_ENDPOINTS.bookingDiscard(bookingId), { method: 'POST', headers: authHeaders() });
    } catch (_) {}
    fetch(`${SALES_ENDPOINTS.plots}?project=${id}`, { headers: authHeaders() })
      .then((r) => r.json()).then((pl) => setPlots(Array.isArray(pl) ? pl : (pl?.results ?? []))).catch(() => {});
  }

  // Free a unit somebody has selected or drafted but not submitted. The server
  // decides who may: the holder, a real admin, or one of the project's booking
  // approvers — `can_cancel_hold` on the plot is that same answer, so the button is
  // only offered where the call would succeed.
  async function cancelHold(plotId) {
    if (!(await confirmDialog('Cancel this selection? The unit goes back on the market, and any saved draft for it is discarded.'))) return;
    setCancelBusy(true);
    try {
      const res = await fetch(SALES_ENDPOINTS.plotsCancelHold, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ plot_ids: [plotId] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { notify(data.detail || 'Could not cancel this selection.'); return; }
      setHoldPanelPlot(null); setDraftPanelPlot(null);
      const pl = await fetch(`${SALES_ENDPOINTS.plots}?project=${id}`, { headers: authHeaders() }).then((r) => r.json());
      setPlots(Array.isArray(pl) ? pl : (pl?.results ?? []));
    } catch (_) {
      notify('Could not cancel this selection.');
    } finally { setCancelBusy(false); }
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
    // Somebody else's live selection. Anyone allowed to clear it gets the panel;
    // for everyone else this stays inert, as before. A unit already submitted for
    // approval is excluded — can_cancel_hold is false for it, and rejecting that is
    // the approvals screen's job.
    if (plot.status === 'hold' && plot.can_cancel_hold) {
      setHoldPanelPlot(plot);
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
    return <Loader variant="page" label="Loading project…" />;
  }
  if (!project) {
    return <div style={{ padding: '60px 28px', textAlign: 'center', color: 'var(--muted)' }}>Project not found.</div>;
  }

  return (
    <div className="nx-page">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={() => router.push(backHref)} style={backBtn}>← All projects</button>
      </div>
      <div style={{ marginBottom: 20 }}>
        <h1 className="nx-page-title">{project.name}</h1>
        {project.location && <p style={{ fontSize: 13, color: 'var(--muted)' }}><Icon name="pin" /> {project.location}</p>}
        {sv && (
          <p style={{ fontSize: 13, color: 'var(--accent)', marginTop: 6, fontWeight: 600 }}>
            Recording closure for {sv.lead_name} · {sv.lead_phone} — tap an available unit.
          </p>
        )}
      </div>

      {/* Filters — status + type (dim non-matching units) */}
      <div className="nx-filters">
        {[['all', 'All'], ['available', 'Available'], ['sold', 'Sold'], ['hold', 'In Progress'], ['pending', 'Hold']].map(([key, label]) => {
          const active = filter === key;
          const dot = STATUS[key]?.dot;
          return (
            <button className={`nx-btn nx-btn-md nx-toggle${active ? ' is-on' : ''}`} key={key} onClick={() => setFilter(key)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: `1.5px solid ${active ? 'var(--warning-2)' : 'var(--surface-3)'}`, background: active ? 'var(--warning-soft)' : 'var(--surface)', color: active ? 'var(--warning)' : 'var(--text-3)',
            }}>
              {dot && <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot }} />}
              {label}
            </button>
          );
        })}
      </div>
      {/* Tower: choose the floor first — its plan(s) and its units are what's shown below. */}
      {floorWise && allFloors.length > 0 && (
        <div className="nx-filters">
          {/* Block — a dropdown with checkboxes, only shown when the tower actually
              has more than one block. Checking several shows all of their maps for
              the same floor together, so an STM can pick a unit from any of them. */}
          {blocks.filter(Boolean).length > 1 && (
            <>
              <label className="nx-field-inline">Block</label>
              <div style={{ position: 'relative' }}>
                <button className="nx-btn nx-btn-sm nx-btn-secondary" type="button" onClick={() => setBlockDropdownOpen((o) => !o)} style={{
                  height: 38, padding: '0 14px', borderRadius: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  border: '1.5px solid var(--surface-3)', background: 'var(--surface)', fontSize: 13, fontWeight: 700, color: 'var(--text)', minWidth: 190,
                }}>
                  <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedBlocks.size === blocks.length
                      ? 'All Blocks'
                      : [...selectedBlocks].map((b) => `Block ${b || '—'}`).join(', ') || 'Select block(s)'}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>{blockDropdownOpen ? '▲' : '▼'}</span>
                </button>
                {blockDropdownOpen && (
                  <>
                    <div onClick={() => setBlockDropdownOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                    <div className="nx-popover" style={{
                      position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 41, minWidth: 220,
                      background: 'var(--surface)', border: '1.5px solid var(--surface-3)', borderRadius: 14, boxShadow: '0 8px 24px rgba(47,109,181,0.18)', padding: 6,
                    }}>
                      {blocks.map((b) => {
                        const on = selectedBlocks.has(b);
                        return (
                          <div key={b} onClick={() => toggleBlock(b)} style={{
                            display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                            background: on ? 'var(--accent-softer)' : 'transparent',
                          }}>
                            <span style={{
                              width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'var(--surface)', color: '#fff', fontSize: 11, lineHeight: 1,
                            }}>{on ? <Icon name="check" /> : ''}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
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
              <label className="nx-field-inline">Floor</label>
              <select className="nx-input" value={selectedFloorNum} onChange={(e) => setSelectedFloorNum(Number(e.target.value))}
                style={{ height: 38, padding: '0 12px', borderRadius: 14, border: '1.5px solid var(--surface-3)', background: 'var(--surface)',
                  fontSize: 13, fontWeight: 700, color: 'var(--text)', cursor: 'pointer', minWidth: 190 }}>
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
            <span style={{ fontSize: 12, color: 'var(--warning)' }}>No plan uploaded for this {project?.block_industrial ? 'block' : 'floor'} — units are listed below.</span>
          )}
        </div>
      )}

      {types.length > 0 && (
        <div className="nx-filters">
          {['all', ...types].map((t) => {
            const active = typeFilter === t;
            return (
              <button className={`nx-btn nx-btn-sm nx-toggle${active ? ' is-on' : ''}`} key={t} onClick={() => setTypeFilter(t)} style={{
                padding: '6px 13px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: `1.5px solid ${active ? 'var(--warning-2)' : 'var(--surface-3)'}`, background: active ? 'var(--warning-soft)' : 'var(--surface)', color: active ? 'var(--warning)' : 'var(--text-3)',
              }}>
                {t === 'all' ? 'All Types' : t}
              </button>
            );
          })}
        </div>
      )}

      {notice && (
        <div style={{ padding: '10px 14px', borderRadius: 14, background: 'var(--warning-soft)', border: '1px solid var(--warning-2)', color: 'var(--warning-deep)', fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
          <Icon name="alert" /> {notice}
        </div>
      )}

      {/* Two rows of stat cards: the floor on view (what the map below shows), then the
          whole project. A plotted scheme has no floors, so it gets the project row only. */}
      {statRow(floorRowLabel, visiblePlots)}
      {statRow('Whole Project', plots)}

      {mapEntries.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <span className="nx-badge" style={{ fontSize: 12, fontWeight: 700, color: 'var(--warning)', background: 'var(--warning-soft)', border: '1px solid var(--peach)', padding: '5px 12px', borderRadius: 20 }}>
            <Icon name="home" /> Showing {shownCount} of {total} units
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
          <div className="nx-card" key={`${entry.block}-${entry.floor}-${idx}`} style={{ background: 'var(--surface)', borderRadius: 20, overflow: 'hidden', border: '1px solid var(--surface-3)', boxShadow: '0 4px 20px rgba(47,109,181,0.12)', marginBottom: 18 }}>
            <div className="nx-map-head">
              <div>
                <h2 className="nx-map-title">
                  Interactive Unit Map{entry.block ? ` · Block ${entry.block}` : ''}
                </h2>
                <p className="nx-map-sub">Tap available (green) units to select — pick one or several to book together.</p>
              </div>
            </div>
            <div className="nx-map-canvas">
              <img className="nx-map-img" src={entry.image_url} alt="Site Map" draggable={false} />
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
                  const clickable = plot.status === 'available' || plot.status === 'resale' || isSel || !!plot.drafted_booking_id || !!plot.can_cancel_hold || (plot.status === 'sold' && isManager);
                  const pts = zone.points?.length ? zone.points.map(p => `${p.x},${p.y}`).join(' ') : null;
                  const hex     = mapHex(cfg.dot);
                  const fillC   = isSel ? MAP_SELECTED + 'D9' : hex + (isHover ? 'B3' : '80');
                  const strokeC = isSel ? MAP_INK : hex;
                  const sw      = isSel ? 0.95 : (isHover ? 0.7 : 0.45);
                  const topStyle = { cursor: clickable ? 'pointer' : 'not-allowed', transition: 'fill 0.13s, opacity 0.13s', opacity: dim ? 0.08 : 1, filter: (isSel || isHover) ? `drop-shadow(0 0 1.5px ${isSel ? MAP_SELECTED : hex})` : 'none' };
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
                      pointerEvents: 'none', zIndex: 3, background: isSel ? MAP_SELECTED : '#FFFFFF', color: isSel ? '#fff' : MAP_INK,
                      fontWeight: 800, fontSize: 'clamp(6px,0.8vw,11px)', lineHeight: 1, padding: '1px 5px',
                      borderRadius: 5, boxShadow: `0 1px 3px rgba(0,0,0,0.22), 0 0 0 1.5px ${isSel ? '#fff' : mapHex(cfg.dot)}`, whiteSpace: 'nowrap',
                    }}>{isSel ? `${labelText}` : labelText}</div>
                    {/* Drafted units name their drafter right on the map, not just on
                        hover — a tablet has no hover, and this is who everyone else
                        needs to know to ask about the unit. */}
                    {plot.drafted_booking_id && plot.held_by_name && (
                      <div style={{
                        position: 'absolute', left: `${cx}%`, top: `${cy}%`, transform: 'translate(-50%, 6px)',
                        opacity: isHidden(plot) ? 0.08 : 1, transition: 'opacity 0.13s', pointerEvents: 'none', zIndex: 3,
                        background: 'rgba(58,60,64,0.92)', color: '#fff', fontWeight: 700, fontSize: 'clamp(5px,0.6vw,9px)',
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
                    background: MAP_TIP_BG, color: '#fff', padding: '10px 14px', borderRadius: 16,
                    whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 20, minWidth: 140,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)',
                  }}>
                    <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>Plot {plot.number}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: plot.size ? 5 : 0 }}>
                      <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: mapHex(cfg.dot) + '33', color: '#fff', border: `1px solid ${mapHex(cfg.dot)}` }}>{cfg.label}</span>
                      {plot.cluster_type && tc && (
                        <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>{plot.cluster_type}</span>
                      )}
                    </div>
                    {/* A drafted unit is visible to everyone, but only its drafter can act
                        on it — surface who so the rest of the team knows who to ask. */}
                    {plot.drafted_booking_id && plot.held_by_name && (
                      <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 600, marginTop: 3 }}>Drafted by {plot.held_by_name}</div>
                    )}
                    {plot.size && <div style={{ color: '#FFCB80', fontSize: 11, fontWeight: 600 }}>{plot.size}</div>}
                    {/* Facing and terrace both move the price, so surface them on hover
                        rather than making the user open the unit to find out. */}
                    {plot.facing && (
                      <div style={{ color: '#A2D2FF', fontSize: 11, fontWeight: 600, marginTop: 3 }}>
                        {FACING_LABEL[plot.facing] || plot.facing}
                      </div>
                    )}
                    {(plot.terrace_area || '').trim() && (
                      <div style={{ color: '#A4F5A6', fontSize: 11, fontWeight: 600, marginTop: 3 }}>
                        Terrace {plot.terrace_area} sq.yd
                      </div>
                    )}
                    {/* Who is on a booked unit — so the team can see it without opening the plot. */}
                    {plot.agent_name && (
                      <div style={{ color: 'rgba(255,255,255,0.82)', fontSize: 11, fontWeight: 600, marginTop: 3 }}>
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
        <div className="nx-card" style={{ background: 'var(--surface)', borderRadius: 20, padding: '18px', border: '1px solid var(--surface-3)', boxShadow: '0 4px 20px rgba(47,109,181,0.12)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Units</h2>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>No site map drawn for this project. Tap an available unit below.</p>
          {!noMapPlots.length && project?.block_industrial ? (
            // Block-wise industrial, this block has no plots yet — nothing to pick, so
            // raise an EOI against the block instead of a dead end. The EOI code is
            // block-prefixed (e.g. Block E → E1, E2…) via ?block= on the booking form.
            <div style={{ textAlign: 'center', padding: '28px 12px' }}>
              <p style={{ color: 'var(--text-2)', fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                Block {[...selectedBlocks].join(', ') || '—'} hasn't been mapped yet.
              </p>
              <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 16 }}>
                No units are defined here yet — raise an EOI to hold interest until it's surveyed.
              </p>
              <button className="nx-btn nx-btn-md nx-btn-primary"
                onClick={() => router.push(`/sales/booking?project=${id}&eoi=1&block=${encodeURIComponent([...selectedBlocks][0] || '')}`)}
                style={{ padding: '10px 22px', borderRadius: 14, border: 'none', fontSize: 13, fontWeight: 800, color: '#fff',
                  background: 'var(--strong)', cursor: 'pointer' }}>
                Raise EOI for Block {[...selectedBlocks][0] || 'this project'}
              </button>
            </div>
          ) : !noMapPlots.length ? (
            <p style={{ color: 'var(--muted)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No units defined for this project.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {noMapPlots.filter(p => !isHidden(p)).map(plot => {
                const cfg = plotCfg(plot);
                const isSel = selectedSet.has(plot.id);
                const isMineDraft = !!plot.drafted_booking_id && !!plot.held_by_name && plot.held_by_name === user?.name;
                const clickable = plot.status === 'available' || plot.status === 'resale' || isSel || !!plot.drafted_booking_id || !!plot.can_cancel_hold || (plot.status === 'sold' && isManager);
                const title = plot.drafted_booking_id
                  ? (isMineDraft || isManager ? `${cfg.label} · by ${plot.held_by_name || 'someone'} — tap for options` : `${cfg.label} · by ${plot.held_by_name || 'someone'}`)
                  : (plot.held_by_name && !isSel ? `${cfg.label} · selected by ${plot.held_by_name}` : cfg.label);
                return (
                  <button className={`nx-btn nx-btn-md nx-toggle${isSel ? ' is-on' : ''}`} key={plot.id} onClick={() => pickPlot(plot)} disabled={!clickable}
                    title={title}
                    style={{
                      minWidth: 84, padding: '10px 12px', borderRadius: 14,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                      border: `1.5px solid ${isSel ? 'var(--text)' : cfg.dot}`,
                      background: isSel ? 'var(--primary)' : `color-mix(in srgb, ${cfg.dot} ${clickable ? 13 : 8}%, transparent)`,
                      color: isSel ? '#fff' : cfg.text, fontWeight: 800, fontSize: 13,
                      cursor: clickable ? 'pointer' : 'not-allowed', opacity: clickable ? 1 : 0.6,
                    }}>
                    <span>{isSel ? `${plot.number}` : plot.number}</span>
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
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>
              {selPlots.length} plot{selPlots.length > 1 ? 's' : ''} selected
              {selArea > 0 && <span style={{ color: 'var(--success)', marginLeft: 8 }}>· {+selArea.toFixed(2)} total area</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {sv ? `${sv.lead_name} · ` : ''}{selSummary}
            </div>
          </div>
          <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={() => { const ids = [...selectedIds]; setSelectedIds([]); releasePlots(ids); }} style={cancelBtn}>Clear</button>
          <button className="nx-btn nx-btn-md nx-btn-success" onClick={bookSelected} style={primaryBtn2}>
            {sv ? 'Record Closure' : 'Book'} · {selPlots.length} plot{selPlots.length > 1 ? 's' : ''} →
          </button>
        </div>
      )}

      {/* Drafted-unit panel — resume (drafter) / discard (drafter or manager/admin). */}
      {draftPanelPlot && (() => {
        const p = draftPanelPlot;
        const mine = !!p.held_by_name && p.held_by_name === user?.name;
        // The server's answer rather than a second guess at the rule: the drafter,
        // an admin, or one of the project's booking approvers.
        const canDiscard = !!p.can_cancel_hold;
        return (
          <div className="nx-modal-backdrop" onClick={() => setDraftPanelPlot(null)} style={overlay}>
            <div className="nx-modal" onClick={(e) => e.stopPropagation()} style={{ ...panel, maxWidth: 360, padding: 22 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Unit {p.number} · Drafted</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: '4px 0 18px' }}>
                {p.held_by_name ? `Drafted by ${p.held_by_name}` : 'Drafted'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Resume is offered to anyone the server will hand the draft to —
                    its author, an admin, or one of the project's approvers. Gating on
                    "is it mine" left an admin looking at a draft they could discard
                    but not open, which is the wrong way round. */}
                {canDiscard && (
                  <button className="nx-btn nx-btn-md nx-btn-primary" onClick={() => router.push(`/sales/booking?draft=${p.drafted_booking_id}`)}
                    style={{ padding: '11px 16px', borderRadius: 14, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    ▸ {mine ? 'Resume' : 'Open Draft'}
                  </button>
                )}
                {canDiscard && (
                  <button className="nx-btn nx-btn-md nx-btn-danger-soft" onClick={() => cancelHold(p.id)} disabled={cancelBusy}
                    style={{ padding: '11px 16px', borderRadius: 14, border: '1.5px solid var(--danger-2)', background: 'var(--danger-soft)', color: 'var(--danger)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    <Icon name="x" /> Discard Draft
                  </button>
                )}
                {!canDiscard && (
                  <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>Only {p.held_by_name || 'the drafter'} or one of this project&rsquo;s booking approvers can resume or discard this.</p>
                )}
                <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={() => setDraftPanelPlot(null)} style={{ padding: '9px 16px', borderRadius: 14, border: 'none', background: 'var(--surface-2)', color: 'var(--text-3)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* In-progress panel — the holder, an admin, or one of the project's booking
          approvers can put a unit somebody selected back on the market. Before this,
          a unit left selected could only be freed by that person or by waiting out
          the expiry, which on a live plot map meant it simply sat there. */}
      {holdPanelPlot && (() => {
        const p = holdPanelPlot;
        const mine = !!p.held_by_name && p.held_by_name === user?.name;
        return (
          <div className="nx-modal-backdrop" onClick={() => !cancelBusy && setHoldPanelPlot(null)} style={overlay}>
            <div className="nx-modal" onClick={(e) => e.stopPropagation()} style={{ ...panel, maxWidth: 360, padding: 22 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Unit {p.number} · In Progress</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: '4px 0 6px' }}>
                {mine ? 'Selected by you' : (p.held_by_name ? `Selected by ${p.held_by_name}` : 'Selected')}
              </div>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 18px' }}>
                Nothing has been submitted for this unit yet. Cancelling puts it back on the market straight away.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button className="nx-btn nx-btn-md nx-btn-danger-soft" onClick={() => cancelHold(p.id)} disabled={cancelBusy}
                  style={{ padding: '11px 16px', borderRadius: 14, border: '1.5px solid var(--danger-2)', background: 'var(--danger-soft)', color: 'var(--danger)', fontWeight: 700, fontSize: 14, cursor: cancelBusy ? 'default' : 'pointer', opacity: cancelBusy ? 0.7 : 1 }}>
                  {cancelBusy ? 'Cancelling…' : <><Icon name="x" /> Cancel In Progress</>}
                </button>
                <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={() => setHoldPanelPlot(null)} disabled={cancelBusy}
                  style={{ padding: '9px 16px', borderRadius: 14, border: 'none', background: 'var(--surface-2)', color: 'var(--text-3)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
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
          <div className="nx-modal-backdrop" onClick={() => !resaleBusy && setSoldPanelPlot(null)} style={overlay}>
            <div className="nx-modal" onClick={(e) => e.stopPropagation()} style={{ ...panel, maxWidth: 360, padding: 22 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Unit {p.number} · Sold</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: '4px 0 18px' }}>
                {p.agent_name ? `Sold by ${p.agent_name}` : 'Sold'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button className="nx-btn nx-btn-md nx-btn-primary" onClick={() => moveToResaleFromPanel(p.id)} disabled={resaleBusy}
                  style={{ padding: '11px 16px', borderRadius: 14, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: resaleBusy ? 'default' : 'pointer', opacity: resaleBusy ? 0.7 : 1 }}>
                  {resaleBusy ? 'Moving…' : '↻ Move to Resale'}
                </button>
                <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={() => setSoldPanelPlot(null)} disabled={resaleBusy}
                  style={{ padding: '9px 16px', borderRadius: 14, border: 'none', background: 'var(--surface-2)', color: 'var(--text-3)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
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
    <div className="nx-modal-backdrop" onClick={onClose} style={overlay}>
      <div className="nx-modal" onClick={(e) => e.stopPropagation()} style={panel}>
        {/* Header */}
        <div style={{ padding: '18px 20px', background: cfg.bg, borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: cfg.text, opacity: 0.8 }}>Unit No.</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: cfg.text }}>{plot.number}</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {plot.cluster_type && (
              <span style={{ fontSize: 11, fontWeight: 800, padding: '5px 10px', borderRadius: 8, background: 'var(--surface)', color: 'var(--accent)', border: '1px solid var(--blue-2)' }}>
                {plot.cluster_type}
              </span>
            )}
            <span className="nx-badge" style={{ fontSize: 11, fontWeight: 800, padding: '5px 12px', borderRadius: 20, background: 'var(--surface)', color: cfg.dot, border: `1px solid color-mix(in srgb, ${cfg.dot} 33%, transparent)` }}>
              {cfg.label}{plot.held_by_name && plot.status === 'hold' ? ` · ${plot.held_by_name}` : ''}
            </span>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', fontSize: 15, color: 'var(--text-2)' }}><Icon name="x" /></button>
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
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 10 }}>
                Floor Plan Layouts
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {typePlans.map((fp, i) => (
                  <button key={i} onClick={() => setViewing(fp.url)} style={planBtn}><Icon name="search" /> {fp.label}</button>
                ))}
              </div>
            </div>
          )}

          {/* Booking & closure are both handled by the booking web app (own login,
              auto-LOI, Google Sheet). The button opens it in the same window. */}
          <button className="nx-btn nx-btn-lg nx-btn-success" onClick={openBookingScript} style={primaryBtn}>
            {sv ? `Record Closure for Unit ${plot.number}` : `Book Unit ${plot.number}`}
          </button>
        </div>
      </div>

      {/* Lightbox */}
      {viewing && (
        <div className="nx-modal-backdrop" onClick={() => setViewing(null)} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          {isPdfUrl(viewing)
            ? <embed src={viewing} type="application/pdf" style={{ width: '90vw', height: '88vh', borderRadius: 8 }} />
            : <img src={viewing} alt="Layout" style={{ maxWidth: '92vw', maxHeight: '90vh', borderRadius: 8, boxShadow: '0 10px 50px rgba(0,0,0,0.5)' }} />}
          <button onClick={() => setViewing(null)} style={{ position: 'absolute', top: 20, right: 24, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '50%', width: 40, height: 40, fontSize: 18, cursor: 'pointer' }}><Icon name="x" /></button>
        </div>
      )}
    </div>
  );
}

function InfoBox({ label, value, full }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : 'auto', borderRadius: 16, padding: '12px 14px', background: 'var(--accent-softer)', border: '1px solid var(--surface-3)' }}>
      <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
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

const overlay    = { position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(4,8,16,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
const panel      = { background: 'var(--surface)', borderRadius: 18, width: '94%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(var(--ink-rgb),0.22)' };
const planBtn    = { padding: '11px', borderRadius: 16, fontSize: 12, fontWeight: 700, color: 'var(--warning)', background: 'rgba(163,103,26,0.08)', border: '1px solid rgba(163,103,26,0.22)', cursor: 'pointer' };
const primaryBtn = { width: '100%', padding: '12px', background: 'var(--success-solid)', color: '#fff', border: 'none', borderRadius: 16, fontSize: 14, fontWeight: 800, cursor: 'pointer' };
const primaryBtn2 = { padding: '11px 18px', background: 'var(--success-solid)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' };
const selBar     = { position: 'fixed', left: '50%', bottom: 20, transform: 'translateX(-50%)', zIndex: 900, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--surface)', borderRadius: 18, boxShadow: '0 10px 40px rgba(var(--ink-rgb),0.22)', border: '1px solid var(--surface-3)', width: 'min(680px, calc(100% - 40px))' };
const cancelBtn  = { padding: '11px 18px', background: 'var(--surface-2)', color: 'var(--text-3)', border: 'none', borderRadius: 16, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const backBtn    = { padding: '7px 14px', backgroundColor: 'var(--surface-2)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' };
const lbl        = { fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4, display: 'block' };
const inp        = { width: '100%', height: 40, padding: '0 12px', borderRadius: 14, border: '1.5px solid var(--border)', fontSize: 13, boxSizing: 'border-box', outline: 'none', background: 'var(--surface-2)' };
