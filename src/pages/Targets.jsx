import { CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DataGate } from '../components/States.jsx';
import Panel from '../components/Panel.jsx';
import ChartTooltip from '../components/ChartTooltip.jsx';
import { aggregateWaste, pctChange, wasteSummary } from '../lib/calc.js';
import { resolvePeriod } from '../lib/periods.js';
import * as fmt from '../lib/format.js';

export default function Targets() {
  return <DataGate>{(data) => <TargetsBody data={data} />}</DataGate>;
}

function TargetsBody({ data }) {
  const { goal, goalPercent, wteCounts } = data.settings;
  const months = resolvePeriod({ kind: 'last12' }, data.firstMonth, data.lastMonth);
  const sum = wasteSummary(aggregateWaste(data.wasteIdx, data.sites.map((s) => s.id), months), { goal, wteCounts });
  const target = data.targets[0];

  return (
    <>
      <div className="page-head">
        <h1>Targets and context</h1>
        <p>The goal the sample data is tracked against, and public context that is kept separate from it.</p>
      </div>

      <Panel title={target.name}>
        <div className="goal-big">{goalPercent}%</div>
        <p>of waste diverted from landfill{target.year ? ` by ${target.year}` : ''}.</p>
        <p className="card-sub">
          Sample data, all sites, last 12 months: {fmt.pct(sum.rate)} diverted.{' '}
          {sum.gap > 0 ? `${fmt.points(sum.gap)} behind the goal.` : 'Goal met.'}
        </p>
        <p className="card-sub">
          Waste-to-energy {wteCounts ? 'is' : 'is not'} counted as diverted (an admin setting). Counting it is a
          judgment call: it keeps waste out of landfill, but burning it is not recycling or reuse.
        </p>
        <p className="card-note">{target.source_note}</p>
      </Panel>

      <Reference reference={data.reference} />
    </>
  );
}

function Reference({ reference }) {
  const base = reference.points[0].value;
  const rows = reference.points.map((p, i) => ({ ...p, change: i === 0 ? null : pctChange(p.value, base) }));
  return (
    <section className="reference" aria-label="Reference, not linked to the sample data">
      <h2>
        {reference.title} ({reference.unit})
      </h2>
      <p className="card-sub">{reference.source_note}</p>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={rows} margin={{ top: 20, right: 40, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" padding={{ left: 20, right: 20 }} />
          <YAxis tickFormatter={fmt.compact} width={52} domain={[0, 'auto']} />
          <Tooltip
            content={<ChartTooltip title={(r) => r.label} rows={(r) => [['Scope 1', `${fmt.int(r.value)} ${reference.unit}`]]} />}
          />
          <Line dataKey="value" stroke="var(--s1)" strokeWidth={2} dot={{ r: 4, fill: 'var(--s1)' }} isAnimationActive={false}>
            <LabelList dataKey="value" position="top" offset={10} formatter={fmt.compact} />
          </Line>
        </LineChart>
      </ResponsiveContainer>
      <p className="chart-foot">Points are spaced evenly, not to scale in time. The last point is a range (2040 to 2050).</p>
      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              <th scope="col">Year</th>
              <th scope="col">Scope 1 emissions ({reference.unit})</th>
              <th scope="col">Change from {reference.points[0].label}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td>{fmt.int(r.value)}</td>
                <td>{r.change === null ? 'baseline' : `${Math.round(r.change * 100)}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="card-note" style={{ marginTop: 8 }}>
        {reference.source_url ? (
          <a href={reference.source_url} target="_blank" rel="noreferrer">
            Source
          </a>
        ) : (
          'Source link: not added yet.'
        )}
      </p>
    </section>
  );
}
