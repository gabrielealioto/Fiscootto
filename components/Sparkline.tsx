/** Mini-andamento a una serie: linea 2px, velatura al 10%, punto finale con anello. */
export function Sparkline({ values, color = "#bff3df", className }: { values: number[]; color?: string; className?: string }) {
  const W = 300;
  const H = 90;
  const p = 6;
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const x = (i: number) => p + (i / (values.length - 1)) * (W - 2 * p);
  const y = (v: number) => p + ((max - v) / span) * (H - 2 * p);
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const last = values.length - 1;
  return (
    <svg className={className} viewBox={`0 0 ${W} ${H}`} aria-hidden>
      <polygon points={`${x(0)},${H} ${pts} ${x(last)},${H}`} fill={color} opacity={0.12} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(last)} cy={y(values[last])} r={4} fill={color} />
    </svg>
  );
}
