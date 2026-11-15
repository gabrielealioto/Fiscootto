import { formatEur } from "@/lib/finance";

interface Datum {
  label: string;
  entrate: number;
  uscite: number;
}

/** Barre affiancate entrate/uscite in SVG puro. */
export function BarChart({ data }: { data: Datum[] }) {
  const W = 560;
  const H = 220;
  const pad = { top: 12, right: 8, bottom: 28, left: 8 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const max = Math.max(1, ...data.flatMap((d) => [d.entrate, d.uscite]));
  const group = innerW / Math.max(1, data.length);
  const barW = Math.min(28, group * 0.32);
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Entrate e uscite degli ultimi periodi">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={pad.left} x2={W - pad.right} y1={y(max * f)} y2={y(max * f)} className="grid" />
        ))}
        <line x1={pad.left} x2={W - pad.right} y1={y(0)} y2={y(0)} className="axis" />
        {data.map((d, i) => {
          const cx = pad.left + group * i + group / 2;
          return (
            <g key={d.label}>
              <rect x={cx - barW - 2} y={y(d.entrate)} width={barW} height={Math.max(0, y(0) - y(d.entrate))} rx={3} className="bar-in">
                <title>{`${d.label} · entrate ${formatEur(d.entrate)}`}</title>
              </rect>
              <rect x={cx + 2} y={y(d.uscite)} width={barW} height={Math.max(0, y(0) - y(d.uscite))} rx={3} className="bar-out">
                <title>{`${d.label} · uscite ${formatEur(d.uscite)}`}</title>
              </rect>
              <text x={cx} y={H - 8} textAnchor="middle" className="tick">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="legend">
        <span>
          <i className="sw sw-in" /> Entrate
        </span>
        <span>
          <i className="sw sw-out" /> Uscite
        </span>
        <span className="muted">max {formatEur(max)}</span>
      </figcaption>
    </figure>
  );
}
