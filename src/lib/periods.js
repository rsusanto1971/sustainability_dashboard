// Month helpers. Months are strings for the first day of the month: "2025-01-01".

export function addMonths(month, n) {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1 + n;
  const d = new Date(Date.UTC(y, m, 1));
  return d.toISOString().slice(0, 10);
}

/** Every month from first to last, inclusive. */
export function monthRange(first, last) {
  const out = [];
  for (let m = first; m <= last; m = addMonths(m, 1)) out.push(m);
  return out;
}

export const yearOf = (month) => Number(month.slice(0, 4));
export const monthNumber = (month) => Number(month.slice(5, 7));

/**
 * Turn a period choice into a list of months, clipped to the data range.
 * "Last 12 months" ends at the latest month with data, not today.
 *   { kind: 'last12' }
 *   { kind: 'year', year: 2025 }
 *   { kind: 'custom', from: '2025-03-01', to: '2025-08-01' }
 */
export function resolvePeriod(period, dataFirst, dataLast) {
  let from;
  let to;
  if (period.kind === 'year') {
    from = `${period.year}-01-01`;
    to = `${period.year}-12-01`;
  } else if (period.kind === 'custom' && period.from && period.to) {
    [from, to] = period.from <= period.to ? [period.from, period.to] : [period.to, period.from];
  } else {
    from = addMonths(dataLast, -11);
    to = dataLast;
  }
  if (from < dataFirst) from = dataFirst;
  if (to > dataLast) to = dataLast;
  return from <= to ? monthRange(from, to) : [];
}

/** The same months one year earlier, or null if any fall before the data starts. */
export function sameMonthsLastYear(months, dataFirst) {
  const prev = months.map((m) => addMonths(m, -12));
  return prev.length && prev[0] >= dataFirst ? prev : null;
}

/** Year to date months for the year of `latest`: January up to `latest`. */
export function yearToDate(latest) {
  return monthRange(`${yearOf(latest)}-01-01`, latest);
}

/** Calendar years present in the data, newest first. */
export function yearsInRange(first, last) {
  const out = [];
  for (let y = yearOf(last); y >= yearOf(first); y--) out.push(y);
  return out;
}
