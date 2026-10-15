/** Tooltip body for Recharts: a title plus label/value rows. */
export default function ChartTooltip({ active, payload, title, rows, note }) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload;
  const n = note ? note(row) : null;
  return (
    <div className="tooltip">
      <div className="tooltip-title">{title(row)}</div>
      {rows(row).map(([k, v]) => (
        <div className="tooltip-row" key={k}>
          <span>{k}</span>
          <strong>{v}</strong>
        </div>
      ))}
      {n && <div className="tooltip-note">{n}</div>}
    </div>
  );
}
