// Every formula in the dashboard lives here (spec section 4).
// Screens call these functions and never do their own math.
//
// Conventions:
//   - Rates and shares are fractions (0.972 means 97.2%). format.js turns them
//     into display strings.
//   - The goal is a fraction too (0.99).
//   - A stream value of null or undefined means "not reported". Zero means
//     "reported as zero".
//   - Functions return null when a number cannot be computed (for example a
//     rate with zero total). Screens show that as a data gap, never as zero.

export const STREAMS = [
  { key: 'recycling', label: 'Recycling', diverted: true },
  { key: 'reuse', label: 'Reuse', diverted: true },
  { key: 'composting', label: 'Composting', diverted: true },
  { key: 'wte', label: 'Waste-to-energy', diverted: true },
  { key: 'landfill', label: 'Landfill', diverted: false },
];
export const STREAM_KEYS = STREAMS.map((s) => s.key);

export const UTILITY_TYPES = [
  { key: 'electricity', label: 'Electricity', unit: 'kWh' },
  { key: 'gas', label: 'Natural gas', unit: 'therms' },
  { key: 'water', label: 'Water', unit: 'gallons' },
];

// ---------------------------------------------------------------------------
// Single site, single month (or any summed set of streams)
// ---------------------------------------------------------------------------

const has = (v) => v !== null && v !== undefined;

/** A site month is complete for waste only when all five streams have a value. */
export function isComplete(streams) {
  return !!streams && STREAM_KEYS.every((k) => has(streams[k]));
}

/** Total waste = Recycling + Reuse + Composting + Waste-to-energy + Landfill. */
export function totalWaste(s) {
  return s.recycling + s.reuse + s.composting + s.wte + s.landfill;
}

/**
 * Diverted waste. With waste-to-energy counted: total minus landfill.
 * Without: Recycling + Reuse + Composting.
 */
export function divertedWaste(s, wteCounts = true) {
  return wteCounts ? totalWaste(s) - s.landfill : s.recycling + s.reuse + s.composting;
}

/** Diversion rate = diverted / total. Null when total is zero. */
export function diversionRate(s, wteCounts = true) {
  const total = totalWaste(s);
  return total > 0 ? divertedWaste(s, wteCounts) / total : null;
}

/** Gap to goal in percentage points. Positive means behind the goal. */
export function gapToGoal(rate, goal) {
  return rate === null ? null : (goal - rate) * 100;
}

/** Pounds still to divert = Landfill minus (1 minus goal) x Total. Never below 0. */
export function poundsStillToDivert(s, goal) {
  return Math.max(0, s.landfill - (1 - goal) * totalWaste(s));
}

/** Waste-to-energy share = Waste-to-energy / Total. */
export function wteShare(s) {
  const total = totalWaste(s);
  return total > 0 ? s.wte / total : null;
}

/** Change between two periods = (this minus comparison) / comparison. */
export function pctChange(current, comparison) {
  if (!has(current) || !has(comparison) || comparison === 0) return null;
  return (current - comparison) / comparison;
}

/** Add up a list of stream objects, stream by stream. */
export function sumStreams(list) {
  const out = { recycling: 0, reuse: 0, composting: 0, wte: 0, landfill: 0 };
  for (const s of list) for (const k of STREAM_KEYS) out[k] += s[k];
  return out;
}

// ---------------------------------------------------------------------------
// Indexes built from raw rows
// ---------------------------------------------------------------------------

/** Map of "siteId|month" to a partial stream object, from waste rows. */
export function indexWaste(rows) {
  const idx = new Map();
  for (const r of rows) {
    const key = `${r.site_id}|${r.month}`;
    if (!idx.has(key)) idx.set(key, {});
    idx.get(key)[r.stream] = r.pounds;
  }
  return idx;
}

/** Map of "siteId|month|type" to a value, from utility rows. */
export function indexUtilities(rows) {
  const idx = new Map();
  for (const r of rows) idx.set(`${r.site_id}|${r.month}|${r.type}`, r.value);
  return idx;
}

// ---------------------------------------------------------------------------
// Group and period math. Group rates always come from summed pounds,
// never from averaging site percentages.
// ---------------------------------------------------------------------------

/**
 * Sum waste over a set of sites and months, using complete site months only.
 * Incomplete or missing site months are left out and listed in `missing`.
 *
 * Returns { streams, total, siteMonths, missing, sitesCovered } where
 * streams is null when nothing complete was found.
 */
export function aggregateWaste(wasteIdx, siteIds, months) {
  const included = [];
  const missing = [];
  const sitesCovered = new Set();
  for (const month of months) {
    for (const siteId of siteIds) {
      const s = wasteIdx.get(`${siteId}|${month}`);
      if (isComplete(s)) {
        included.push(s);
        sitesCovered.add(siteId);
      } else {
        const reported = s ? STREAM_KEYS.filter((k) => has(s[k])).length : 0;
        missing.push({ siteId, month, reported });
      }
    }
  }
  const streams = included.length ? sumStreams(included) : null;
  return {
    streams,
    total: streams ? totalWaste(streams) : null,
    siteMonths: included.length,
    missing,
    sitesCovered: sitesCovered.size,
  };
}

/**
 * Like for like comparison of two equal length month lists (for example a
 * period and the same months last year). A site month counts only when it is
 * complete in both, so a gap in either year never shows up as a fake change.
 * Returns { current, comparison, missing } where each side is the same shape
 * as aggregateWaste's result.
 */
export function compareWaste(wasteIdx, siteIds, months, comparisonMonths) {
  const cur = [];
  const prev = [];
  const missing = [];
  months.forEach((month, i) => {
    const other = comparisonMonths[i];
    for (const siteId of siteIds) {
      const a = wasteIdx.get(`${siteId}|${month}`);
      const b = wasteIdx.get(`${siteId}|${other}`);
      if (isComplete(a) && isComplete(b)) {
        cur.push(a);
        prev.push(b);
      } else missing.push({ siteId, month: isComplete(a) ? other : month });
    }
  });
  const side = (list) => {
    const streams = list.length ? sumStreams(list) : null;
    return { streams, total: streams ? totalWaste(streams) : null, siteMonths: list.length, missing };
  };
  return { current: side(cur), comparison: side(prev), missing };
}

/**
 * All the headline numbers for one aggregate: rates, landfill, pounds still
 * to divert, waste-to-energy share. Null fields when there is no data.
 */
export function wasteSummary(agg, { goal, wteCounts }) {
  const s = agg.streams;
  if (!s) {
    return { total: null, landfill: null, rate: null, rateWithWte: null, rateWithoutWte: null, gap: null, stillToDivert: null, wteShare: null };
  }
  const rate = diversionRate(s, wteCounts);
  return {
    total: totalWaste(s),
    landfill: s.landfill,
    rate,
    rateWithWte: diversionRate(s, true),
    rateWithoutWte: diversionRate(s, false),
    gap: gapToGoal(rate, goal),
    stillToDivert: poundsStillToDivert(s, goal),
    wteShare: wteShare(s),
  };
}

/**
 * One aggregate per month, for charts and tables. Each entry says how many of
 * the sites it covers, so screens can show "based on N of M sites".
 */
export function monthlyWaste(wasteIdx, siteIds, months, opts) {
  return months.map((month) => {
    const agg = aggregateWaste(wasteIdx, siteIds, [month]);
    return { month, streams: agg.streams, sitesCovered: agg.sitesCovered, sitesTotal: siteIds.length, ...wasteSummary(agg, opts) };
  });
}

/** One aggregate per site over the same months, for the by-site chart. */
export function wasteBySite(wasteIdx, siteIds, months, opts) {
  return siteIds.map((siteId) => {
    const agg = aggregateWaste(wasteIdx, [siteId], months);
    return { siteId, missingMonths: agg.missing.length, monthsCovered: agg.siteMonths, ...wasteSummary(agg, opts) };
  });
}

/**
 * Sum one utility type over sites and months. Missing site months are left
 * out and flagged.
 */
export function sumUtility(utilIdx, siteIds, months, type) {
  let value = 0;
  let found = 0;
  const missing = [];
  for (const month of months) {
    for (const siteId of siteIds) {
      const v = utilIdx.get(`${siteId}|${month}|${type}`);
      if (has(v)) {
        value += v;
        found++;
      } else missing.push({ siteId, month });
    }
  }
  return { value: found ? value : null, missing };
}

/**
 * Utilities year to date: the months so far in `thisYearMonths`, next to the
 * same months a year earlier. A site month missing in either year is left out
 * of both sums, so the comparison stays like for like, and is flagged.
 */
export function utilityYearToDate(utilIdx, siteIds, thisYearMonths, lastYearMonths, type) {
  let thisYear = 0;
  let lastYear = 0;
  let found = 0;
  const missing = [];
  thisYearMonths.forEach((month, i) => {
    const prev = lastYearMonths[i];
    for (const siteId of siteIds) {
      const a = utilIdx.get(`${siteId}|${month}|${type}`);
      const b = utilIdx.get(`${siteId}|${prev}|${type}`);
      if (has(a) && has(b)) {
        thisYear += a;
        lastYear += b;
        found++;
      } else missing.push({ siteId, month: has(a) ? prev : month });
    }
  });
  return {
    thisYear: found ? thisYear : null,
    lastYear: found ? lastYear : null,
    change: found ? pctChange(thisYear, lastYear) : null,
    missing,
  };
}
