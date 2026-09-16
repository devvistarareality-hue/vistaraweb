'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useParams, useRouter } from 'next/navigation';
import { SALES_ENDPOINTS, authHeaders } from '../../../../constants/api';
import { stripPlotPrefix } from '../../../../lib/plotNumber';
import MediaUpload from '../../../../components/MediaUpload';
import TowerFloorBuilder from '../../../../components/TowerFloorBuilder';
import { toPlanImage } from '../../../../utils/planImage';
import { uploadToSupabase } from '../../../../utils/supabaseStorage';
import { pdfToImageBlob } from '../../../../utils/pdfToImage';
import { fieldFlags } from '../../../../lib/bookingFormulas';


const STATUS_CFG = {
  available: { label: 'Available', color: '#23874A', bg: '#E9FBEA', border: '#23874A', zone: '#23874a' },
  // Covers both a soft pick (auto-expires in 10 min) and a hard hold backed by
  // a pending-approval booking — "Hold" read as one deliberate state and
  // confused which of the two it was. "In Progress" reads correctly for both.
  hold:      { label: 'In Progress', color: '#3A3C40', bg: '#F4F5F7', border: '#3A3C40', zone: '#2F6DB5' },
  sold:      { label: 'Sold',      color: '#D9434B', bg: '#FDECEC', border: '#D9434B', zone: '#d9434b' },
  // A previously-sold unit an admin has put back on the market — bookable
  // exactly like Available, just kept visually distinct (purple, not green)
  // so the team can tell a fresh unit from a resale one at a glance.
  resale:    { label: 'Resale',    color: '#2F6DB5', bg: '#E6F2FF', border: '#2F6DB5', zone: '#a2d2ff' },
};

/* ─── Zone center helper ─── */
function zoneCenter(zone) {
  if (zone.points?.length) {
    return {
      cx: zone.points.reduce((s, p) => s + p.x, 0) / zone.points.length,
      cy: zone.points.reduce((s, p) => s + p.y, 0) / zone.points.length,
    };
  }
  return { cx: zone.x + zone.width / 2, cy: zone.y + zone.height / 2 };
}

/* ─── Interactive Site Map Editor ─── */
const isImageUrl = url => url && /\.(jpg|jpeg|png|webp|gif|svg)(\?|$)/i.test(url);
const isPdfUrl   = url => url && /\.pdf(\?|$)/i.test(url);

/* Drives both the whole-project site map and a single floor's plan. Left unparameterised
   it reads/writes project.site_map_*; a floor passes its own image + zones in and keeps
   them inside its floor_plans entry. Same drawing engine either way. */
function SiteMapEditor({ project, plots, onProjectUpdate, zonesOverride, onZonesChange,
                         imageOverride, onImageChange, heading, blurb, extraHeader }) {
  const containerRef = useRef();
  const plotNumRef   = useRef();
  const scoped = zonesOverride !== undefined;   // a floor supplies its own data

  const zones = scoped ? (zonesOverride || []) : (project.site_map_zones || []);

  // Resolved site map image: prefer site_map_image_url (converted PNG), else master_plan_url if image
  const resolvedImage = scoped ? (imageOverride || '')
    : (project.site_map_image_url || (isImageUrl(project.master_plan_url) ? project.master_plan_url : ''));

  const [siteMapImage, setSiteMapImage] = useState(resolvedImage);
  const [converting,   setConverting]   = useState(false);
  const [convertErr,   setConvertErr]   = useState('');

  const [drawMode,    setDrawMode]    = useState('rect');
  const [drawing,     setDrawing]     = useState(false);
  const [startPt,     setStartPt]     = useState(null);
  const [currentRect, setCurrentRect] = useState(null);
  const [polyPoints,  setPolyPoints]  = useState([]);
  const [cursorPt,    setCursorPt]    = useState(null);
  const [pendingZone, setPendingZone] = useState(null);
  const [plotInput,   setPlotInput]   = useState('');
  const [saving,      setSaving]      = useState(false);

  useEffect(() => { if (scoped) setSiteMapImage(imageOverride || ''); }, [scoped, imageOverride]);

  // Auto-convert PDF master plan on first load (whole-project map only)
  useEffect(() => {
    if (scoped || siteMapImage) return;
    if (!isPdfUrl(project.master_plan_url)) return;
    convertPdf(project.master_plan_url);
  }, [project.master_plan_url]);

  async function convertPdf(pdfUrl) {
    setConverting(true);
    setConvertErr('');
    try {
      const blob = await pdfToImageBlob(pdfUrl, 2);
      const file = new File([blob], 'site_map.png', { type: 'image/png' });
      const { url } = await uploadToSupabase(file, 'erp/projects/sitemaps');
      // Save to project and update local state
      const res = await fetch(SALES_ENDPOINTS.project(project.id), {
        method: 'PATCH', headers: authHeaders(),
        body: JSON.stringify({ site_map_image_url: url }),
      });
      if (res.ok) {
        const updated = await res.json();
        onProjectUpdate(updated);
        setSiteMapImage(url);
      }
    } catch (err) {
      setConvertErr('Could not convert PDF: ' + (err.message || 'unknown error'));
    } finally {
      setConverting(false);
    }
  }

  const totalPlots = plots.length;
  const mappedPct  = totalPlots ? Math.round(zones.length / totalPlots * 100) : 0;

  function getPct(e) {
    const r = containerRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - r.top)  / r.height) * 100)),
    };
  }

  async function persistZones(newZones) {
    if (scoped) { onZonesChange(newZones); return; }
    setSaving(true);
    const res = await fetch(SALES_ENDPOINTS.project(project.id), {
      method: 'PATCH', headers: authHeaders(),
      body: JSON.stringify({ site_map_zones: newZones }),
    });
    if (res.ok) {
      const updated = await res.json();
      onProjectUpdate(updated);
    }
    setSaving(false);
  }

  async function persistSiteMapImage(url) {
    if (scoped) { onImageChange(url); setSiteMapImage(url); return; }
    const res = await fetch(SALES_ENDPOINTS.project(project.id), {
      method: 'PATCH', headers: authHeaders(),
      body: JSON.stringify({ site_map_image_url: url, site_map_zones: [] }),
    });
    if (res.ok) {
      const updated = await res.json();
      onProjectUpdate(updated);
      setSiteMapImage(url);
    }
  }

  /* Rect mode */
  const onMouseDown = (e) => {
    if (drawMode !== 'rect' || pendingZone) return;
    e.preventDefault();
    const pt = getPct(e);
    setStartPt(pt);
    setDrawing(true);
    setCurrentRect({ x: pt.x, y: pt.y, width: 0, height: 0 });
  };

  const onMouseMove = (e) => {
    if (drawMode === 'rect' && drawing && startPt) {
      const pt = getPct(e);
      setCurrentRect({
        x: Math.min(startPt.x, pt.x), y: Math.min(startPt.y, pt.y),
        width: Math.abs(pt.x - startPt.x), height: Math.abs(pt.y - startPt.y),
      });
    }
    if (drawMode === 'polygon' && polyPoints.length > 0 && !pendingZone) {
      setCursorPt(getPct(e));
    }
  };

  const onMouseUp = () => {
    if (drawMode !== 'rect' || !drawing) return;
    setDrawing(false);
    if (currentRect && currentRect.width > 0.8 && currentRect.height > 0.8) {
      setPendingZone(currentRect);
      setTimeout(() => plotNumRef.current?.focus(), 50);
    }
    setCurrentRect(null); setStartPt(null);
  };

  /* Polygon mode */
  const onImageClick = (e) => {
    if (drawMode !== 'polygon' || pendingZone) return;
    e.preventDefault();
    setPolyPoints(prev => [...prev, getPct(e)]);
  };

  const onDoubleClick = (e) => {
    if (drawMode !== 'polygon') return;
    e.preventDefault();
    finishPolygon();
  };

  const finishPolygon = () => {
    if (polyPoints.length < 3) return;
    setPendingZone({ points: [...polyPoints] });
    setPolyPoints([]); setCursorPt(null);
    setTimeout(() => plotNumRef.current?.focus(), 50);
  };

  const cancelPolygon = () => { setPolyPoints([]); setCursorPt(null); };

  /* Confirm / delete zone */
  const confirmZone = async () => {
    const val = plotInput.trim();
    if (!val) return;
    await persistZones([...zones, { id: Date.now(), plotNumber: val, ...pendingZone }]);
    setPendingZone(null); setPlotInput('');
  };

  const deleteZone = (zoneId) => persistZones(zones.filter(z => z.id !== zoneId));

  const clearAll = () => {
    if (!window.confirm('Delete all zones? This cannot be undone.')) return;
    persistZones([]);
  };

  const switchMode = (mode) => {
    setDrawMode(mode);
    setPolyPoints([]); setCursorPt(null);
    setDrawing(false); setCurrentRect(null); setStartPt(null);
    setPendingZone(null); setPlotInput('');
  };

  const previewPoints = drawMode === 'polygon' && polyPoints.length > 0
    ? [...polyPoints, cursorPt].filter(Boolean) : [];

  const mappedNums = new Set(zones.map(z => String(z.plotNumber)));
  const unmapped   = plots.filter(p => !mappedNums.has(String(p.number))).map(p => p.number)
    .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));

  const getZoneColor = (plotNumber) => {
    const plot = plots.find(p => String(p.number) === String(plotNumber));
    if (!plot) return '#A3671A';
    return STATUS_CFG[plot.status]?.zone || '#A3671A';
  };

  return (
    <div style={{ backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 20, boxShadow: '0 2px 8px rgba(140,148,160,0.12)' }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #F4F5F7', background: '#F3F9FF' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6E7278', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {heading || 'Interactive Site Map'}
          </div>
          {siteMapImage && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
              background: zones.length === totalPlots ? '#E9FBEA' : '#F3F9FF',
              color: zones.length === totalPlots ? '#23874A' : '#2F6DB5' }}>
              {zones.length}/{totalPlots} mapped
            </span>
          )}
        </div>
        <p style={{ fontSize: 12, color: '#6E7278', marginTop: 4 }}>
          {blurb || 'Drag rectangles or click polygon vertices over each plot on the master plan. Zones turn green/red automatically based on plot status.'}
        </p>
        {extraHeader}
        {siteMapImage && totalPlots > 0 && (
          <div style={{ height: 5, borderRadius: 4, background: '#F4F5F7', overflow: 'hidden', marginTop: 8 }}>
            <div style={{ height: '100%', width: `${mappedPct}%`, background: 'linear-gradient(90deg,#2F6DB5,#23874a)', borderRadius: 4, transition: 'width 0.4s' }} />
          </div>
        )}
      </div>

      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* PDF converting state */}
        {converting && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '28px 20px', background: '#F3F9FF', borderRadius: 14, border: '1px solid #DFE2E6' }}>
            <div style={{ width: 36, height: 36, border: '3px solid #DFE2E6', borderTopColor: '#2F6DB5', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontSize: 13, color: '#2F6DB5', fontWeight: 600 }}>Converting PDF to image…</span>
            <span style={{ fontSize: 11, color: '#6E7278' }}>This may take a few seconds</span>
          </div>
        )}

        {/* Conversion error or no master plan — manual upload fallback */}
        {!siteMapImage && !converting && (
          <div>
            {convertErr && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: '#FDECEC', border: '1px solid #EF9195', fontSize: 12, color: '#D9434B', marginBottom: 12 }}>
                {convertErr} — please upload an image manually below.
              </div>
            )}
            {!project.master_plan_url && (
              <p style={{ fontSize: 12, color: '#6E7278', marginBottom: 10 }}>Upload the master plan on this project first (in the section above), then come back here to draw zones.</p>
            )}
            <MediaUpload
              value=""
              onChange={url => persistSiteMapImage(url)}
              folder="erp/projects/sitemaps"
              accept="image/*"
              hint="Upload site plan image (JPG or PNG)"
            />
          </div>
        )}

        {/* Draw zones — uses master plan image directly */}
        {siteMapImage && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1D1D1F' }}>Draw zones over each plot</span>
              {saving && <span style={{ fontSize: 11, color: '#6E7278' }}>Saving…</span>}
            </div>

            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {[
                { id: 'rect',    icon: '▭', label: 'Rectangle', hint: 'Drag to draw' },
                { id: 'polygon', icon: '⬡', label: 'Polygon',   hint: 'Click vertices' },
              ].map(m => (
                <button key={m.id} onClick={() => switchMode(m.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    background: drawMode === m.id ? '#F3F9FF' : '#fff',
                    color:      drawMode === m.id ? '#2F6DB5' : '#6E7278',
                    border:     `1.5px solid ${drawMode === m.id ? '#3D5AFE60' : '#DFE2E6'}`,
                  }}>
                  <span style={{ fontSize: 15 }}>{m.icon}</span>
                  {m.label}
                  <span style={{ fontSize: 10, opacity: 0.6 }}>({m.hint})</span>
                </button>
              ))}
            </div>

            {/* Instruction */}
            <div style={{ padding: '8px 12px', borderRadius: 8, background: '#F3F9FF', border: '1px solid #DFE2E6', fontSize: 12, color: '#2F6DB5', marginBottom: 10 }}>
              {drawMode === 'rect'
                ? <><strong>Drag</strong> on the image to draw a rectangle around a plot, then enter its plot number.</>
                : <><strong>Click</strong> each corner of the plot. <strong>Double-click</strong> or press "Done" to close the shape, then enter plot number.
                    {polyPoints.length > 0 && <strong style={{ color: '#2F6DB5' }}> {polyPoints.length} pts placed{polyPoints.length >= 3 ? ' — ready to close' : ''}</strong>}
                  </>
              }
            </div>

            {/* Polygon controls */}
            {drawMode === 'polygon' && polyPoints.length >= 3 && !pendingZone && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <button onClick={finishPolygon} style={doneBtn}>✓ Done ({polyPoints.length} pts)</button>
                <button onClick={cancelPolygon} style={ghostBtn}>✕ Cancel</button>
              </div>
            )}
            {drawMode === 'polygon' && polyPoints.length > 0 && polyPoints.length < 3 && !pendingZone && (
              <div style={{ marginBottom: 10 }}>
                <button onClick={cancelPolygon} style={ghostBtn}>✕ Cancel ({polyPoints.length} pt{polyPoints.length > 1 ? 's' : ''})</button>
              </div>
            )}

            {/* Image + SVG overlay */}
            <div
              ref={containerRef}
              style={{
                position: 'relative', width: '100%', userSelect: 'none',
                cursor: pendingZone ? 'default' : drawMode === 'rect' ? 'crosshair' : 'cell',
                borderRadius: 14, overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              }}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={() => { onMouseUp(); setCursorPt(null); }}
              onClick={onImageClick}
              onDoubleClick={onDoubleClick}
            >
              <img src={siteMapImage} alt="Site Map" draggable={false} style={{ width: '100%', display: 'block', pointerEvents: 'none' }} />

              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                viewBox="0 0 100 100" preserveAspectRatio="none">

                {/* Saved zone shapes (labels rendered as HTML pills below — SVG
                    text gets distorted by preserveAspectRatio="none") */}
                {zones.map(zone => {
                  const color = getZoneColor(zone.plotNumber);
                  const shapeProps = { fill: color + '55', stroke: color, strokeWidth: 0.6 };
                  return (
                    <g key={zone.id}>
                      {zone.points?.length
                        ? <polygon points={zone.points.map(p => `${p.x},${p.y}`).join(' ')} {...shapeProps} />
                        : <rect x={zone.x} y={zone.y} width={zone.width} height={zone.height} rx={0.3} {...shapeProps} />
                      }
                    </g>
                  );
                })}

                {/* Polygon preview */}
                {previewPoints.length > 1 && (
                  <polyline points={previewPoints.map(p => `${p.x},${p.y}`).join(' ')}
                    fill="none" stroke="#2F6DB5" strokeWidth="0.6" strokeDasharray="2,1.2" />
                )}
                {polyPoints.length >= 3 && cursorPt && (
                  <line x1={polyPoints[polyPoints.length-1].x} y1={polyPoints[polyPoints.length-1].y}
                    x2={polyPoints[0].x} y2={polyPoints[0].y}
                    stroke="#2F6DB5" strokeWidth="0.3" strokeDasharray="1,2" opacity="0.5" />
                )}
                {polyPoints.map((pt, i) => (
                  <circle key={i} cx={pt.x} cy={pt.y} r="1.2" fill="#2F6DB5" stroke="#fff" strokeWidth="0.4" />
                ))}

                {/* Rect live drawing */}
                {currentRect && currentRect.width > 0 && (
                  <rect x={currentRect.x} y={currentRect.y}
                    width={currentRect.width} height={currentRect.height}
                    fill="rgba(47,109,181,0.12)" stroke="#2F6DB5" strokeWidth="0.5" strokeDasharray="2,1.2" />
                )}

                {/* Pending zone */}
                {pendingZone && (
                  pendingZone.points?.length
                    ? <polygon points={pendingZone.points.map(p=>`${p.x},${p.y}`).join(' ')}
                        fill="rgba(47,109,181,0.25)" stroke="#2F6DB5" strokeWidth="0.7" />
                    : <rect x={pendingZone.x} y={pendingZone.y}
                        width={pendingZone.width} height={pendingZone.height}
                        fill="rgba(47,109,181,0.25)" stroke="#2F6DB5" strokeWidth="0.7" rx={0.3} />
                )}
              </svg>

              {/* Zone number labels — HTML pills (crisp, no SVG distortion).
                  Show just the numeric part so type-prefixed plot numbers
                  (e.g. "Karuna24") don't overflow tiny plots. */}
              {zones.map(zone => {
                const { cx, cy } = zoneCenter(zone);
                const color = getZoneColor(zone.plotNumber);
                const labelText = stripPlotPrefix(zone.plotNumber);
                return (
                  <div key={zone.id + '-lbl'} style={{
                    position: 'absolute', left: `${cx}%`, top: `${cy}%`, transform: 'translate(-50%,-50%)',
                    pointerEvents: 'none', zIndex: 3, background: 'rgba(255,255,255,0.96)', color: '#1D1D1F',
                    fontWeight: 800, fontSize: 'clamp(6px,0.8vw,11px)', lineHeight: 1, padding: '1px 5px',
                    borderRadius: 4, boxShadow: `0 1px 3px rgba(0,0,0,0.18), 0 0 0 1px ${color}88`, whiteSpace: 'nowrap',
                  }}>{labelText}</div>
                );
              })}
            </div>

            {/* Plot number input */}
            {pendingZone && (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 10, padding: '12px 14px', borderRadius: 14, background: '#F3F9FF', border: '1.5px solid #3D5AFE40' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#2F6DB5' }}>Plot number for this zone:</span>
                {unmapped.length > 0 ? (
                  <select ref={plotNumRef} value={plotInput}
                    onChange={e => setPlotInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && confirmZone()}
                    autoFocus
                    style={{ minWidth: 130, padding: '6px 10px', borderRadius: 8, border: '1.5px solid #3D5AFE60', fontSize: 13, fontWeight: 700, outline: 'none', cursor: 'pointer', background: '#fff' }}>
                    <option value="">Select plot…</option>
                    {unmapped.map(n => <option key={n} value={String(n)}>Plot {n}</option>)}
                  </select>
                ) : (
                  <span style={{ fontSize: 12, color: '#6E7278' }}>All plots already mapped.</span>
                )}
                <button onClick={confirmZone} disabled={!plotInput} style={{ ...doneBtn, opacity: plotInput ? 1 : 0.5, cursor: plotInput ? 'pointer' : 'not-allowed' }}>✓ Save Zone</button>
                <button onClick={() => { setPendingZone(null); setPlotInput(''); }} style={ghostBtn}>✕ Discard</button>
              </div>
            )}

            {/* Zone summary */}
            {zones.length > 0 && (
              <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 14, background: '#F3F9FF', border: '1px solid #DFE2E6' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1D1D1F' }}>Saved zones ({zones.length})</span>
                  <button onClick={clearAll}
                    style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, background: 'rgba(217,67,75,0.07)', color: '#D9434B', border: '1px solid rgba(217,67,75,0.2)', cursor: 'pointer' }}>
                    Clear all
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: unmapped.length > 0 ? 8 : 0 }}>
                  {[...zones].sort((a, b) => String(a.plotNumber).localeCompare(String(b.plotNumber), undefined, { numeric: true }))
                    .map(zone => {
                      const color = getZoneColor(zone.plotNumber);
                      const shape = zone.points?.length ? '⬡' : '▭';
                      return (
                        <div key={zone.id} className="group"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: color + '18', border: `1px solid ${color}55`, color }}>
                          <span style={{ opacity: 0.6, fontSize: 9 }}>{shape}</span>
                          {zone.plotNumber}
                          <button onClick={() => deleteZone(zone.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color, fontSize: 10, lineHeight: 1, opacity: 0.7 }}>✕</button>
                        </div>
                      );
                    })}
                </div>
                {unmapped.length > 0 && (
                  <p style={{ fontSize: 11, color: '#6E7278' }}>
                    <strong style={{ color: '#1D1D1F' }}>Not yet mapped:</strong>{' '}
                    {unmapped.slice(0, 24).join(', ')}{unmapped.length > 24 ? ` +${unmapped.length - 24} more` : ''}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const UNITS = ['sqft', 'sqyrd', 'sqmtr', 'bigha'];

function parseSizeUnit(sizeStr) {
  if (!sizeStr) return { sizeVal: '', unit: 'sqft' };
  const found = UNITS.find(u => sizeStr.toLowerCase().includes(u));
  if (found) return { sizeVal: sizeStr.replace(new RegExp(found, 'i'), '').replace(/[,\s]+$/,'').trim(), unit: found };
  return { sizeVal: sizeStr.trim(), unit: 'sqft' };
}

/* ─── Plot Card ─── */
function PlotCard({ plot, onStatusChange, onPlotUpdate, clusterTypes = [], floorWise = false }) {
  const cfg = STATUS_CFG[plot.status] || STATUS_CFG.available;
  const [saving,  setSaving]  = useState(false);
  const [editing, setEditing] = useState(false);

  // Strip cluster_type prefix → displayNum (e.g. "Ananda1" → "1")
  const displayNum = plot.cluster_type
    ? plot.number.replace(new RegExp('^' + plot.cluster_type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), '')
    : plot.number;

  // Edit state
  const parsedSize = parseSizeUnit(plot.size);
  const [sizeVal,  setSizeVal]  = useState(parsedSize.sizeVal);
  const [sizeUnit, setSizeUnit] = useState(UNITS.includes(parsedSize.unit) ? parsedSize.unit : 'sqft');
  const [editType, setEditType] = useState(plot.cluster_type || '');
  const [editNum,  setEditNum]  = useState(displayNum);
  const [constArea, setConstArea] = useState(plot.construction_area || '');
  // Tower units: which way the flat faces (road commands a premium) and the private
  // terrace area, if any. Both are per-unit and feed the unit's price.
  const [facing, setFacing] = useState(plot.facing || '');
  const [hasTerrace, setHasTerrace] = useState(!!(plot.terrace_area || '').trim());
  const [terraceArea, setTerraceArea] = useState(plot.terrace_area || '');

  function openEdit() {
    const p = parseSizeUnit(plot.size);
    setSizeVal(p.sizeVal);
    setSizeUnit(UNITS.includes(p.unit) ? p.unit : 'sqft');
    setEditType(plot.cluster_type || '');
    setEditNum(displayNum);
    setConstArea(plot.construction_area || '');
    setFacing(plot.facing || '');
    setHasTerrace(!!(plot.terrace_area || '').trim());
    setTerraceArea(plot.terrace_area || '');
    setEditing(true);
  }

  async function setStatus(newStatus) {
    if (plot.status === newStatus || saving) return;
    setSaving(true);
    await onStatusChange(plot.id, newStatus);
    setSaving(false);
  }

  async function saveEdit() {
    setSaving(true);
    const newNumber  = editType.trim() ? `${editType.trim()}${editNum}` : editNum;
    const combinedSize = sizeVal.trim() ? `${sizeVal.trim()} ${sizeUnit}` : '';
    const res = await fetch(SALES_ENDPOINTS.plot(plot.id), {
      method: 'PATCH', headers: authHeaders(),
      body: JSON.stringify({
        number: newNumber, size: combinedSize, construction_area: constArea.trim(), cluster_type: editType.trim(),
        // Clearing the terrace toggle wipes the stored area, so a unit can't keep a
        // stale terrace charge after being switched back.
        ...(floorWise ? { facing, terrace_area: hasTerrace ? terraceArea.trim() : '' } : {}),
      }),
    });
    if (res.ok) { onPlotUpdate(await res.json()); setEditing(false); }
    setSaving(false);
  }

  const inpStyle = { width: '100%', padding: '12px 14px', borderRadius: 16, border: '1.5px solid #F5B453', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fff' };
  const lblStyle = { fontSize: 10, fontWeight: 700, color: '#9A9EA5', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'block' };

  return (
    <div style={{
      backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden',
      boxShadow: '0 2px 10px rgba(140,148,160,0.18)',
      border: '1.5px solid #ECEEF0',
      opacity: saving ? 0.75 : 1, transition: 'opacity 0.2s',
    }}>
      {/* Header: #num | type badge | status (status always right-aligned) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px 6px' }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#1D1D1F' }}>#{displayNum}</span>
        {plot.cluster_type && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#E6F2FF', color: '#2F6DB5', whiteSpace: 'nowrap' }}>
            {plot.cluster_type}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
          {cfg.label}
        </span>
      </div>
      {/* Size sub-row — always rendered so all cards stay the same height. A terrace is
          charged on top of the flat and only half the flats have one, so it is called
          out here rather than hidden behind Edit Info. */}
      <div style={{ padding: '0 14px 4px', fontSize: 11, minHeight: 14, color: plot.size ? '#9A9EA5' : '#C9CDD2', fontStyle: plot.size ? 'normal' : 'italic' }}>
        {plot.size || 'Area not set'}
        {(plot.terrace_area || '').trim() && (
          <span style={{ color: '#2F6DB5', fontWeight: 700, fontStyle: 'normal' }}>
            {' '}+ {plot.terrace_area.trim()} terrace
          </span>
        )}
      </div>

      {/* Status toggles — Resale isn't a generic toggle here (it only ever makes
          sense starting from Sold), so it gets its own conditional button below
          instead of joining this fixed 3-way grid. */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '0 14px 12px' }}>
        {['available', 'hold', 'sold'].map((s) => {
          const c = STATUS_CFG[s];
          return (
            <button key={s} onClick={() => setStatus(s)} disabled={plot.status === s || saving}
              style={{
                padding: '8px 4px', borderRadius: 14, fontSize: 12, fontWeight: 700,
                cursor: plot.status === s ? 'default' : 'pointer',
                background: plot.status === s ? c.bg : '#F4F5F7',
                color: plot.status === s ? c.color : '#9A9EA5',
                border: `1.5px solid ${plot.status === s ? c.border + '60' : 'transparent'}`,
                transition: 'all 0.15s',
              }}>
              {c.label}
            </button>
          );
        })}
      </div>
      {/* Already-sold units can be put back on the market for resale — bookable
          again, shown purple instead of green so it reads as "resold", not new. */}
      {(plot.status === 'sold' || plot.status === 'resale') && (
        <div style={{ padding: '0 14px 12px' }}>
          <button onClick={() => setStatus(plot.status === 'resale' ? 'sold' : 'resale')} disabled={saving}
            style={{
              width: '100%', padding: '8px 4px', borderRadius: 14, fontSize: 12, fontWeight: 700,
              cursor: 'pointer',
              background: plot.status === 'resale' ? STATUS_CFG.resale.bg : '#F4F5F7',
              color: plot.status === 'resale' ? STATUS_CFG.resale.color : '#2F6DB5',
              border: `1.5px solid ${plot.status === 'resale' ? STATUS_CFG.resale.border + '60' : '#7C3AED40'}`,
              transition: 'all 0.15s',
            }}>
            {plot.status === 'resale' ? '↩ Back to Sold' : '↻ Move to Resale'}
          </button>
        </div>
      )}

      {/* Edit Info button */}
      <div style={{ borderTop: '1px solid #F4F5F7', padding: '10px 14px 12px' }}>
        <button onClick={() => editing ? setEditing(false) : openEdit()}
          style={{ width: '100%', padding: '11px', background: '#1D1D1F', border: 'none', borderRadius: 16, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          ✏ Edit Info
        </button>
      </div>

      {/* Expandable edit form */}
      {editing && (
        <div style={{ borderTop: '1px solid #F4F5F7', padding: '14px 14px 16px', display: 'flex', flexDirection: 'column', gap: 12, background: '#F3F9FF' }}>
          {/* Size value + unit */}
          <div>
            <label style={lblStyle}>Label / Size</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={sizeVal} onChange={e => setSizeVal(e.target.value)}
                placeholder="e.g. 5000" type="text" inputMode="decimal"
                style={{ ...inpStyle, flex: 1 }} />
              <select value={sizeUnit} onChange={e => setSizeUnit(e.target.value)}
                style={{ ...inpStyle, width: 90, flex: 'none', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%238492A6' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: 28 }}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          {/* Construction Area — auto-maps into the booking form */}
          <div>
            <label style={lblStyle}>Construction Area (sq.ft)</label>
            <input value={constArea} onChange={e => setConstArea(e.target.value)}
              placeholder="e.g. 1200" type="text" inputMode="decimal" style={inpStyle} />
          </div>
          {/* Tower units: facing drives a price premium, terrace is charged separately. */}
          {floorWise && (
            <>
              <div>
                <label style={lblStyle}>Facing</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[['road', 'Road Facing'], ['garden', 'Garden Facing']].map(([val, label]) => {
                    const on = facing === val;
                    return (
                      <button key={val} type="button" onClick={() => setFacing(on ? '' : val)}
                        style={{ flex: 1, padding: '10px 8px', borderRadius: 16, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                          border: `1.5px solid ${on ? '#2F6DB5' : '#F5B453'}`, background: on ? '#F3F9FF' : '#fff', color: on ? '#2F6DB5' : '#6E7278' }}>
                        {on ? '✓ ' : ''}{label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label style={{ ...lblStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={hasTerrace} onChange={(e) => setHasTerrace(e.target.checked)} />
                  Has Terrace
                </label>
                {hasTerrace && (
                  <input value={terraceArea} onChange={(e) => setTerraceArea(e.target.value)}
                    placeholder="Terrace area (sq.yd) — e.g. 21" type="text" inputMode="decimal" style={inpStyle} />
                )}
              </div>
            </>
          )}

          {/* Cluster/Type + Number */}
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 10 }}>
            <div>
              <label style={{ ...lblStyle, whiteSpace: 'nowrap' }}>Cluster / Type</label>
              {clusterTypes.length > 0 ? (
                <select value={editType} onChange={e => setEditType(e.target.value)}
                  style={{ ...inpStyle, cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%238492A6' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 32 }}>
                  <option value="">— None —</option>
                  {clusterTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              ) : (
                <input value={editType} onChange={e => setEditType(e.target.value)}
                  placeholder="e.g. Ananda" style={inpStyle} />
              )}
            </div>
            <div>
              <label style={lblStyle}>Number</label>
              <input value={editNum} onChange={e => setEditNum(e.target.value)}
                placeholder="1" style={inpStyle} />
            </div>
          </div>
          {/* Save + Cancel */}
          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
            <button onClick={saveEdit} disabled={saving}
              style={{ flex: 1, padding: '12px', background: '#D98A1F', color: '#fff', border: 'none', borderRadius: 16, fontSize: 14, fontWeight: 800, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)}
              style={{ padding: '12px 20px', background: '#F4F5F7', color: '#6E7278', border: 'none', borderRadius: 16, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Floor Map Editor ───
   The tower equivalent of the site map: pick a floor, then draw a zone over each unit
   on that floor's plan. Zones live inside the floor's own floor_plans entry, so every
   floor keeps its own mapping against its own drawing. */
// Remaps a source floor's zone shapes onto a target floor. The shapes (points/rect)
// stay identical — floors 2-7 of the same block are usually drawn on the exact same
// plan — only each zone's plotNumber changes, swapped for the target floor's unit at
// the SAME position in its numbering run (e.g. source's 3rd unit -> target's 3rd
// unit: E-203 -> E-303). A zone whose plotNumber doesn't match the source floor's own
// generated run (hand-typed, doesn't fit the from/to/prefix pattern) is left as-is —
// there's nothing to remap it against, so it copies over literally for the admin to
// fix by hand.
function remapZonesToFloor(sourceFloor, targetFloor) {
  const srcUnits = unitsForFloorNumbers(sourceFloor);
  const destUnits = unitsForFloorNumbers(targetFloor);
  return (sourceFloor.zones || []).map((z) => {
    const idx = srcUnits.indexOf(String(z.plotNumber));
    const plotNumber = (idx !== -1 && destUnits[idx] !== undefined) ? destUnits[idx] : z.plotNumber;
    return { ...z, id: Date.now() + Math.random(), plotNumber };
  });
}

function FloorMapEditor({ project, plots, floors, onFloorsChange }) {
  const withPlan = floors.filter((f) => f.image_url);
  const [sel, setSel] = useState(0);
  const active = withPlan[Math.min(sel, Math.max(withPlan.length - 1, 0))];
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyTargets, setCopyTargets] = useState(() => new Set());

  if (!floors.length) return null;
  if (!withPlan.length) {
    return (
      <div style={{ backgroundColor: '#fff', borderRadius: 16, padding: '18px 20px', marginBottom: 20, boxShadow: '0 2px 8px rgba(140,148,160,0.12)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#6E7278', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Floor Plan Mapping</div>
        <p style={{ fontSize: 12, color: '#6E7278', marginTop: 6 }}>
          Upload a plan for at least one floor above to start mapping its units.
        </p>
      </div>
    );
  }

  const idxInAll = floors.findIndex((f) => f === active);
  // Only this floor's units are mappable — matched by the floor field, falling back to
  // the floor's own numbering run for units created before `floor` was recorded.
  const names = new Set(unitsForFloorNumbers(active));
  // In a multi-block tower every block has its own "1st floor", so the floor number
  // alone is ambiguous — the block prefix on the unit number is what separates them.
  const bp = active.block ? `${active.block}-` : '';
  const floorPlots = plots.filter((p) => {
    if (bp && !String(p.number || '').startsWith(bp)) return false;
    return (p.floor !== null && p.floor !== undefined)
      ? Number(p.floor) === Number(active.floor)
      : names.has(String(p.number));
  });

  const setZones = (zones) => onFloorsChange(floors.map((f, i) => (i === idxInAll ? { ...f, zones } : f)));
  const setImage = (image_url) => onFloorsChange(floors.map((f, i) => (i === idxInAll ? { ...f, image_url, zones: [] } : f)));

  const otherFloors = floors.map((f, i) => ({ f, i })).filter(({ i }) => i !== idxInAll);

  function toggleCopyTarget(i) {
    setCopyTargets((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  function applyCopy() {
    const targets = [...copyTargets];
    if (!targets.length) return;
    const overwriting = targets.some((i) => (floors[i].zones || []).length > 0);
    if (overwriting && !window.confirm(
      `${targets.length} selected floor(s) already have some units mapped — copying will replace their existing mapping. Continue?`
    )) return;
    const next = floors.map((f, i) => {
      if (!targets.includes(i)) return f;
      return { ...f, image_url: f.image_url || active.image_url, zones: remapZonesToFloor(active, f) };
    });
    onFloorsChange(next);
    setCopyOpen(false);
    setCopyTargets(new Set());
  }

  const activeMapped = (active.zones || []).length;

  const picker = (
    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#9A9EA5', textTransform: 'uppercase', letterSpacing: 0.4 }}>Floor</label>
        <select value={sel} onChange={(e) => { setSel(Number(e.target.value)); setCopyOpen(false); }}
          style={{ height: 34, padding: '0 10px', borderRadius: 8, border: '1.5px solid #DFE2E6', fontSize: 13, background: '#fff', cursor: 'pointer' }}>
          {withPlan.map((f, i) => {
            const mapped = (f.zones || []).length;
            const total = unitsForFloorNumbers(f).length;
            const name = `${f.block ? `${f.block} · ` : ''}${f.label || `Floor ${f.floor}`}`;
            return <option key={i} value={i}>{name} — {mapped}/{total} mapped</option>;
          })}
        </select>
        {activeMapped > 0 && otherFloors.length > 0 && (
          <button onClick={() => setCopyOpen((v) => !v)}
            style={{ height: 34, padding: '0 12px', borderRadius: 8, border: '1.5px solid #2F6DB5', background: copyOpen ? '#2F6DB5' : '#F3F9FF', color: copyOpen ? '#fff' : '#2F6DB5', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
            📋 Copy this mapping to other floors…
          </button>
        )}
      </div>

      {copyOpen && (
        <div style={{ border: '1.5px solid #DFE2E6', borderRadius: 14, padding: 12, background: '#F3F9FF' }}>
          <div style={{ fontSize: 12, color: '#6E7278', marginBottom: 8 }}>
            Copies every zone's shape from <b>{active.block ? `${active.block} · ` : ''}{active.label || `Floor ${active.floor}`}</b> onto the floor(s) you pick below, renumbering each one to that floor's matching unit (e.g. unit 3 here → unit 3 there). Pick floors with the identical layout.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            {otherFloors.map(({ f, i }) => {
              const mapped = (f.zones || []).length;
              const total = unitsForFloorNumbers(f).length;
              const name = `${f.block ? `${f.block} · ` : ''}${f.label || `Floor ${f.floor}`}`;
              const checked = copyTargets.has(i);
              return (
                <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, padding: '6px 10px', borderRadius: 8, border: `1.5px solid ${checked ? '#2F6DB5' : '#DFE2E6'}`, background: checked ? '#F3F9FF' : '#fff', cursor: 'pointer', color: '#1D1D1F' }}>
                  <input type="checkbox" checked={checked} onChange={() => toggleCopyTarget(i)} style={{ margin: 0 }} />
                  {name} <span style={{ color: '#9A9EA5' }}>({mapped}/{total})</span>
                </label>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={applyCopy} disabled={!copyTargets.size}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: copyTargets.size ? '#2F6DB5' : '#C9CDD2', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: copyTargets.size ? 'pointer' : 'not-allowed' }}>
              Copy to {copyTargets.size || ''} floor{copyTargets.size === 1 ? '' : 's'}
            </button>
            <button onClick={() => { setCopyOpen(false); setCopyTargets(new Set()); }}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid #DFE2E6', background: '#fff', color: '#6E7278', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <SiteMapEditor
      key={idxInAll}
      project={project}
      plots={floorPlots}
      onProjectUpdate={() => {}}
      zonesOverride={active.zones || []}
      onZonesChange={setZones}
      imageOverride={active.image_url}
      onImageChange={setImage}
      heading="Floor Plan Mapping"
      blurb={`Drag rectangles or click polygon vertices over each unit on the ${active.label || 'floor'} plan. Zones turn green/red automatically based on unit status.`}
      extraHeader={picker}
    />
  );
}

// Unit numbers a floor's rule produces — used to scope plots to a floor and to show
// per-floor mapping progress.
function unitsForFloorNumbers(f) {
  const from = parseInt(f.from, 10), to = parseInt(f.to, 10);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from || to - from > 200) return [];
  const bp = f.block ? `${f.block}-` : '';
  const out = [];
  for (let n = from; n <= to; n++) out.push(`${bp}${f.prefix || ''}${n}`);
  return out;
}

/* ─── Plot Type Floor Plans Editor ─── */
function PlotTypePlansEditor({ project, onProjectUpdate, plots = [] }) {
  const id = project.id;

  const seedPlans = () => {
    const saved = project.plot_type_plans || [];
    if (saved.length > 0) return saved;
    const types = [...new Set(plots.map(p => p.cluster_type).filter(Boolean))].sort();
    return types.map(name => ({ name, floor_plans: [] }));
  };

  const [plans,        setPlans]        = useState(seedPlans);
  const [activeType,   setActiveType]   = useState(0);
  const [newTypeName,  setNewTypeName]  = useState('');
  const [addingType,   setAddingType]   = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [newFloorLabel, setNewFloorLabel] = useState('');

  async function persist(updated) {
    setSaving(true);
    const res = await fetch(SALES_ENDPOINTS.project(id), {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ plot_type_plans: updated }),
    });
    if (res.ok) { const p = await res.json(); onProjectUpdate(p); }
    setSaving(false);
  }

  function addType() {
    const name = newTypeName.trim();
    if (!name) return;
    const updated = [...plans, { name, floor_plans: [] }];
    setPlans(updated); setActiveType(updated.length - 1);
    setNewTypeName(''); setAddingType(false);
    persist(updated);
  }

  function removeType(idx) {
    if (!window.confirm(`Remove plot type "${plans[idx].name}" and all its floor plans?`)) return;
    const updated = plans.filter((_, i) => i !== idx);
    setPlans(updated);
    setActiveType(Math.max(0, activeType - (idx <= activeType ? 1 : 0)));
    persist(updated);
  }

  async function addFloor(rawUrl) {
    const label = newFloorLabel.trim() || `Floor ${(plans[activeType]?.floor_plans.length || 0) + 1}`;
    const { url } = await toPlanImage(rawUrl, `erp/projects/${id}/floor-plans`, label.replace(/\W+/g, '_') || 'plan');
    const updated = plans.map((t, i) => i === activeType
      ? { ...t, floor_plans: [...t.floor_plans, { label, url }] } : t);
    setPlans(updated); setNewFloorLabel(''); persist(updated);
  }

  function removeFloor(typeIdx, floorIdx) {
    const updated = plans.map((t, i) => i === typeIdx
      ? { ...t, floor_plans: t.floor_plans.filter((_, fi) => fi !== floorIdx) } : t);
    setPlans(updated); persist(updated);
  }

  const current = plans[activeType];

  return (
    <div style={{ backgroundColor: '#fff', borderRadius: 18, padding: '20px 22px', marginBottom: 20, boxShadow: '0 2px 8px rgba(140,148,160,0.12)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#6E7278', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Plot Type Floor Plans</span>
        {saving && <span style={{ fontSize: 11, color: '#2F6DB5' }}>Saving…</span>}
      </div>

      {/* Type tabs — large cards like reference UI */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        {plans.map((t, i) => {
          const active = activeType === i;
          const count  = t.floor_plans.length;
          return (
            <button key={i} onClick={() => setActiveType(i)} style={{
              padding: '14px 28px', borderRadius: 18,
              border: `2px solid ${active ? '#A2D2FF' : '#ECEEF0'}`,
              background: active ? '#E6F2FF' : '#F3F9FF',
              cursor: 'pointer', textAlign: 'center', minWidth: 130,
              boxShadow: active ? '0 2px 10px rgba(47,109,181,0.10)' : 'none',
              transition: 'all 0.15s',
            }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: active ? '#2F6DB5' : '#1D1D1F', marginBottom: 4 }}>{t.name}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: active ? '#2F6DB5' : '#9A9EA5' }}>
                {count > 0 ? `${count} plan${count > 1 ? 's' : ''}` : 'No plans yet'}
              </div>
            </button>
          );
        })}

        {/* Add Type */}
        {addingType ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input autoFocus value={newTypeName} onChange={e => setNewTypeName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addType(); if (e.key === 'Escape') { setAddingType(false); setNewTypeName(''); } }}
              placeholder="Type name" style={{ height: 38, padding: '0 12px', borderRadius: 14, border: '1.5px solid #2F6DB5', fontSize: 13, width: 150, outline: 'none' }} />
            <button onClick={addType} style={{ height: 38, padding: '0 14px', background: '#2F6DB5', color: '#fff', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Add</button>
            <button onClick={() => { setAddingType(false); setNewTypeName(''); }} style={{ height: 38, padding: '0 12px', background: '#F4F5F7', color: '#6E7278', border: '1px solid #DFE2E6', borderRadius: 14, fontSize: 13, cursor: 'pointer' }}>✕</button>
          </div>
        ) : (
          <button onClick={() => setAddingType(true)} style={{
            padding: '14px 28px', borderRadius: 18, border: '2px dashed #A2D2FF', background: '#F3F9FF',
            color: '#2F6DB5', fontSize: 14, fontWeight: 700, cursor: 'pointer', minWidth: 130,
          }}>+ Add Type</button>
        )}
      </div>

      {plans.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px', color: '#9A9EA5', fontSize: 13 }}>
          No plot types yet. Add a type (e.g. "Type A", "Villa 3BHK") to upload floor plans.
        </div>
      )}

      {current && (
        <div>
          {/* Floor plan image grid — label above image, remove button on hover */}
          {current.floor_plans.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 20, marginBottom: 20 }}>
              {current.floor_plans.map((fp, fi) => (
                <div key={fi}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#6E7278', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{fp.label}</span>
                    <button onClick={() => removeFloor(activeType, fi)} style={{ background: 'none', border: 'none', color: '#D9434B', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>✕</button>
                  </div>
                  <img src={fp.url} alt={fp.label}
                    style={{ width: '100%', aspectRatio: '4/3', objectFit: 'contain', borderRadius: 14, background: '#F4F5F7', border: '1px solid #ECEEF0', display: 'block' }} />
                </div>
              ))}
            </div>
          )}

          {/* Upload section */}
          <div style={{ background: '#F3F9FF', borderRadius: 16, padding: '16px', border: '1px solid #E6F2FF' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#2F6DB5', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Add Floor Plan to "{current.name}"
            </div>
            <input value={newFloorLabel} onChange={e => setNewFloorLabel(e.target.value)}
              placeholder="Floor label (e.g. Ground Floor, 1st Floor…)"
              style={{ width: '100%', height: 38, padding: '0 12px', borderRadius: 9, border: '1.5px solid #CCE5FF', fontSize: 13, marginBottom: 10, boxSizing: 'border-box', outline: 'none' }} />
            <MediaUpload value="" label=""
              onChange={url => addFloor(url)}
              folder={`erp/projects/${id}/floor-plans`}
              accept="image/*,application/pdf"
              hint="Upload floor plan (JPG / PNG / PDF)" />
          </div>
        </div>
      )}
    </div>
  );
}


/* ─── Rate Master ─── Per-project default rates. Which fields are offered mirrors
   fieldFlags(formula_set) exactly — the same flags the booking form itself uses to
   decide which rate rows to show — so Kalrav/Ankhol get land/dev/construction/
   maintenance rates, Industrial swaps construction for sale-deed/dev-agreement
   rates, and Pratishtha (which prices per unit from Plot.price_book, not a
   project-wide rate) doesn't get a Rate Master at all. Saved values prefill the
   booking form when a plot in this project is picked, but stay editable per
   booking — this only sets the starting point. */
function rateMasterFields(formulaSet) {
  const flags = fieldFlags(formulaSet);
  return [
    { key: 'land_rate', label: 'Land Rate', unit: `${flags.areaUnit}` },
    flags.hasConstructionFields && { key: 'dev_rate', label: 'Development Rate', unit: flags.areaUnit },
    flags.hasConstructionFields && { key: 'const_rate', label: 'Construction Rate', unit: flags.areaUnit },
    flags.hasSaleDeedRate && { key: 'sale_deed_rate', label: 'Sale Deed Rate', unit: 'sq.ft' },
    flags.hasDevAgreement && { key: 'dev_agreement_rate', label: 'Dev Agreement Rate', unit: 'sq.ft' },
    { key: 'maint_rate', label: 'Maintenance Rate', unit: flags.areaUnit },
  ].filter(Boolean);
}

function RateMasterEditor({ project, onProjectUpdate }) {
  const fields = rateMasterFields(project.formula_set);
  const [form, setForm] = useState(() => {
    const seed = {}; fields.forEach((f) => { seed[f.key] = ''; });
    return { ...seed, ...(project.rate_master || {}) };
  });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState('');

  // Pratishtha prices per unit from Plot.price_book — none of these project-wide
  // rate fields apply, so there's nothing for a Rate Master to configure.
  if (project.formula_set === 'pratishtha') return null;

  async function save() {
    setSaving(true);
    const res = await fetch(SALES_ENDPOINTS.project(project.id), {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ rate_master: form }),
    });
    if (res.ok) {
      onProjectUpdate(await res.json());
      setSaved('Saved ✓'); setTimeout(() => setSaved(''), 1500);
    }
    setSaving(false);
  }

  return (
    <div style={{ backgroundColor: '#fff', borderRadius: 16, padding: '16px 18px', marginBottom: 20, boxShadow: '0 2px 8px rgba(140,148,160,0.12)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#6E7278', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rate Master</div>
        {saved && <span style={{ fontSize: 12, fontWeight: 700, color: '#23874A' }}>{saved}</span>}
      </div>
      <p style={{ fontSize: 12, color: '#6E7278', marginBottom: 12 }}>
        Set this project's default rates — they'll prefill automatically when a plot here is booked, but stay editable per booking.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 12, marginBottom: 14 }}>
        {fields.map((f) => (
          <div key={f.key}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#55585E', marginBottom: 4 }}>{f.label} (₹/{f.unit})</label>
            <input type="number" value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              placeholder="Not set" style={{ width: '100%', height: 38, padding: '0 10px', borderRadius: 8, border: '1.5px solid #DFE2E6', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
        ))}
      </div>
      <button onClick={save} disabled={saving}
        style={{ padding: '9px 18px', background: '#2F6DB5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
        {saving ? 'Saving…' : 'Save Rates'}
      </button>
    </div>
  );
}

/* ─── Main Page ─── */
export default function ManagePlotsPage() {
  const { id } = useParams();
  const router = useRouter();
  const user   = useSelector((s) => s.auth.user);

  useEffect(() => {
    if (user && user.role !== 'Admin' && !user.is_staff) router.replace('/sales');
  }, [user]);

  const [project, setProject] = useState(null);
  const [plots,   setPlots]   = useState([]);
  const [filter,  setFilter]  = useState('all');
  // Tower projects only: narrow the grid to one block, then one of its floors.
  // '' means "all" on both.
  const [blockF,  setBlockF]  = useState('');
  const [floorF,  setFloorF]  = useState('');
  const [loading, setLoading] = useState(true);
  const [savingMaster, setSavingMaster] = useState(false);
  // Floor-wise projects: the builder edits these, this page persists them and turns
  // them into unit records.
  const [floorPlans, setFloorPlans] = useState([]);
  const [genBusy, setGenBusy] = useState(false);

  const saveFloorPlans = useCallback(async (next) => {
    const res = await fetch(SALES_ENDPOINTS.project(id), {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ floor_plans: next }),
    });
    if (res.ok) setProject(await res.json());
  }, [id]);

  const generateUnits = useCallback(async (toCreate) => {
    if (!toCreate.length) return;
    setGenBusy(true);
    try {
      await fetch(SALES_ENDPOINTS.plotsBulk, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ project_id: id, plots: toCreate.map((u) => ({ number: u.number, floor: u.floor })) }),
      });
      const fresh = await fetch(`${SALES_ENDPOINTS.plots}?project=${id}`, { headers: authHeaders() }).then((r) => r.json());
      setPlots(Array.isArray(fresh) ? fresh : []);
    } catch (_) { /* surfaced by the unchanged unit count */ }
    setGenBusy(false);
  }, [id]);

  useEffect(() => {
    Promise.all([
      fetch(SALES_ENDPOINTS.project(id), { headers: authHeaders() }).then(r => r.json()),
      fetch(`${SALES_ENDPOINTS.plots}?project=${id}`, { headers: authHeaders() }).then(r => r.json()),
    ]).then(([proj, plotList]) => {
      setProject(proj);
      setPlots(Array.isArray(plotList) ? plotList : []);
      // Seed the builder: saved floors, else a sensible ground-floor starting row.
      const saved = proj?.floor_plans || [];
      setFloorPlans(saved.length ? saved.map((f) => ({ prefix: '', from: '', to: '', ...f }))
        : [{ floor: 0, label: 'Ground', prefix: 'Shop', from: 1, to: 12, image_url: '' }]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const handleStatusChange = useCallback(async (plotId, newStatus) => {
    const res = await fetch(SALES_ENDPOINTS.plot(plotId), {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      const updated = await res.json();
      setPlots(prev => prev.map(p => p.id === plotId ? updated : p));
    }
  }, []);

  const handlePlotUpdate = useCallback((updated) => {
    setPlots(prev => prev.map(p => p.id === updated.id ? updated : p));
  }, []);

  async function saveMasterPlan(url) {
    setSavingMaster(true);
    const res = await fetch(SALES_ENDPOINTS.project(id), {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ master_plan_url: url }),
    });
    if (res.ok) setProject(await res.json());
    setSavingMaster(false);
  }

  // Sort strictly by the numeric plot number (1 → n), ignoring the cluster prefix.
  const plotNumVal = (p) => {
    const disp = p.cluster_type
      ? p.number.replace(new RegExp('^' + p.cluster_type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), '')
      : p.number;
    const m = String(disp).match(/\d+/);
    return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
  };
  // The block a unit belongs to is carried by its number ("A-101"), which is also what
  // makes numbers unique across blocks that repeat the same run.
  const blockOfPlot = (p) => { const m = String(p.number || '').match(/^([A-Za-z]+)-/); return m ? m[1] : ''; };
  const towerBlocks = !project?.floor_wise ? [] : [...new Set(
    (project.floor_plans || []).map(f => f.block || '').filter(Boolean))];
  // Floors offered are the selected block's own — every block numbers its floors from 0,
  // so listing all of them would repeat "1st Floor" once per block.
  const towerFloors = !project?.floor_wise ? [] : (() => {
    const seen = new Map();
    (project.floor_plans || [])
      .filter(f => !blockF || (f.block || '') === blockF)
      .forEach(f => { const n = Number(f.floor) || 0; if (!seen.has(n)) seen.set(n, f.label || `Floor ${n}`); });
    return [...seen.entries()].sort((a, b) => a[0] - b[0]);
  })();

  // Block/floor narrow the pool the status tabs then count and filter, so the tab
  // numbers always describe what is actually on screen.
  const scoped = plots.filter(p =>
    (!blockF || blockOfPlot(p) === blockF) &&
    (floorF === '' || Number(p.floor) === Number(floorF)));
  const filtered = (filter === 'all' ? scoped : scoped.filter(p => p.status === filter))
    .slice()
    // Block first, then floor, then unit number — otherwise every block's "1" sorts
    // together and A/B/C interleave down the grid.
    .sort((a, b) =>
      blockOfPlot(a).localeCompare(blockOfPlot(b))
      || ((a.floor ?? Number.MAX_SAFE_INTEGER) - (b.floor ?? Number.MAX_SAFE_INTEGER))
      || (plotNumVal(a) - plotNumVal(b))
      || a.number.localeCompare(b.number, undefined, { numeric: true }));
  const counts = {
    all:       scoped.length,
    available: scoped.filter(p => p.status === 'available').length,
    hold:      scoped.filter(p => p.status === 'hold').length,
    sold:      scoped.filter(p => p.status === 'sold').length,
  };
  const soldPct = plots.length ? Math.round(plots.filter(p => p.status === 'sold').length / plots.length * 100) : 0;

  if (loading) return (
    <div style={{ padding: '24px 28px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
      {[...Array(12)].map((_, i) => <div key={i} className="s-skel" style={{ height: 120 }} />)}
    </div>
  );

  if (!project?.name) return (
    <div style={{ padding: '24px 28px', color: '#6E7278' }}>
      Project not found.{' '}
      <button onClick={() => router.back()} style={{ color: '#2F6DB5', background: 'none', border: 'none', cursor: 'pointer' }}>Go back</button>
    </div>
  );

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#6E7278', fontSize: 12, cursor: 'pointer', padding: 0, marginBottom: 6 }}>
            ← Back to Projects
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1D1D1F', marginBottom: 2 }}>{project.name}</h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: 13, color: '#6E7278' }}>
            {project.location && <span>📍 {project.location}</span>}
            {project.total_area && <span>• {project.total_area}</span>}
            {project.price_range && <span>• {project.price_range}</span>}
            {project.possession && <span>• Ready {project.possession}</span>}
            {project.rera && <span>• {project.rera}</span>}
          </div>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, alignSelf: 'flex-start',
          backgroundColor: project.is_active ? '#E9FBEA' : '#FDECEC',
          color: project.is_active ? '#23874A' : '#D9434B',
        }}>
          {project.is_active ? 'ACTIVE' : 'INACTIVE'}
        </span>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Plots', value: plots.length, color: '#1D1D1F' },
          { label: 'Available',   value: counts.available, color: '#23874A' },
          { label: 'In Progress', value: counts.hold,      color: '#3A3C40' },
          { label: 'Sold',        value: counts.sold,      color: '#D9434B' },
        ].map(s => (
          <div key={s.label} style={{ backgroundColor: '#fff', borderRadius: 16, padding: '14px 18px', boxShadow: '0 2px 8px rgba(140,148,160,0.12)', textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#6E7278', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Progress */}
      {plots.length > 0 && (
        <div style={{ backgroundColor: '#fff', borderRadius: 16, padding: '14px 18px', marginBottom: 20, boxShadow: '0 2px 8px rgba(140,148,160,0.12)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6E7278', marginBottom: 8 }}>
            <span style={{ fontWeight: 600, color: '#1D1D1F' }}>Sales Progress</span>
            <span>{soldPct}% sold</span>
          </div>
          <div style={{ height: 8, borderRadius: 6, background: '#F4F5F7', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${soldPct}%`, background: 'linear-gradient(90deg,#2F6DB5,#D9434B)', borderRadius: 6, transition: 'width 0.5s' }} />
          </div>
        </div>
      )}

      <RateMasterEditor project={project} onProjectUpdate={setProject} />

      {/* Master Plan — plotted schemes only; a tower is described by its per-floor plans. */}
      {!project.floor_wise && (
      <div style={{ backgroundColor: '#fff', borderRadius: 16, padding: '16px 18px', marginBottom: 20, boxShadow: '0 2px 8px rgba(140,148,160,0.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6E7278', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Master Plan</div>
          {project.master_plan_url && (
            <a href={project.master_plan_url} target="_blank" rel="noreferrer"
              style={{ fontSize: 12, color: '#2F6DB5', fontWeight: 600, textDecoration: 'none' }}>View Full ↗</a>
          )}
        </div>
        {project.master_plan_url ? (
          <>
            {project.master_plan_url.match(/\.(jpg|jpeg|png|webp|gif)$/i)
              ? <img src={project.master_plan_url} alt="Master Plan" style={{ width: '100%', maxHeight: 380, objectFit: 'contain', borderRadius: 8, border: '1px solid #DFE2E6', background: '#F3F9FF' }} />
              : <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px', background: '#F4F5F7', borderRadius: 8 }}>
                  <span style={{ fontSize: 26 }}>📄</span>
                  <a href={project.master_plan_url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#2F6DB5', fontWeight: 600 }}>Open PDF ↗</a>
                </div>
            }
            <div style={{ marginTop: 10 }}>
              <MediaUpload label="Replace master plan" value="" onChange={url => saveMasterPlan(url)}
                folder="erp/projects/masterplans" accept="image/*,application/pdf" hint="Upload a new master plan to replace" />
            </div>
          </>
        ) : (
          <MediaUpload value="" onChange={url => saveMasterPlan(url)}
            folder="erp/projects/masterplans" accept="image/*,application/pdf" hint="Upload master plan — image or PDF" />
        )}
      </div>

      )}

      {/* Layout mode decides which editor applies: a tower is built floor by floor,
          a plotted scheme is positioned on a site map. Set it in Edit Project. */}
      {project.floor_wise ? (
        <>
          <div style={{ backgroundColor: '#fff', borderRadius: 18, padding: '20px 22px', marginBottom: 20, boxShadow: '0 2px 8px rgba(140,148,160,0.12)' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1D1D1F' }}>{project.block_industrial ? '🏭 Block Setup' : '🏢 Floor-wise Setup'}</div>
          <div style={{ fontSize: 12, color: '#6E7278', marginTop: 2, marginBottom: 4 }}>
            {project.block_industrial
              ? "Define each block's unit numbering and plan once it's surveyed."
              : "Define each floor's unit numbering and plan. Ground is floor 0."}
          </div>
          <TowerFloorBuilder
            floors={floorPlans} setFloors={setFloorPlans}
            folder={`erp/projects/${id}/floor-plans`}
            existing={new Set(plots.map((p) => String(p.number)))}
            onPersist={saveFloorPlans}
            industrial={!!project.block_industrial}
            onGenerate={generateUnits} generating={genBusy} />
          </div>
          <FloorMapEditor project={project} plots={plots} floors={floorPlans}
            onFloorsChange={(next) => { setFloorPlans(next); saveFloorPlans(next); }} />
        </>
      ) : (
        <>
          {/* Plot Type Floor Plans */}
          <PlotTypePlansEditor project={project} onProjectUpdate={setProject} plots={plots} />

          {/* Interactive Site Map */}
          <SiteMapEditor project={project} plots={plots} onProjectUpdate={setProject} />
        </>
      )}

      {/* Filter tabs + Delete All */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { key: 'all',       label: 'All',      color: '#1D1D1F', bg: '#F3F9FF', border: '#1D1D1F' },
          { key: 'available', label: 'Available', color: '#23874A', bg: '#E9FBEA', border: '#23874A' },
          { key: 'hold',      label: 'In Progress', color: '#3A3C40', bg: '#F4F5F7', border: '#3A3C40' },
          { key: 'sold',      label: 'Sold',      color: '#D9434B', bg: '#FDECEC', border: '#D9434B' },
        ].map(({ key, label, color, bg, border }) => (
          <button key={key} onClick={() => setFilter(key)}
            style={{
              padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: filter === key ? bg : '#fff',
              color:      filter === key ? color : '#6E7278',
              border:     `1.5px solid ${filter === key ? border + '60' : '#DFE2E6'}`,
              transition: 'all 0.15s',
            }}>
            {label} <span style={{ opacity: 0.65 }}>({counts[key]})</span>
          </button>
        ))}
        {/* A single-block tower has nothing to choose between, so only its floors show. */}
        {towerBlocks.length > 1 && (
          <select value={blockF} onChange={e => { setBlockF(e.target.value); setFloorF(''); }} style={gridSel}>
            <option value="">All Blocks</option>
            {towerBlocks.map(b => <option key={b} value={b}>Block {b}</option>)}
          </select>
        )}
        {towerFloors.length > 1 && (
          <select value={floorF} onChange={e => setFloorF(e.target.value)} style={gridSel}>
            <option value="">All Floors</option>
            {towerFloors.map(([n, label]) => <option key={n} value={n}>{label}</option>)}
          </select>
        )}
        {(blockF || floorF) && (
          <button onClick={() => { setBlockF(''); setFloorF(''); }}
            style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#fff', color: '#6E7278', border: '1.5px solid #DFE2E6' }}>
            ✕ Clear
          </button>
        )}
        {plots.length > 0 && (
          <button onClick={async () => {
            if (!window.confirm(`Delete all ${plots.length} plots for this project? This cannot be undone.`)) return;
            const res = await fetch(SALES_ENDPOINTS.plotsBulkDelete, {
              method: 'DELETE', headers: authHeaders(),
              body: JSON.stringify({ project_id: project.id }),
            });
            if (res.ok) { setPlots([]); }
            else { const e = await res.json(); alert(e.detail || 'Failed to delete plots'); }
          }}
            style={{ marginLeft: 'auto', padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#FDECEC', color: '#D9434B', border: '1.5px solid #F7C3C6' }}>
            🗑 Delete All Plots
          </button>
        )}
      </div>

      {/* Plot grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6E7278' }}>
          <p style={{ fontWeight: 600 }}>
            {blockF || floorF ? 'No plots match this block/floor.' : 'No plots with this status.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 12, alignItems: 'start' }}>
          {filtered.map(plot => (
            <PlotCard key={plot.id} plot={plot} onStatusChange={handleStatusChange} onPlotUpdate={handlePlotUpdate}
              clusterTypes={[...new Set(plots.map(p => p.cluster_type).filter(Boolean))]}
              // Facing/terrace are Pratishtha-tower concepts (a flat facing road vs
              // garden, an optional terrace charged separately) -- meaningless for an
              // industrial shed, so block-wise industrial projects don't get this
              // section even though they also set floor_wise=True to reuse the
              // block/floor-plan machinery.
              floorWise={!!project.floor_wise && !project.block_industrial} />
          ))}
        </div>
      )}
    </div>
  );
}

// Block / Floor pickers above the plot grid — sized to sit level with the status tabs.
const gridSel  = { height: 32, padding: '0 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#1D1D1F', background: '#fff', border: '1.5px solid #DFE2E6', cursor: 'pointer', outline: 'none' };
const doneBtn  = { padding: '7px 14px', background: '#1D1D1F', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' };
const ghostBtn = { padding: '7px 14px', background: '#F4F5F7', color: '#6E7278', border: '1px solid #DFE2E6', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' };
