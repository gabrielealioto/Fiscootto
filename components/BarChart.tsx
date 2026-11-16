"use client";

import { useEffect, useRef, useState } from "react";
import { formatEur } from "@/lib/finance";

export interface ChartDatum {
  label: string;
  longLabel: string;
  entrate: number;
  uscite: number;
  utile: number;
}

const compact = new Intl.NumberFormat("it-IT", { notation: "compact", maximumFractionDigits: 1 });

/** Passo "pulito" per l'asse: 1, 2, 2.5 o 5 × 10^n. */
function niceStep(range: number, ticks = 4): number {
  const raw = range / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

/** Entrate e uscite (barre) e profitto (linea) degli ultimi periodi, su un unico asse in euro. */
export function BarChart({ data }: { data: ChartDatum[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const boxRef = useRef<HTMLElement>(null);
  const [W, setW] = useState(640);

  // Il disegno segue la larghezza reale: i testi restano leggibili anche su telefono.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = W < 480 ? 220 : 260;
  const pad = { top: 16, right: 4, bottom: 30, left: 44 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const maxV = Math.max(1, ...data.flatMap((d) => [d.entrate, d.uscite, d.utile]));
  const minV = Math.min(0, ...data.map((d) => d.utile));
  const step = niceStep(maxV - minV);
  const top = Math.ceil(maxV / step) * step;
  const bottom = Math.floor(minV / step) * step;
  const ticks: number[] = [];
  for (let v = bottom; v <= top + step / 2; v += step) ticks.push(Math.round(v));
  const y = (v: number) => pad.top + ((top - v) / (top - bottom)) * innerH;

  const band = innerW / Math.max(1, data.length);
  const barW = Math.max(6, Math.min(24, band * 0.28));
  const cx = (i: number) => pad.left + band * i + band / 2;

  // Barra con angoli arrotondati (4px) solo all'estremità del dato, piatta sulla base.
  const bar = (x: number, v: number, cls: string) => {
    const y0 = y(0);
    const h = Math.max(0, y0 - y(v));
    if (h === 0) return null;
    const r = Math.min(4, h, barW / 2);
    const yt = y0 - h;
    const d = `M${x},${y0} V${yt + r} Q${x},${yt} ${x + r},${yt} H${x + barW - r} Q${x + barW},${yt} ${x + barW},${yt + r} V${y0} Z`;
    return <path d={d} className={cls} />;
  };

  const linePts = data.map((d, i) => `${cx(i)},${y(d.utile)}`).join(" ");
  const h = hover !== null ? data[hover] : null;

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="legend" aria-hidden>
        <span>
          <i style={{ background: "var(--c-in)" }} /> Entrate
        </span>
        <span>
          <i style={{ background: "var(--c-out)" }} /> Uscite
        </span>
        <span>
          <i style={{ background: "var(--c-profit)", height: 3, width: 14, borderRadius: 2 }} /> Profitto
        </span>
      </div>
      <figure ref={boxRef} className="chart" style={{ margin: 0 }} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Entrate, uscite e profitto degli ultimi periodi">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} className={t === 0 ? "baseline" : "gridline"} />
              <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" className="tick">
                {t === 0 ? "0" : `${compact.format(t)} €`}
              </text>
            </g>
          ))}
          {hover !== null && <rect x={pad.left + band * hover + 4} y={pad.top} width={band - 8} height={innerH} rx={8} className="hover-band" />}
          {data.map((d, i) => (
            <g key={d.label}>
              {bar(cx(i) - barW - 1, d.entrate, "bar-in")}
              {bar(cx(i) + 1, d.uscite, "bar-out")}
              <text x={cx(i)} y={H - 8} textAnchor="middle" className={`xlabel ${i === data.length - 1 ? "current" : ""}`}>
                {d.label}
              </text>
            </g>
          ))}
          <polyline points={linePts} fill="none" className="line-profit" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {data.map((d, i) => (
            <circle key={d.label} cx={cx(i)} cy={y(d.utile)} r={hover === i || i === data.length - 1 ? 5 : 4} className="dot-profit" />
          ))}
          {data.map((d, i) => (
            <rect
              key={d.label}
              x={pad.left + band * i}
              y={0}
              width={band}
              height={H}
              className="hit"
              tabIndex={0}
              aria-label={`${d.longLabel}: entrate ${formatEur(d.entrate)}, uscite ${formatEur(d.uscite)}, profitto ${formatEur(d.utile)}`}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            />
          ))}
        </svg>
        {h && hover !== null && (
          <div
            className="chart-tooltip"
            style={{
              left: `${Math.min(82, Math.max(18, (cx(hover) / W) * 100))}%`,
              top: `${(y(Math.max(h.entrate, h.uscite, h.utile)) / H) * 100}%`,
            }}
          >
            <div className="tt-title">{h.longLabel}</div>
            {[
              ["Entrate", h.entrate, "var(--c-in)"],
              ["Uscite", h.uscite, "var(--c-out)"],
              ["Profitto", h.utile, "var(--c-profit)"],
            ].map(([name, v, c]) => (
              <div className="tt-row" key={name as string}>
                <span className="tt-key">
                  <i style={{ background: c as string }} />
                  {name}
                </span>
                <strong>{formatEur(v as number)}</strong>
              </div>
            ))}
          </div>
        )}
      </figure>
      <table className="sr-only">
        <caption>Entrate, uscite e profitto per periodo</caption>
        <thead>
          <tr>
            <th>Periodo</th>
            <th>Entrate</th>
            <th>Uscite</th>
            <th>Profitto</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <td>{d.longLabel}</td>
              <td>{formatEur(d.entrate)}</td>
              <td>{formatEur(d.uscite)}</td>
              <td>{formatEur(d.utile)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
