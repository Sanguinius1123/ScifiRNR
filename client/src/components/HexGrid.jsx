import { useCallback, useRef, useState } from 'react';

const SQRT3 = Math.sqrt(3);

function hexToPixel(q, r, size) {
  return {
    x: size * (SQRT3 * q + (SQRT3 / 2) * r),
    y: size * (1.5 * r),
  };
}

function hexPoints(cx, cy, size) {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30); // pointy-top
    return `${(cx + size * Math.cos(angle)).toFixed(2)},${(cy + size * Math.sin(angle)).toFixed(2)}`;
  }).join(' ');
}

/**
 * Render an SVG shape for a unit type, centered at (cx, cy) with given size and color.
 * Returns SVG JSX elements (pure SVG, no foreignObject).
 */
function unitShape(type, cx, cy, size, color) {
  const s = size;
  const strokeProps = { stroke: 'white', strokeWidth: 0.8, strokeOpacity: 0.6, fill: color };

  switch (type) {
    case 'Militia': {
      // Shield: pentagon, wider at top, pointed at bottom
      const w = s * 0.72;
      const h = s * 0.82;
      const top = cy - h / 2;
      const bot = cy + h / 2;
      const mid = top + h * 0.55;
      const l = cx - w / 2;
      const r = cx + w / 2;
      return <polygon key="shape" points={`${l},${top} ${r},${top} ${r},${mid} ${cx},${bot} ${l},${mid}`} {...strokeProps} />;
    }
    case 'Standard':
      return <circle key="shape" cx={cx} cy={cy} r={s * 0.36} {...strokeProps} />;
    case 'Mechanized': {
      const rw = s * 0.68;
      const rh = s * 0.52;
      return <rect key="shape" x={cx - rw / 2} y={cy - rh / 2} width={rw} height={rh} rx={2} ry={2} {...strokeProps} />;
    }
    case 'Artillery': {
      // Upward-pointing triangle
      const tw = s * 0.78;
      const th = s * 0.74;
      const tl = cx - tw / 2;
      const tr = cx + tw / 2;
      const tt = cy - th / 2;
      const tb = cy + th / 2;
      return <polygon key="shape" points={`${cx},${tt} ${tr},${tb} ${tl},${tb}`} {...strokeProps} />;
    }
    case 'Scout': {
      // Diamond (rotated square)
      const d = s * 0.4;
      return <polygon key="shape" points={`${cx},${cy - d} ${cx + d},${cy} ${cx},${cy + d} ${cx - d},${cy}`} {...strokeProps} />;
    }
    case 'Frigate': {
      // Elongated horizontal hexagon (wider than tall)
      const fw = s * 0.82;
      const fh = s * 0.46;
      const fi = fh * 0.45;
      return (
        <polygon
          key="shape"
          points={`${cx - fw / 2 + fi},${cy - fh / 2} ${cx + fw / 2 - fi},${cy - fh / 2} ${cx + fw / 2},${cy} ${cx + fw / 2 - fi},${cy + fh / 2} ${cx - fw / 2 + fi},${cy + fh / 2} ${cx - fw / 2},${cy}`}
          {...strokeProps}
        />
      );
    }
    case 'Cruiser': {
      // Larger elongated horizontal hexagon
      const cw = s * 0.90;
      const ch = s * 0.58;
      const ci = ch * 0.38;
      return (
        <polygon
          key="shape"
          points={`${cx - cw / 2 + ci},${cy - ch / 2} ${cx + cw / 2 - ci},${cy - ch / 2} ${cx + cw / 2},${cy} ${cx + cw / 2 - ci},${cy + ch / 2} ${cx - cw / 2 + ci},${cy + ch / 2} ${cx - cw / 2},${cy}`}
          {...strokeProps}
        />
      );
    }
    default:
      return <circle key="shape" cx={cx} cy={cy} r={s * 0.3} {...strokeProps} />;
  }
}

/** Group units by type, sum quantities, sort desc, take top 3. */
function getTopUnits(units = []) {
  const byType = {};
  for (const u of units) {
    const t = u.type ?? 'Unknown';
    byType[t] ??= { type: t, quantity: 0, color: u.realm?.color ?? '#94a3b8' };
    byType[t].quantity += u.quantity ?? 1;
  }
  return Object.values(byType)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 3);
}

// hexes: [{ id, q, r, label, sublabel, color, strokeColor, dimLabel?, units? }]
// units: [{ type, quantity, realm: { color } }]
export default function HexGrid({
  hexes,
  size = 60,
  onSelect,
  onDoubleClick,
  onBackgroundDoubleClick,
  selectedId,
  labelSize,
  sublabelSize,
  panZoom = false,
}) {
  // Compute bounds before hooks (guards against empty so Math.min/max don't blow up).
  const safeHexes = hexes ?? [];
  const pixels = safeHexes.map(h => ({ ...h, ...hexToPixel(h.q, h.r, size) }));
  const xs  = pixels.map(p => p.x);
  const ys  = pixels.map(p => p.y);
  const pad = size * 1.2;
  const minX = xs.length ? Math.min(...xs) - pad : 0;
  const minY = ys.length ? Math.min(...ys) - pad : 0;
  const maxX = xs.length ? Math.max(...xs) + pad : 100;
  const maxY = ys.length ? Math.max(...ys) + pad : 100;
  const natW = maxX - minX;
  const natH = maxY - minY;

  // ── Pan/zoom state — hooks must come before any early returns ───────────────
  const [vb, setVb] = useState({ x: minX, y: minY, width: natW, height: natH });

  const dragRef = useRef(null); // { startClientX, startClientY, startVbX, startVbY, moved }
  const svgRef  = useRef(null);

  // Reset viewBox when the map content changes (different body / new hexes loaded).
  useEffect(() => {
    setVb({ x: minX, y: minY, width: natW, height: natH });
  }, [minX, minY, natW, natH]);

  const handleWheel = useCallback((e) => {
    if (!panZoom) return;
    e.preventDefault();
    setVb(prev => {
      const factor = e.deltaY > 0 ? 1.1 : 0.9; // scroll down = zoom out
      const newW = prev.width * factor;
      // Clamp: 0.2x to 5x of original width
      const clampedW = Math.max(natW * 0.2, Math.min(natW * 5, newW));
      const clampedH = natH * (clampedW / natW);

      // Zoom centered on mouse cursor in SVG coordinate space
      const svg = svgRef.current;
      const rect = svg?.getBoundingClientRect();
      let mx = prev.x + prev.width / 2;
      let my = prev.y + prev.height / 2;
      if (rect) {
        mx = prev.x + (e.clientX - rect.left) * (prev.width  / rect.width);
        my = prev.y + (e.clientY - rect.top)  * (prev.height / rect.height);
      }
      return {
        x: mx - clampedW * ((mx - prev.x) / prev.width),
        y: my - clampedH * ((my - prev.y) / prev.height),
        width:  clampedW,
        height: clampedH,
      };
    });
  }, [panZoom, natW, natH]);

  function handleMouseDown(e) {
    if (!panZoom || e.button !== 0) return;
    dragRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startVbX: vb.x,
      startVbY: vb.y,
      moved: false,
    };
  }

  function handleMouseMove(e) {
    if (!panZoom || !dragRef.current) return;
    const dx = e.clientX - dragRef.current.startClientX;
    const dy = e.clientY - dragRef.current.startClientY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      dragRef.current.moved = true;
    }
    if (!dragRef.current.moved) return;

    const svg = svgRef.current;
    const rect = svg?.getBoundingClientRect();
    if (!rect) return;
    const scaleX = vb.width  / rect.width;
    const scaleY = vb.height / rect.height;

    setVb(prev => ({
      ...prev,
      x: dragRef.current.startVbX - dx * scaleX,
      y: dragRef.current.startVbY - dy * scaleY,
    }));
  }

  function handleMouseUp() {
    if (!panZoom) return;
    dragRef.current = null;
  }

  if (safeHexes.length === 0) return <p style={{ color: '#94a3b8' }}>Nothing to display.</p>;

  const currentVb = panZoom ? vb : { x: minX, y: minY, width: natW, height: natH };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <svg
        ref={svgRef}
        viewBox={`${currentVb.x} ${currentVb.y} ${currentVb.width} ${currentVb.height}`}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: panZoom ? 'grab' : 'default',
          ...(panZoom ? {} : { maxHeight: 480 }),
        }}
        onDoubleClick={e => {
          // Background double-click: only fire if not dragging
          if (panZoom && dragRef.current?.moved) return;
          onBackgroundDoubleClick?.();
        }}
        onWheel={panZoom ? handleWheel : undefined}
        onMouseDown={panZoom ? handleMouseDown : undefined}
        onMouseMove={panZoom ? handleMouseMove : undefined}
        onMouseUp={panZoom ? handleMouseUp : undefined}
        onMouseLeave={panZoom ? handleMouseUp : undefined}
      >
        {/* transparent background so double-click fires even on empty space */}
        <rect x={currentVb.x} y={currentVb.y} width={currentVb.width} height={currentVb.height} fill="transparent" />
        {pixels.map(h => {
          const selected    = h.id === selectedId;
          const fill        = selected ? '#1d4ed8' : (h.color ?? '#1e293b');
          const stroke      = selected ? '#60a5fa' : (h.strokeColor ?? '#475569');
          const strokeWidth = selected ? 2.5 : (h.strokeColor ? 2.5 : 1.5);
          const dimLabel    = h.dimLabel ?? false;

          // Unit icons: stack vertically, offset toward hex center-right
          const topUnits  = (h.units && h.units.length > 0) ? getTopUnits(h.units) : [];
          const iconSize  = Math.max(7, size * 0.14);
          const iconGap   = iconSize + 2;
          const totalIconH = topUnits.length * iconGap - 2;
          // Shift icons up if labels are present to avoid overlap
          const iconOffsetY = (h.label || h.sublabel) ? -size * 0.26 : 0;
          const iconStartY  = h.y - totalIconH / 2 + iconSize / 2 + iconOffsetY;
          const iconX       = h.x + size * 0.28;

          return (
            <g
              key={h.id}
              onClick={e => {
                e.stopPropagation();
                if (panZoom && dragRef.current?.moved) return;
                onSelect?.(h);
              }}
              onDoubleClick={e => {
                e.stopPropagation();
                if (panZoom && dragRef.current?.moved) return;
                onDoubleClick?.(h);
              }}
              style={{ cursor: onSelect ? 'pointer' : 'default' }}
            >
              <polygon
                points={hexPoints(h.x, h.y, size - 2)}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
              />
              {h.label && (
                <text
                  x={h.x} y={h.sublabel ? h.y - size * 0.12 : h.y + size * 0.08}
                  textAnchor="middle"
                  fill={dimLabel ? '#64748b' : '#e2e8f0'}
                  fontSize={labelSize ?? size * 0.22}
                  fontWeight="600"
                  fontFamily="sans-serif"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {h.label}
                </text>
              )}
              {h.sublabel && (
                <text
                  x={h.x} y={h.y + size * 0.25}
                  textAnchor="middle"
                  fill={dimLabel ? '#475569' : '#94a3b8'}
                  fontSize={sublabelSize ?? size * 0.17}
                  fontFamily="sans-serif"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {h.sublabel}
                </text>
              )}
              {/* Unit icons overlay — visible regions with units */}
              {topUnits.map((u, i) => {
                const icy = iconStartY + i * iconGap;
                return (
                  <g key={u.type} style={{ pointerEvents: 'none' }}>
                    {unitShape(u.type, iconX, icy, iconSize, u.color)}
                    <text
                      x={iconX + iconSize * 0.72}
                      y={icy + iconSize * 0.38}
                      fill="white"
                      fontSize={Math.max(5, iconSize * 0.75)}
                      fontFamily="sans-serif"
                      fontWeight="700"
                      style={{ userSelect: 'none' }}
                    >
                      {u.quantity}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
