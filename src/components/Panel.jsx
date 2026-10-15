export default function Panel({ title, subtitle, foot, children }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
      {foot && <div className="chart-foot">{foot}</div>}
    </section>
  );
}
