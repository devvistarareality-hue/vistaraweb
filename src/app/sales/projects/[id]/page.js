'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useParams, useRouter } from 'next/navigation';
import { SALES_ENDPOINTS, authHeaders } from '../../../../constants/api';
import MediaUpload from '../../../../components/MediaUpload';
import { uploadToSupabase } from '../../../../utils/supabaseStorage';
import { pdfToImageBlob } from '../../../../utils/pdfToImage';


const STATUS_CFG = {
  available: { label: 'Available', color: '#2E7D32', bg: '#E8F5E9', border: '#2E7D32', zone: '#22c55e' },
  hold:      { label: 'Hold',      color: '#E65100', bg: '#FFF3E0', border: '#E65100', zone: '#f59e0b' },
  sold:      { label: 'Sold',      color: '#EF4444', bg: '#FEE2E2', border: '#EF4444', zone: '#ef4444' },
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

function SiteMapEditor({ project, plots, onProjectUpdate }) {
  const containerRef = useRef();
  const plotNumRef   = useRef();

  const zones = project.site_map_zones || [];

  // Resolved site map image: prefer site_map_image_url (converted PNG), else master_plan_url if image
  const resolvedImage = project.site_map_image_url
    || (isImageUrl(project.master_plan_url) ? project.master_plan_url : '');

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

  // Auto-convert PDF master plan on first load
  useEffect(() => {
    if (siteMapImage) return;
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
    if (!plot) return '#B8960C';
    return STATUS_CFG[plot.status]?.zone || '#B8960C';
  };

  return (
    <div style={{ backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', marginBottom: 20, boxShadow: '0 2px 8px rgba(184,196,214,0.12)' }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #F0F3FA', background: '#FAFBFF' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#8492A6', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Interactive Site Map
          </div>
          {siteMapImage && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
              background: zones.length === totalPlots ? '#E8F5E9' : '#F0F3FF',
              color: zones.length === totalPlots ? '#2E7D32' : '#3D5AFE' }}>
              {zones.length}/{totalPlots} mapped
            </span>
          )}
        </div>
        <p style={{ fontSize: 12, color: '#8492A6', marginTop: 4 }}>
          Drag rectangles or click polygon vertices over each plot on the master plan. Zones turn green/red automatically based on plot status.
        </p>
        {siteMapImage && totalPlots > 0 && (
          <div style={{ height: 5, borderRadius: 4, background: '#F0F3FA', overflow: 'hidden', marginTop: 8 }}>
            <div style={{ height: '100%', width: `${mappedPct}%`, background: 'linear-gradient(90deg,#3D5AFE,#22c55e)', borderRadius: 4, transition: 'width 0.4s' }} />
          </div>
        )}
      </div>

      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* PDF converting state */}
        {converting && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '28px 20px', background: '#F8F9FF', borderRadius: 10, border: '1px solid #E0E6F0' }}>
            <div style={{ width: 36, height: 36, border: '3px solid #E0E6F0', borderTopColor: '#3D5AFE', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontSize: 13, color: '#3D5AFE', fontWeight: 600 }}>Converting PDF to image…</span>
            <span style={{ fontSize: 11, color: '#8492A6' }}>This may take a few seconds</span>
          </div>
        )}

        {/* Conversion error or no master plan — manual upload fallback */}
        {!siteMapImage && !converting && (
          <div>
            {convertErr && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FCA5A5', fontSize: 12, color: '#DC2626', marginBottom: 12 }}>
                {convertErr} — please upload an image manually below.
              </div>
            )}
            {!project.master_plan_url && (
              <p style={{ fontSize: 12, color: '#8492A6', marginBottom: 10 }}>Upload the master plan on this project first (in the section above), then come back here to draw zones.</p>
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
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E' }}>Draw zones over each plot</span>
              {saving && <span style={{ fontSize: 11, color: '#8492A6' }}>Saving…</span>}
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
                    background: drawMode === m.id ? '#F0F3FF' : '#fff',
                    color:      drawMode === m.id ? '#3D5AFE' : '#8492A6',
                    border:     `1.5px solid ${drawMode === m.id ? '#3D5AFE60' : '#E0E6F0'}`,
                  }}>
                  <span style={{ fontSize: 15 }}>{m.icon}</span>
                  {m.label}
                  <span style={{ fontSize: 10, opacity: 0.6 }}>({m.hint})</span>
                </button>
              ))}
            </div>

            {/* Instruction */}
            <div style={{ padding: '8px 12px', borderRadius: 8, background: '#F8F9FF', border: '1px solid #E0E6F0', fontSize: 12, color: '#5C6BC0', marginBottom: 10 }}>
              {drawMode === 'rect'
                ? <><strong>Drag</strong> on the image to draw a rectangle around a plot, then enter its plot number.</>
                : <><strong>Click</strong> each corner of the plot. <strong>Double-click</strong> or press "Done" to close the shape, then enter plot number.
                    {polyPoints.length > 0 && <strong style={{ color: '#3D5AFE' }}> {polyPoints.length} pts placed{polyPoints.length >= 3 ? ' — ready to close' : ''}</strong>}
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
                borderRadius: 10, overflow: 'hidden',
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
                    fill="none" stroke="#3D5AFE" strokeWidth="0.6" strokeDasharray="2,1.2" />
                )}
                {polyPoints.length >= 3 && cursorPt && (
                  <line x1={polyPoints[polyPoints.length-1].x} y1={polyPoints[polyPoints.length-1].y}
                    x2={polyPoints[0].x} y2={polyPoints[0].y}
                    stroke="#3D5AFE" strokeWidth="0.3" strokeDasharray="1,2" opacity="0.5" />
                )}
                {polyPoints.map((pt, i) => (
                  <circle key={i} cx={pt.x} cy={pt.y} r="1.2" fill="#3D5AFE" stroke="#fff" strokeWidth="0.4" />
                ))}

                {/* Rect live drawing */}
                {currentRect && currentRect.width > 0 && (
                  <rect x={currentRect.x} y={currentRect.y}
                    width={currentRect.width} height={currentRect.height}
                    fill="rgba(61,90,254,0.12)" stroke="#3D5AFE" strokeWidth="0.5" strokeDasharray="2,1.2" />
                )}

                {/* Pending zone */}
                {pendingZone && (
                  pendingZone.points?.length
                    ? <polygon points={pendingZone.points.map(p=>`${p.x},${p.y}`).join(' ')}
                        fill="rgba(61,90,254,0.25)" stroke="#3D5AFE" strokeWidth="0.7" />
                    : <rect x={pendingZone.x} y={pendingZone.y}
                        width={pendingZone.width} height={pendingZone.height}
                        fill="rgba(61,90,254,0.25)" stroke="#3D5AFE" strokeWidth="0.7" rx={0.3} />
                )}
              </svg>

              {/* Zone number labels — HTML pills (crisp, no SVG distortion).
                  Show just the numeric part so type-prefixed plot numbers
                  (e.g. "Karuna24") don't overflow tiny plots. */}
              {zones.map(zone => {
                const { cx, cy } = zoneCenter(zone);
                const color = getZoneColor(zone.plotNumber);
                const labelText = String(zone.plotNumber).replace(/^[^\d]+/, '') || zone.plotNumber;
                return (
                  <div key={zone.id + '-lbl'} style={{
                    position: 'absolute', left: `${cx}%`, top: `${cy}%`, transform: 'translate(-50%,-50%)',
                    pointerEvents: 'none', zIndex: 3, background: 'rgba(255,255,255,0.96)', color: '#1A1A2E',
                    fontWeight: 800, fontSize: 'clamp(6px,0.8vw,11px)', lineHeight: 1, padding: '1px 5px',
                    borderRadius: 4, boxShadow: `0 1px 3px rgba(0,0,0,0.18), 0 0 0 1px ${color}88`, whiteSpace: 'nowrap',
                  }}>{labelText}</div>
                );
              })}
            </div>

            {/* Plot number input */}
            {pendingZone && (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 10, padding: '12px 14px', borderRadius: 10, background: '#F0F3FF', border: '1.5px solid #3D5AFE40' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#3D5AFE' }}>Plot number for this zone:</span>
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
                  <span style={{ fontSize: 12, color: '#8492A6' }}>All plots already mapped.</span>
                )}
                <button onClick={confirmZone} disabled={!plotInput} style={{ ...doneBtn, opacity: plotInput ? 1 : 0.5, cursor: plotInput ? 'pointer' : 'not-allowed' }}>✓ Save Zone</button>
                <button onClick={() => { setPendingZone(null); setPlotInput(''); }} style={ghostBtn}>✕ Discard</button>
              </div>
            )}

            {/* Zone summary */}
            {zones.length > 0 && (
              <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 10, background: '#FAFBFF', border: '1px solid #E0E6F0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1A1A2E' }}>Saved zones ({zones.length})</span>
                  <button onClick={clearAll}
                    style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.07)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer' }}>
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
                  <p style={{ fontSize: 11, color: '#8492A6' }}>
                    <strong style={{ color: '#1A1A2E' }}>Not yet mapped:</strong>{' '}
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
function PlotCard({ plot, onStatusChange, onPlotUpdate, clusterTypes = [] }) {
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

  function openEdit() {
    const p = parseSizeUnit(plot.size);
    setSizeVal(p.sizeVal);
    setSizeUnit(UNITS.includes(p.unit) ? p.unit : 'sqft');
    setEditType(plot.cluster_type || '');
    setEditNum(displayNum);
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
      body: JSON.stringify({ number: newNumber, size: combinedSize, cluster_type: editType.trim() }),
    });
    if (res.ok) { onPlotUpdate(await res.json()); setEditing(false); }
    setSaving(false);
  }

  const inpStyle = { width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E8C97A', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fff' };
  const lblStyle = { fontSize: 10, fontWeight: 700, color: '#B0BAC9', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'block' };

  return (
    <div style={{
      backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden',
      boxShadow: '0 2px 10px rgba(184,196,214,0.18)',
      border: '1.5px solid #E8ECF4',
      opacity: saving ? 0.75 : 1, transition: 'opacity 0.2s',
    }}>
      {/* Header: #num | type badge | status (status always right-aligned) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px 6px' }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#1A1A2E' }}>#{displayNum}</span>
        {plot.cluster_type && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#EDE7F6', color: '#673AB7', whiteSpace: 'nowrap' }}>
            {plot.cluster_type}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
          {cfg.label}
        </span>
      </div>
      {/* Size sub-row — always rendered so all cards stay the same height */}
      <div style={{ padding: '0 14px 4px', fontSize: 11, minHeight: 14, color: plot.size ? '#A0AABA' : '#D1D5DB', fontStyle: plot.size ? 'normal' : 'italic' }}>
        {plot.size || 'Area not set'}
      </div>

      {/* Status toggles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '0 14px 12px' }}>
        {Object.entries(STATUS_CFG).map(([s, c]) => (
          <button key={s} onClick={() => setStatus(s)} disabled={plot.status === s || saving}
            style={{
              padding: '8px 4px', borderRadius: 10, fontSize: 12, fontWeight: 700,
              cursor: plot.status === s ? 'default' : 'pointer',
              background: plot.status === s ? c.bg : '#F5F6FA',
              color: plot.status === s ? c.color : '#B0BAC9',
              border: `1.5px solid ${plot.status === s ? c.border + '60' : 'transparent'}`,
              transition: 'all 0.15s',
            }}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Edit Info button */}
      <div style={{ borderTop: '1px solid #F0F3FA', padding: '10px 14px 12px' }}>
        <button onClick={() => editing ? setEditing(false) : openEdit()}
          style={{ width: '100%', padding: '11px', background: '#182350', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          ✏ Edit Info
        </button>
      </div>

      {/* Expandable edit form */}
      {editing && (
        <div style={{ borderTop: '1px solid #F0F3FA', padding: '14px 14px 16px', display: 'flex', flexDirection: 'column', gap: 12, background: '#FAFBFF' }}>
          {/* Size value + unit */}
          <div>
            <label style={lblStyle}>Label / Size</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={sizeVal} onChange={e => setSizeVal(e.target.value)}
                placeholder="e.g. 5000" type="number" min="0"
                style={{ ...inpStyle, flex: 1 }} />
              <select value={sizeUnit} onChange={e => setSizeUnit(e.target.value)}
                style={{ ...inpStyle, width: 90, flex: 'none', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%238492A6' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: 28 }}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
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
              style={{ flex: 1, padding: '12px', background: '#C9A84C', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)}
              style={{ padding: '12px 20px', background: '#F0F3FA', color: '#8492A6', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
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

  function addFloor(url) {
    const label = newFloorLabel.trim() || `Floor ${(plans[activeType]?.floor_plans.length || 0) + 1}`;
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
    <div style={{ backgroundColor: '#fff', borderRadius: 14, padding: '20px 22px', marginBottom: 20, boxShadow: '0 2px 8px rgba(184,196,214,0.12)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#8492A6', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Plot Type Floor Plans</span>
        {saving && <span style={{ fontSize: 11, color: '#3D5AFE' }}>Saving…</span>}
      </div>

      {/* Type tabs — large cards like reference UI */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        {plans.map((t, i) => {
          const active = activeType === i;
          const count  = t.floor_plans.length;
          return (
            <button key={i} onClick={() => setActiveType(i)} style={{
              padding: '14px 28px', borderRadius: 14,
              border: `2px solid ${active ? '#C4B5E0' : '#E8ECF4'}`,
              background: active ? '#F0EBF8' : '#FAFBFF',
              cursor: 'pointer', textAlign: 'center', minWidth: 130,
              boxShadow: active ? '0 2px 10px rgba(103,58,183,0.10)' : 'none',
              transition: 'all 0.15s',
            }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: active ? '#5E35B1' : '#1A1A2E', marginBottom: 4 }}>{t.name}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: active ? '#9C6FD6' : '#A0AABA' }}>
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
              placeholder="Type name" style={{ height: 38, padding: '0 12px', borderRadius: 10, border: '1.5px solid #673AB7', fontSize: 13, width: 150, outline: 'none' }} />
            <button onClick={addType} style={{ height: 38, padding: '0 14px', background: '#673AB7', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Add</button>
            <button onClick={() => { setAddingType(false); setNewTypeName(''); }} style={{ height: 38, padding: '0 12px', background: '#F0F3FA', color: '#8492A6', border: '1px solid #E0E6F0', borderRadius: 10, fontSize: 13, cursor: 'pointer' }}>✕</button>
          </div>
        ) : (
          <button onClick={() => setAddingType(true)} style={{
            padding: '14px 28px', borderRadius: 14, border: '2px dashed #C4B5E0', background: '#FAF8FF',
            color: '#9C6FD6', fontSize: 14, fontWeight: 700, cursor: 'pointer', minWidth: 130,
          }}>+ Add Type</button>
        )}
      </div>

      {plans.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px', color: '#B0BAC9', fontSize: 13 }}>
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
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#8492A6', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{fp.label}</span>
                    <button onClick={() => removeFloor(activeType, fi)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>✕</button>
                  </div>
                  <img src={fp.url} alt={fp.label}
                    style={{ width: '100%', aspectRatio: '4/3', objectFit: 'contain', borderRadius: 10, background: '#F8F9FB', border: '1px solid #E8ECF4', display: 'block' }} />
                </div>
              ))}
            </div>
          )}

          {/* Upload section */}
          <div style={{ background: '#F8F9FF', borderRadius: 12, padding: '16px', border: '1px solid #EAE4F8' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9C6FD6', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Add Floor Plan to "{current.name}"
            </div>
            <input value={newFloorLabel} onChange={e => setNewFloorLabel(e.target.value)}
              placeholder="Floor label (e.g. Ground Floor, 1st Floor…)"
              style={{ width: '100%', height: 38, padding: '0 12px', borderRadius: 9, border: '1.5px solid #DDD6F3', fontSize: 13, marginBottom: 10, boxSizing: 'border-box', outline: 'none' }} />
            <MediaUpload value="" label=""
              onChange={url => addFloor(url)}
              folder={`erp/projects/${id}/floor-plans`}
              accept="image/*"
              hint="Upload floor plan image (JPG / PNG)" />
          </div>
        </div>
      )}
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
  const [loading, setLoading] = useState(true);
  const [savingMaster, setSavingMaster] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(SALES_ENDPOINTS.project(id), { headers: authHeaders() }).then(r => r.json()),
      fetch(`${SALES_ENDPOINTS.plots}?project=${id}`, { headers: authHeaders() }).then(r => r.json()),
    ]).then(([proj, plotList]) => {
      setProject(proj);
      setPlots(Array.isArray(plotList) ? plotList : []);
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

  const filtered = (filter === 'all' ? plots : plots.filter(p => p.status === filter))
    .slice()
    .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: 'base' }));
  const counts = {
    all:       plots.length,
    available: plots.filter(p => p.status === 'available').length,
    hold:      plots.filter(p => p.status === 'hold').length,
    sold:      plots.filter(p => p.status === 'sold').length,
  };
  const soldPct = plots.length ? Math.round(counts.sold / plots.length * 100) : 0;

  if (loading) return (
    <div style={{ padding: '24px 28px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
      {[...Array(12)].map((_, i) => <div key={i} className="s-skel" style={{ height: 120 }} />)}
    </div>
  );

  if (!project?.name) return (
    <div style={{ padding: '24px 28px', color: '#8492A6' }}>
      Project not found.{' '}
      <button onClick={() => router.back()} style={{ color: '#3D5AFE', background: 'none', border: 'none', cursor: 'pointer' }}>Go back</button>
    </div>
  );

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#8492A6', fontSize: 12, cursor: 'pointer', padding: 0, marginBottom: 6 }}>
            ← Back to Projects
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', marginBottom: 2 }}>{project.name}</h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: 13, color: '#8492A6' }}>
            {project.location && <span>📍 {project.location}</span>}
            {project.total_area && <span>• {project.total_area}</span>}
            {project.price_range && <span>• {project.price_range}</span>}
            {project.possession && <span>• Ready {project.possession}</span>}
            {project.rera && <span>• {project.rera}</span>}
          </div>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, alignSelf: 'flex-start',
          backgroundColor: project.is_active ? '#E8F5E9' : '#FEE2E2',
          color: project.is_active ? '#2E7D32' : '#EF4444',
        }}>
          {project.is_active ? 'ACTIVE' : 'INACTIVE'}
        </span>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Plots', value: plots.length, color: '#1A1A2E' },
          { label: 'Available',   value: counts.available, color: '#2E7D32' },
          { label: 'On Hold',     value: counts.hold,      color: '#E65100' },
          { label: 'Sold',        value: counts.sold,      color: '#EF4444' },
        ].map(s => (
          <div key={s.label} style={{ backgroundColor: '#fff', borderRadius: 12, padding: '14px 18px', boxShadow: '0 2px 8px rgba(184,196,214,0.12)', textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#8492A6', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Progress */}
      {plots.length > 0 && (
        <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: '14px 18px', marginBottom: 20, boxShadow: '0 2px 8px rgba(184,196,214,0.12)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8492A6', marginBottom: 8 }}>
            <span style={{ fontWeight: 600, color: '#1A1A2E' }}>Sales Progress</span>
            <span>{soldPct}% sold</span>
          </div>
          <div style={{ height: 8, borderRadius: 6, background: '#F0F3FA', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${soldPct}%`, background: 'linear-gradient(90deg,#3D5AFE,#E91E63)', borderRadius: 6, transition: 'width 0.5s' }} />
          </div>
        </div>
      )}

      {/* Master Plan */}
      <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: '16px 18px', marginBottom: 20, boxShadow: '0 2px 8px rgba(184,196,214,0.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#8492A6', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Master Plan</div>
          {project.master_plan_url && (
            <a href={project.master_plan_url} target="_blank" rel="noreferrer"
              style={{ fontSize: 12, color: '#3D5AFE', fontWeight: 600, textDecoration: 'none' }}>View Full ↗</a>
          )}
        </div>
        {project.master_plan_url ? (
          <>
            {project.master_plan_url.match(/\.(jpg|jpeg|png|webp|gif)$/i)
              ? <img src={project.master_plan_url} alt="Master Plan" style={{ width: '100%', maxHeight: 380, objectFit: 'contain', borderRadius: 8, border: '1px solid #E0E6F0', background: '#FAFBFF' }} />
              : <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px', background: '#F8F9FE', borderRadius: 8 }}>
                  <span style={{ fontSize: 26 }}>📄</span>
                  <a href={project.master_plan_url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#3D5AFE', fontWeight: 600 }}>Open PDF ↗</a>
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

      {/* Plot Type Floor Plans */}
      <PlotTypePlansEditor project={project} onProjectUpdate={setProject} plots={plots} />

      {/* Interactive Site Map */}
      <SiteMapEditor project={project} plots={plots} onProjectUpdate={setProject} />

      {/* Filter tabs + Delete All */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { key: 'all',       label: 'All',      color: '#1A1A2E', bg: '#F0F3FF', border: '#1A1A2E' },
          { key: 'available', label: 'Available', color: '#2E7D32', bg: '#E8F5E9', border: '#2E7D32' },
          { key: 'hold',      label: 'Hold',      color: '#E65100', bg: '#FFF3E0', border: '#E65100' },
          { key: 'sold',      label: 'Sold',      color: '#EF4444', bg: '#FEE2E2', border: '#EF4444' },
        ].map(({ key, label, color, bg, border }) => (
          <button key={key} onClick={() => setFilter(key)}
            style={{
              padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: filter === key ? bg : '#fff',
              color:      filter === key ? color : '#8492A6',
              border:     `1.5px solid ${filter === key ? border + '60' : '#E0E6F0'}`,
              transition: 'all 0.15s',
            }}>
            {label} <span style={{ opacity: 0.65 }}>({counts[key]})</span>
          </button>
        ))}
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
            style={{ marginLeft: 'auto', padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#FFF5F5', color: '#DC2626', border: '1.5px solid #FECACA' }}>
            🗑 Delete All Plots
          </button>
        )}
      </div>

      {/* Plot grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8492A6' }}>
          <p style={{ fontWeight: 600 }}>No plots with this status.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 12, alignItems: 'start' }}>
          {filtered.map(plot => (
            <PlotCard key={plot.id} plot={plot} onStatusChange={handleStatusChange} onPlotUpdate={handlePlotUpdate}
              clusterTypes={[...new Set(plots.map(p => p.cluster_type).filter(Boolean))]} />
          ))}
        </div>
      )}
    </div>
  );
}

const doneBtn  = { padding: '7px 14px', background: '#182350', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' };
const ghostBtn = { padding: '7px 14px', background: '#F0F3FA', color: '#8492A6', border: '1px solid #E0E6F0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' };
