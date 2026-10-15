export default function StatCard({ label, value, sub, note, children }) {
  return (
    <div className="card">
      <div className="card-label">{label}</div>
      <div className="card-value">{value}</div>
      {children}
      {sub && <div className="card-sub">{sub}</div>}
      {note && <div className="card-note">{note}</div>}
    </div>
  );
}
