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

// hexes: [{ id, q, r, label, sublabel, color, strokeColor }]
export default function HexGrid({ hexes, size = 60, onSelect, onDoubleClick, onBackgroundDoubleClick, selectedId, labelSize, sublabelSize }) {
  if (!hexes || hexes.length === 0) return <p style={{ color: '#94a3b8' }}>Nothing to display.</p>;

  const pixels = hexes.map(h => ({ ...h, ...hexToPixel(h.q, h.r, size) }));

  const xs = pixels.map(p => p.x);
  const ys = pixels.map(p => p.y);
  const pad = size * 1.2;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const maxX = Math.max(...xs) + pad;
  const maxY = Math.max(...ys) + pad;
  const w = maxX - minX;
  const h_ = maxY - minY;

  return (
    <svg
      viewBox={`${minX} ${minY} ${w} ${h_}`}
      style={{ width: '100%', maxHeight: 480, display: 'block' }}
      onDoubleClick={onBackgroundDoubleClick}
    >
      {/* transparent background so double-click fires even on empty space */}
      <rect x={minX} y={minY} width={w} height={h_} fill="transparent" />
      {pixels.map(h => {
        const selected = h.id === selectedId;
        const fill = selected ? '#1d4ed8' : (h.color ?? '#1e293b');
        const stroke = selected ? '#60a5fa' : (h.strokeColor ?? '#475569');
        const strokeWidth = selected ? 2.5 : (h.strokeColor ? 2.5 : 1.5);
        return (
          <g
            key={h.id}
            onClick={() => onSelect?.(h)}
            onDoubleClick={e => { e.stopPropagation(); onDoubleClick?.(h); }}
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
                fill="#e2e8f0"
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
                fill="#94a3b8"
                fontSize={sublabelSize ?? size * 0.17}
                fontFamily="sans-serif"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {h.sublabel}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
