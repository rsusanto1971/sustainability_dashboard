import { useSearchParams } from 'react-router-dom';
import { monthRange, resolvePeriod, yearOf, yearsInRange } from '../lib/periods.js';
import { monthLabel } from '../lib/format.js';

/**
 * Reads site and period filters from the URL, so links (like the data gaps
 * notice) can open a screen already filtered.
 *   ?site=plant-a  &period=last12 | 2025 | custom  &from=2025-01-01&to=2025-06-01
 */
export function useFilters(data) {
  const [params, setParams] = useSearchParams();
  const siteParam = params.get('site');
  const site = data.sites.find((s) => s.id === siteParam) || null;
  const periodParam = params.get('period') || 'last12';

  let period;
  if (periodParam === 'custom') period = { kind: 'custom', from: params.get('from') || data.firstMonth, to: params.get('to') || data.lastMonth };
  else if (/^\d{4}$/.test(periodParam)) period = { kind: 'year', year: Number(periodParam) };
  else period = { kind: 'last12' };

  const months = resolvePeriod(period, data.firstMonth, data.lastMonth);

  const set = (changes) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === undefined || v === '') next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  };

  return {
    site,
    siteIds: site ? [site.id] : data.sites.map((s) => s.id),
    isGroup: !site,
    period,
    periodParam,
    months,
    periodLabel: describe(period, months),
    set,
  };
}

function describe(period, months) {
  if (!months.length) return 'No months in range';
  const span = months.length === 1 ? monthLabel(months[0]) : `${monthLabel(months[0])} to ${monthLabel(months[months.length - 1])}`;
  if (period.kind === 'last12') return `Last 12 months (${span})`;
  return span;
}

export function SiteFilter({ data, filters }) {
  return (
    <label>
      Site
      <select value={filters.site?.id || 'all'} onChange={(e) => filters.set({ site: e.target.value === 'all' ? null : e.target.value })}>
        <option value="all">All sites</option>
        {data.sites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function PeriodFilter({ data, filters }) {
  const years = yearsInRange(data.firstMonth, data.lastMonth);
  const all = monthRange(data.firstMonth, data.lastMonth);
  const partial = (y) => {
    const inYear = all.filter((m) => yearOf(m) === y);
    return inYear.length < 12 ? ` (${monthLabel(inYear[0]).slice(0, 3)} to ${monthLabel(inYear[inYear.length - 1]).slice(0, 3)} only)` : '';
  };
  return (
    <>
      <label>
        Period
        <select
          value={filters.periodParam}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'custom') filters.set({ period: 'custom', from: filters.months[0] || data.firstMonth, to: filters.months[filters.months.length - 1] || data.lastMonth });
            else filters.set({ period: v === 'last12' ? null : v, from: null, to: null });
          }}
        >
          <option value="last12">Last 12 months</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>
              {y}
              {partial(y)}
            </option>
          ))}
          <option value="custom">Custom range</option>
        </select>
      </label>
      {filters.period.kind === 'custom' && (
        <>
          <label>
            From
            <select value={filters.period.from} onChange={(e) => filters.set({ from: e.target.value })}>
              {all.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </label>
          <label>
            To
            <select value={filters.period.to} onChange={(e) => filters.set({ to: e.target.value })}>
              {all.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
    </>
  );
}
