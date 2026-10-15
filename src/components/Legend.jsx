/** Legend with text labels, so series identity never relies on color alone. */
export default function Legend({ items }) {
  return (
    <ul className="legend">
      {items.map((it) => (
        <li key={it.label}>
          {it.kind === 'line' ? (
            <span className="swatch-line" style={{ borderColor: it.color }} />
          ) : it.kind === 'dash' ? (
            <span className="swatch-dash" />
          ) : (
            <span className="swatch" style={{ background: it.color }} />
          )}
          {it.label}
        </li>
      ))}
    </ul>
  );
}
