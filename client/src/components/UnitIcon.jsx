/**
 * UnitIcon — small inline SVG icon for a unit type.
 * Props: type (string), color (hex string), size (number, default 14)
 */
export default function UnitIcon({ type, color = '#94a3b8', size = 14 }) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const stroke = 'white';
  const strokeProps = { stroke, strokeWidth: 1, strokeOpacity: 0.6, fill: color };

  let shape;
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
      shape = (
        <polygon
          points={`${l},${top} ${r},${top} ${r},${mid} ${cx},${bot} ${l},${mid}`}
          {...strokeProps}
        />
      );
      break;
    }
    case 'Standard': {
      shape = <circle cx={cx} cy={cy} r={s * 0.36} {...strokeProps} />;
      break;
    }
    case 'Mechanized': {
      const rw = s * 0.68;
      const rh = s * 0.52;
      shape = (
        <rect
          x={cx - rw / 2} y={cy - rh / 2}
          width={rw} height={rh}
          rx={2} ry={2}
          {...strokeProps}
        />
      );
      break;
    }
    case 'Artillery': {
      // Upward-pointing triangle
      const tw = s * 0.78;
      const th = s * 0.74;
      const tl = cx - tw / 2;
      const tr = cx + tw / 2;
      const tt = cy - th / 2;
      const tb = cy + th / 2;
      shape = (
        <polygon
          points={`${cx},${tt} ${tr},${tb} ${tl},${tb}`}
          {...strokeProps}
        />
      );
      break;
    }
    case 'Scout': {
      // Diamond (rotated square)
      const d = s * 0.4;
      shape = (
        <polygon
          points={`${cx},${cy - d} ${cx + d},${cy} ${cx},${cy + d} ${cx - d},${cy}`}
          {...strokeProps}
        />
      );
      break;
    }
    case 'Frigate': {
      // Elongated horizontal hexagon (wider than tall)
      const fw = s * 0.82;
      const fh = s * 0.46;
      const fi = fh * 0.45; // inset for angled ends
      shape = (
        <polygon
          points={`${cx - fw / 2 + fi},${cy - fh / 2} ${cx + fw / 2 - fi},${cy - fh / 2} ${cx + fw / 2},${cy} ${cx + fw / 2 - fi},${cy + fh / 2} ${cx - fw / 2 + fi},${cy + fh / 2} ${cx - fw / 2},${cy}`}
          {...strokeProps}
        />
      );
      break;
    }
    case 'Cruiser': {
      // Larger elongated horizontal hexagon
      const cw = s * 0.90;
      const ch = s * 0.58;
      const ci = ch * 0.38;
      shape = (
        <polygon
          points={`${cx - cw / 2 + ci},${cy - ch / 2} ${cx + cw / 2 - ci},${cy - ch / 2} ${cx + cw / 2},${cy} ${cx + cw / 2 - ci},${cy + ch / 2} ${cx - cw / 2 + ci},${cy + ch / 2} ${cx - cw / 2},${cy}`}
          {...strokeProps}
        />
      );
      break;
    }
    default: {
      shape = <circle cx={cx} cy={cy} r={s * 0.3} {...strokeProps} />;
      break;
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      {shape}
    </svg>
  );
}
