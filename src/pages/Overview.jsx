import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DataGate, EmptyState } from '../components/States.jsx';
import { PeriodFilter, SiteFilter, useFilters } from '../components/Filters.jsx';
import StatCard from '../components/StatCard.jsx';
import Panel from '../components/Panel.jsx';
import Legend from '../components/Legend.jsx';
import ChartTooltip from '../components/ChartTooltip.jsx';
import GapsNotice from '../components/GapsNotice.jsx';
import { STREAMS, UTILITY_TYPES, aggregateWaste, compareWaste, monthlyWaste, pctChange, utilityYearToDate, wasteBySite, wasteSummary } from '../lib/calc.js';
import { addMonths, sameMonthsLastYear, yearToDate } from '../lib/periods.js';
import * as fmt from '../lib/format.js';

export const STREAM_COLORS = { recycling: 'var(--s1)', reuse: 'var(--s2)', composting: 'var(--s3)', wte: 'var(--s4)', landfill: 'var(--s5)' };

export default function Overview() {
  return <DataGate>{(data) => <OverviewBody data={data} />}</DataGate>;
}

function OverviewBody({ data }) {
  const f = useFilters(data);
  const { goal, goalPercent, wteCounts } = data.settings;
  const opts = { goal, wteCounts };

  const head = (
    <>
      <div className="page-head">
        <h1>Overview</h1>
        <p>Monthly waste diversion against the {goalPercent}% landfill-free goal, plus utilities year to date.</p>
      </div>
      <div className="filters">
        <SiteFilter data={data} filters={f} />
        <PeriodFilter data={data} filters={f} />
      </div>
    </>
  );

  if (!f.months.length) {
    return (
      <>
        {head}
        <EmptyState title="No months in this range" message="Pick a different period." />
      </>
    );
  }

  const agg = aggregateWaste(data.wasteIdx, f.siteIds, f.months);
  if (!agg.streams) {
    return (
      <>
        {head}
        <EmptyState title="No waste data for this selection" message="No complete site months were reported in this period." />
        <GapsNotice missing={agg.missing} sites={data.sites} />
      </>
    );
  }

  const sum = wasteSummary(agg, opts);
  const prevMonths = sameMonthsLastYear(f.months, data.firstMonth);
  // Year over year uses only site months reported in both years (like for like).
  const cmp = prevMonths ? compareWaste(data.wasteIdx, f.siteIds, f.months, prevMonths) : null;
  const prev = cmp && cmp.comparison.streams ? { now: wasteSummary(cmp.current, opts), then: wasteSummary(cmp.comparison, opts) } : null;
  const vsLastYear = (key) => {
    const c = fmt.change(pctChange(prev.now[key], prev.then[key]));
    const n = cmp.missing.length ? ` (${cmp.missing.length} unmatched site months left out)` : '';
    return c ? `${c} vs same months last year${n}` : 'No data for the same months last year';
  };
  const where = f.site ? f.site.name : 'All sites';
  const gapNote = agg.missing.length ? `Leaves out ${agg.missing.length} site ${agg.missing.length === 1 ? 'month' : 'months'} with missing data.` : null;

  return (
    <>
      {head}
      <p className="card-sub" style={{ marginBottom: 8 }}>
        {where}, {f.periodLabel}. Waste-to-energy {wteCounts ? 'is' : 'is not'} counted as diverted.
      </p>
      <div className="cards">
        <StatCard
          label="Diversion rate"
          value={fmt.pct(sum.rate)}
          sub={sum.gap > 0 ? `${fmt.points(sum.gap)} behind the ${goalPercent}% goal` : `Goal of ${goalPercent}% met`}
          note={gapNote}
        >
          <div className="meter" aria-hidden="true">
            <div className="meter-fill" style={{ width: `${Math.min(100, sum.rate * 100)}%` }} />
            <div className="meter-goal" style={{ left: `calc(${goalPercent}% - 1px)` }}>
              <span>Goal {goalPercent}%</span>
            </div>
          </div>
        </StatCard>
        <StatCard label="Total waste" value={fmt.wasteTotal(sum.total, f.isGroup)} sub={prev ? vsLastYear('total') : 'No data for the same months last year'} />
        <StatCard label="Landfill" value={fmt.lb(sum.landfill)} sub={prev ? vsLastYear('landfill') : 'No data for the same months last year'} />
        <StatCard label="Pounds still to divert" value={fmt.lb(sum.stillToDivert)} sub={`Landfill above the ${goalPercent}% goal`} />
        <StatCard label="Waste-to-energy share" value={fmt.pct(sum.wteShare)} sub={prev ? vsLastYear('wteShare') : 'No data for the same months last year'} />
      </div>

      <GapsNotice missing={agg.missing} sites={data.sites} />

      <div className="grid-2">
        <RateTrend data={data} f={f} opts={opts} />
        <SiteRates data={data} f={f} opts={opts} />
      </div>
      <StreamBars data={data} f={f} opts={opts} />
      <UtilitiesStrip data={data} f={f} />
    </>
  );
}

function RateTrend({ data, f, opts }) {
  const rows = monthlyWaste(data.wasteIdx, f.siteIds, f.months, opts).map((m) => ({
    ...m,
    ratePct: m.rate === null ? null : m.rate * 100,
  }));
  const vals = rows.map((r) => r.ratePct).filter((v) => v !== null);
  const lo = Math.floor(Math.min(...vals, data.settings.goalPercent) - 1);
  const partial = rows.filter((r) => r.rate !== null && r.sitesCovered < r.sitesTotal);
  const gaps = rows.filter((r) => r.rate === null);
  const foot = [
    partial.length ? `Based on fewer sites: ${partial.map((r) => `${fmt.monthLabel(r.month)} (${r.sitesCovered} of ${r.sitesTotal})`).join(', ')}.` : null,
    gaps.length ? `No data, shown as a break in the line: ${gaps.map((r) => fmt.monthLabel(r.month)).join(', ')}.` : null,
    `Axis starts at ${lo}% to show month to month change.`,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Panel title="Monthly diversion rate (%)" subtitle="Diverted pounds as a share of total pounds, each month" foot={foot}>
      <Legend
        items={[
          { label: 'Diversion rate', color: 'var(--s1)', kind: 'line' },
          { label: `Goal ${data.settings.goalPercent}%`, kind: 'dash' },
        ]}
      />
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="month" tickFormatter={fmt.monthTick} minTickGap={16} />
          <YAxis domain={[lo, 100]} tickFormatter={(v) => `${v}%`} width={52} />
          <ReferenceLine y={data.settings.goalPercent} stroke="var(--goal)" strokeDasharray="5 4" strokeWidth={1.5} />
          <Tooltip
            content={
              <ChartTooltip
                title={(r) => fmt.monthLabel(r.month)}
                rows={(r) => [['Diversion rate', fmt.pct(r.rate)]]}
                note={(r) => (r.rate === null ? 'No data reported' : r.sitesCovered < r.sitesTotal ? `Based on ${r.sitesCovered} of ${r.sitesTotal} sites` : null)}
              />
            }
          />
          <Line type="linear" dataKey="ratePct" stroke="var(--s1)" strokeWidth={2} dot={{ r: 3, fill: 'var(--s1)' }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </Panel>
  );
}

function SiteRates({ data, f, opts }) {
  const rows = wasteBySite(
    data.wasteIdx,
    data.sites.map((s) => s.id),
    f.months,
    opts,
  )
    .filter((r) => r.rate !== null)
    .map((r) => {
      const site = data.sites.find((s) => s.id === r.siteId);
      const selected = f.site?.id === r.siteId;
      return { ...r, name: `${site.name}${selected ? ' (selected)' : ''}`, ratePct: r.rate * 100 };
    })
    .sort((a, b) => a.rate - b.rate);
  const short = rows.filter((r) => r.missingMonths > 0);

  return (
    <Panel
      title="Diversion rate by site (%)"
      subtitle={`${f.periodLabel}, lowest first. Always shows all sites.`}
      foot={short.length ? `Missing months left out: ${short.map((r) => `${r.name} (${r.missingMonths})`).join(', ')}.` : null}
    >
      <Legend items={[{ label: 'Diversion rate', color: 'var(--s1)' }, { label: `Goal ${data.settings.goalPercent}%`, kind: 'dash' }]} />
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }} barCategoryGap={8}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} />
          <YAxis type="category" dataKey="name" width={110} />
          <ReferenceLine x={data.settings.goalPercent} stroke="var(--goal)" strokeDasharray="5 4" strokeWidth={1.5} />
          <Tooltip
            cursor={{ fill: 'var(--grid)', opacity: 0.4 }}
            content={
              <ChartTooltip
                title={(r) => r.name}
                rows={(r) => [
                  ['Diversion rate', fmt.pct(r.rate)],
                  ['Total waste', fmt.lb(r.total)],
                  ['Landfill', fmt.lb(r.landfill)],
                ]}
                note={(r) => (r.missingMonths ? `${r.missingMonths} missing months left out` : null)}
              />
            }
          />
          <Bar dataKey="ratePct" fill="var(--s1)" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            <LabelList dataKey="rate" position="insideRight" formatter={(v) => fmt.pct(v)} fill="#ffffff" style={{ fill: '#ffffff', fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Panel>
  );
}

function StreamBars({ data, f, opts }) {
  const rows = monthlyWaste(data.wasteIdx, f.siteIds, f.months, opts).map((m) => ({ month: m.month, ...(m.streams || {}), total: m.total, sitesCovered: m.sitesCovered, sitesTotal: m.sitesTotal }));
  return (
    <Panel title="Monthly waste by stream (lb)" subtitle="Pounds per month, stacked by stream" foot={rows.some((r) => r.total === null) ? 'Months with no complete data have no bar.' : null}>
      <Legend items={STREAMS.map((s) => ({ label: s.label, color: STREAM_COLORS[s.key] }))} />
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barCategoryGap="20%">
          <CartesianGrid vertical={false} />
          <XAxis dataKey="month" tickFormatter={fmt.monthTick} minTickGap={16} />
          <YAxis tickFormatter={fmt.compact} width={52} />
          <Tooltip
            cursor={{ fill: 'var(--grid)', opacity: 0.4 }}
            content={
              <ChartTooltip
                title={(r) => fmt.monthLabel(r.month)}
                rows={(r) => (r.total === null ? [] : [...STREAMS.slice().reverse().map((s) => [s.label, fmt.lb(r[s.key])]), ['Total', fmt.lb(r.total)]])}
                note={(r) => (r.total === null ? 'No data reported' : r.sitesCovered < r.sitesTotal ? `Based on ${r.sitesCovered} of ${r.sitesTotal} sites` : null)}
              />
            }
          />
          {STREAMS.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId="w"
              fill={STREAM_COLORS[s.key]}
              stroke="var(--surface)"
              strokeWidth={1}
              radius={i === STREAMS.length - 1 ? [4, 4, 0, 0] : 0}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </Panel>
  );
}

function UtilitiesStrip({ data, f }) {
  const ytd = yearToDate(data.lastMonth);
  const lastYear = ytd.map((m) => addMonths(m, -12));
  const span = (ms) => `${fmt.monthShort(ms[0])} to ${fmt.monthLabel(ms[ms.length - 1])}`;
  return (
    <Panel
      title="Utilities, year to date"
      subtitle={`${f.site ? f.site.name : 'All sites'}: ${span(ytd)} against ${span(lastYear)}. Follows the site filter, not the period filter.`}
    >
      <div className="strip">
        {UTILITY_TYPES.map((t) => {
          const r = utilityYearToDate(data.utilIdx, f.siteIds, ytd, lastYear, t.key);
          return (
            <StatCard
              key={t.key}
              label={`${t.label} (${t.unit})`}
              value={fmt.withUnit(r.thisYear, t.unit)}
              sub={`${fmt.withUnit(r.lastYear, t.unit)} same months last year`}
              note={[fmt.change(r.change), r.missing.length ? `${r.missing.length} missing site months left out` : null].filter(Boolean).join('. ')}
            />
          );
        })}
      </div>
    </Panel>
  );
}
