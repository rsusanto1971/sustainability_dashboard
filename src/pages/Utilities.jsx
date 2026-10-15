import { useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DataGate } from '../components/States.jsx';
import { SiteFilter, useFilters } from '../components/Filters.jsx';
import Panel from '../components/Panel.jsx';
import Legend from '../components/Legend.jsx';
import ChartTooltip from '../components/ChartTooltip.jsx';
import { UTILITY_TYPES, sumUtility, utilityYearToDate } from '../lib/calc.js';
import { addMonths, monthRange, yearOf, yearToDate } from '../lib/periods.js';
import * as fmt from '../lib/format.js';

export default function Utilities() {
  return <DataGate>{(data) => <UtilitiesBody data={data} />}</DataGate>;
}

function UtilitiesBody({ data }) {
  const f = useFilters(data);
  const [params] = useSearchParams();
  const type = UTILITY_TYPES.find((t) => t.key === params.get('type')) || UTILITY_TYPES[0];

  return (
    <>
      <div className="page-head">
        <h1>Utilities</h1>
        <p>Electricity, natural gas and water by month. This year is compared with the same months last year.</p>
      </div>
      <div className="tabs" role="tablist" aria-label="Utility type">
        {UTILITY_TYPES.map((t) => (
          <button key={t.key} role="tab" aria-selected={t.key === type.key} onClick={() => f.set({ type: t.key === 'electricity' ? null : t.key })}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="filters">
        <SiteFilter data={data} filters={f} />
      </div>
      <div role="tabpanel">
        <div className="grid-2">
          <YearOverYear data={data} f={f} type={type} />
          <BySite data={data} type={type} />
        </div>
        <MonthlyTable data={data} f={f} type={type} />
      </div>
    </>
  );
}

function YearOverYear({ data, f, type }) {
  const thisYear = yearOf(data.lastMonth);
  const rows = monthRange(`${thisYear}-01-01`, `${thisYear}-12-01`).map((m) => {
    const prev = addMonths(m, -12);
    return {
      month: m,
      thisYear: m <= data.lastMonth ? sumUtility(data.utilIdx, f.siteIds, [m], type.key).value : null,
      lastYear: prev >= data.firstMonth ? sumUtility(data.utilIdx, f.siteIds, [prev], type.key).value : null,
    };
  });
  return (
    <Panel
      title={`${type.label} by month (${type.unit})`}
      subtitle={`${f.site ? f.site.name : 'All sites'}, ${thisYear} against ${thisYear - 1}`}
      foot={`${thisYear} data runs to ${fmt.monthLabel(data.lastMonth)}.`}
    >
      <Legend
        items={[
          { label: String(thisYear), color: 'var(--s1)', kind: 'line' },
          { label: String(thisYear - 1), color: 'var(--s2)', kind: 'line' },
        ]}
      />
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="month" tickFormatter={fmt.monthShort} minTickGap={8} />
          <YAxis tickFormatter={fmt.compact} width={52} domain={[0, 'auto']} />
          <Tooltip
            content={
              <ChartTooltip
                title={(r) => fmt.monthShort(r.month)}
                rows={(r) => [
                  [String(thisYear), fmt.withUnit(r.thisYear, type.unit)],
                  [String(thisYear - 1), fmt.withUnit(r.lastYear, type.unit)],
                ]}
              />
            }
          />
          <Line dataKey="lastYear" stroke="var(--s2)" strokeWidth={2} dot={{ r: 3, fill: 'var(--s2)' }} isAnimationActive={false} />
          <Line dataKey="thisYear" stroke="var(--s1)" strokeWidth={2} dot={{ r: 3, fill: 'var(--s1)' }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </Panel>
  );
}

function BySite({ data, type }) {
  const ytd = yearToDate(data.lastMonth);
  const prev = ytd.map((m) => addMonths(m, -12));
  const thisYear = yearOf(data.lastMonth);
  const rows = data.sites.map((s) => {
    const r = utilityYearToDate(data.utilIdx, [s.id], ytd, prev, type.key);
    return { name: s.name, thisYear: r.thisYear, lastYear: r.lastYear, change: r.change };
  });
  return (
    <Panel
      title={`${type.label} by site, year to date (${type.unit})`}
      subtitle={`${fmt.monthShort(ytd[0])} to ${fmt.monthShort(ytd[ytd.length - 1])}, ${thisYear} against the same months of ${thisYear - 1}. Always shows all sites.`}
    >
      <Legend
        items={[
          { label: `${thisYear - 1} same months`, color: 'var(--s2)' },
          { label: `${thisYear} YTD`, color: 'var(--s1)' },
        ]}
      />
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barGap={2}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="name" />
          <YAxis tickFormatter={fmt.compact} width={52} />
          <Tooltip
            cursor={{ fill: 'var(--grid)', opacity: 0.4 }}
            content={
              <ChartTooltip
                title={(r) => r.name}
                rows={(r) => [
                  [`${thisYear} YTD`, fmt.withUnit(r.thisYear, type.unit)],
                  [`${thisYear - 1} same months`, fmt.withUnit(r.lastYear, type.unit)],
                  ['Change', fmt.change(r.change) || fmt.DASH],
                ]}
              />
            }
          />
          <Bar dataKey="lastYear" fill="var(--s2)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="thisYear" fill="var(--s1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </Panel>
  );
}

function MonthlyTable({ data, f, type }) {
  const months = monthRange(data.firstMonth, data.lastMonth).reverse();
  const sites = f.site ? [f.site] : data.sites;
  return (
    <Panel title={`${type.label} monthly table (${type.unit})`} subtitle="Every month, newest first. A blank cell means not reported.">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Month</th>
              {sites.map((s) => (
                <th scope="col" key={s.id}>
                  {s.name}
                </th>
              ))}
              {!f.site && <th scope="col">All sites</th>}
            </tr>
          </thead>
          <tbody>
            {months.map((m) => {
              const total = sumUtility(data.utilIdx, f.siteIds, [m], type.key);
              return (
                <tr key={m}>
                  <th scope="row" style={{ fontWeight: 400 }}>
                    {fmt.monthLabel(m)}
                  </th>
                  {sites.map((s) => {
                    const v = data.utilIdx.get(`${s.id}|${m}|${type.key}`);
                    return <td key={s.id}>{v === undefined ? '' : fmt.int(v)}</td>;
                  })}
                  {!f.site && (
                    <td>
                      <strong>{fmt.int(total.value)}</strong>
                      {total.missing.length > 0 && ` (${sites.length - total.missing.length} of ${sites.length} sites)`}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
