// Sample data generator for the Waste and Utilities Dashboard.
//
// ILLUSTRATIVE DATA. NOT REAL COMPANY FIGURES.
//
// Run: npm run generate-data
// Writes src/data/fixture.json. Uses a fixed random seed, so every run
// produces the same numbers. Stage 4 will reuse this file to seed Supabase.
//
// ---------------------------------------------------------------------------
// WHERE THE WASTE NUMBERS COME FROM (anchors for calendar year 2025)
//
// Scaled to match public figures from a manufacturer's 2025 sustainability
// report (read from screenshots of the report):
//   - about 20.99 million lb of waste across all sites
//   - 96.7% diverted from landfill
//   - goal: 99% landfill-free
// Site shares, site diversion rates and the stream mix are choices made for
// this sample (see the product spec, section 6). The five site names and the
// five streams are made up, not the company's.
//
// Stream mix for the group in 2025: Recycling 68%, Reuse 13%, Composting
// 5.7%, Waste-to-energy 10%, Landfill 3.3%. Each site keeps its own landfill
// share (100% minus its diversion rate) and splits the rest in the same
// 68 : 13 : 5.7 : 10 ratio. Waste-to-energy drops about 0.1 percentage points
// a month across the 24 months; Recycling picks up that share, so landfill
// and the diversion rate with waste-to-energy are unaffected.
//
// ---------------------------------------------------------------------------
// UTILITY MAGNITUDES (rough estimates, not taken from any company or dataset)
//
// A "typical" site here is a mid-size factory, roughly 250,000 sq ft running
// two shifts. Bigger sites (by waste share) scale up, smaller ones down.
//   - Electricity: about 1.5 million kWh a month for the typical site
//     (around 72 kWh per sq ft per year, inside the wide range for light
//     manufacturing). About 20% higher in Jun to Aug for cooling.
//   - Natural gas: about 30,000 therms a month on average, mostly for space
//     heating and process heat. Winter months run about 1.7 times summer.
//   - Water: about 2.5 million gallons a month (process, cooling towers,
//     sanitary). Steady, plus or minus about 5%.
// These are defensible ballpark figures, not benchmarks. Change them if the
// target employer's bills look different.
// ---------------------------------------------------------------------------

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEED = 20250101;

// mulberry32: a small, well known seeded random number generator.
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
const between = (lo, hi) => lo + (hi - lo) * rand();

// 24 months: October 2024 to September 2026, stored as the first of the month.
const MONTHS = [];
for (let i = 0; i < 24; i++) {
  const d = new Date(Date.UTC(2024, 9 + i, 1));
  MONTHS.push(d.toISOString().slice(0, 10));
}
const monthNum = (m) => Number(m.slice(5, 7)); // 1 to 12
const year = (m) => Number(m.slice(0, 4));

const GROUP_2025_LB = 20_990_000;

const SITES = [
  { id: 'plant-a', name: 'Plant A', region: 'Midwest', active: true, share: 0.35, diversion: 0.975 },
  { id: 'plant-b', name: 'Plant B', region: 'Southeast', active: true, share: 0.25, diversion: 0.965 },
  { id: 'plant-c', name: 'Plant C', region: 'Northeast', active: true, share: 0.2, diversion: 0.96 },
  { id: 'plant-d', name: 'Plant D', region: 'Southwest', active: true, share: 0.12, diversion: 0.955 },
  { id: 'plant-e', name: 'Plant E', region: 'West', active: true, share: 0.08, diversion: 0.97 },
];

const STREAMS = ['recycling', 'reuse', 'composting', 'wte', 'landfill'];
// Split of the diverted share, from the 2025 group mix (68 : 13 : 5.7 : 10).
const DIVERTED_MIX = { recycling: 68, reuse: 13, composting: 5.7, wte: 10 };
const DIVERTED_SUM = 96.7;

// Built-in imperfections (spec section 6). Kept in 2026 so they do not
// disturb the calendar 2025 anchors.
const MISSING_WASTE = [
  { site: 'plant-e', month: '2026-02-01' },
  { site: 'plant-e', month: '2026-06-01' },
  { site: 'plant-e', month: '2026-08-01' },
];
const OUTLIER = { site: 'plant-c', month: '2026-03-01', stream: 'recycling', timesAverage: 3.5 };
const LOCKED_MONTHS = ['2025-12-01'];

// Busy months get a small bump in waste: March to May and September to November.
const BUSY = new Set([3, 4, 5, 9, 10, 11]);

// ---------------------------------------------------------------------------
// Waste
// ---------------------------------------------------------------------------
const waste = [];

for (const site of SITES) {
  const annual2025 = GROUP_2025_LB * site.share;
  const monthlyAvg = annual2025 / 12;

  // Monthly totals: average, plus or minus up to 12%, plus a 5% busy month bump.
  const totals = MONTHS.map((m) => monthlyAvg * (1 + between(-0.12, 0.12)) * (BUSY.has(monthNum(m)) ? 1.05 : 1));

  // Rescale 2025 so the site's annual total lands exactly on its share.
  const idx2025 = MONTHS.map((m, i) => (year(m) === 2025 ? i : -1)).filter((i) => i >= 0);
  const sum2025 = idx2025.reduce((s, i) => s + totals[i], 0);
  const scale = annual2025 / sum2025;
  for (const i of idx2025) totals[i] *= scale;

  const landfillShare = 1 - site.diversion;
  const divertedShare = site.diversion;

  MONTHS.forEach((m, i) => {
    if (MISSING_WASTE.some((x) => x.site === site.id && x.month === m)) return;

    const total = totals[i];
    // Waste-to-energy trend: -0.1 points a month, centered on 2025 (index 8.5).
    const wteShift = 0.001 * (8.5 - i);
    const shares = {
      recycling: (divertedShare * DIVERTED_MIX.recycling) / DIVERTED_SUM - wteShift,
      reuse: (divertedShare * DIVERTED_MIX.reuse) / DIVERTED_SUM,
      composting: (divertedShare * DIVERTED_MIX.composting) / DIVERTED_SUM,
      wte: (divertedShare * DIVERTED_MIX.wte) / DIVERTED_SUM + wteShift,
      landfill: landfillShare,
    };
    for (const stream of STREAMS) {
      // Small month to month wobble in the mix (up to 3% of the stream).
      // Landfill gets none, so each site's diversion rate stays on target.
      const wobble = stream === 'landfill' ? 1 : 1 + between(-0.03, 0.03);
      waste.push({ site_id: site.id, month: m, stream, pounds: Math.round(total * shares[stream] * wobble) });
    }
  });
}

// Plant the outlier: one value far above the site's 12 month average.
{
  const prior = waste.filter(
    (r) => r.site_id === OUTLIER.site && r.stream === OUTLIER.stream && r.month < OUTLIER.month,
  ).slice(-12);
  const avg = prior.reduce((s, r) => s + r.pounds, 0) / prior.length;
  const row = waste.find((r) => r.site_id === OUTLIER.site && r.month === OUTLIER.month && r.stream === OUTLIER.stream);
  row.pounds = Math.round(avg * OUTLIER.timesAverage);
  row.notes = 'Sample outlier: more than 3 times the 12 month average, to demo the warning.';
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
const utilities = [];
const TYPICAL = { electricity: 1_500_000, gas: 30_000, water: 2_500_000 };

for (const site of SITES) {
  const size = site.share / 0.2; // 0.2 = an average site's share
  for (const m of MONTHS) {
    const mn = monthNum(m);
    // Cosine curves: peak in mid July for electricity, mid January for gas.
    const summer = Math.cos(((mn - 7.5) / 12) * 2 * Math.PI); // +1 in Jul/Aug, -1 in Jan/Feb
    const elecSeason = 1 + 0.1 * summer + 0.1 * Math.max(0, summer);
    const gasSeason = 1 - 0.45 * summer;
    utilities.push(
      { site_id: site.id, month: m, type: 'electricity', value: Math.round(TYPICAL.electricity * size * elecSeason * (1 + between(-0.04, 0.04))) },
      { site_id: site.id, month: m, type: 'gas', value: Math.round(TYPICAL.gas * size * gasSeason * (1 + between(-0.06, 0.06))) },
      { site_id: site.id, month: m, type: 'water', value: Math.round(TYPICAL.water * size * (1 + between(-0.05, 0.05))) },
    );
  }
}

// ---------------------------------------------------------------------------
// Anchor check: fail loudly if calendar 2025 drifts from the spec.
// ---------------------------------------------------------------------------
const y2025 = waste.filter((r) => year(r.month) === 2025);
const sumStream = (s) => y2025.filter((r) => r.stream === s).reduce((a, r) => a + r.pounds, 0);
const total = STREAMS.reduce((a, s) => a + sumStream(s), 0);
const withWte = (total - sumStream('landfill')) / total;
const withoutWte = (sumStream('recycling') + sumStream('reuse') + sumStream('composting')) / total;

const checks = [
  ['2025 total lb within 1% of 20.99M', Math.abs(total / GROUP_2025_LB - 1) <= 0.01],
  ['2025 diversion (WtE counted) within 0.2 pts of 96.7%', Math.abs(withWte * 100 - 96.7) <= 0.2],
  ['2025 diversion (WtE not counted) near 86.7%', Math.abs(withoutWte * 100 - 86.7) <= 0.5],
];
console.log(`2025 total: ${(total / 1e6).toFixed(3)}M lb`);
console.log(`2025 diversion, WtE counted: ${(withWte * 100).toFixed(2)}%`);
console.log(`2025 diversion, WtE not counted: ${(withoutWte * 100).toFixed(2)}%`);
for (const [label, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
if (checks.some(([, ok]) => !ok)) process.exit(1);

// ---------------------------------------------------------------------------
// Write the fixture
// ---------------------------------------------------------------------------
const fixture = {
  meta: {
    notice: 'Illustrative data. Not real company figures.',
    seed: SEED,
    months: { first: MONTHS[0], last: MONTHS[MONTHS.length - 1] },
  },
  settings: { goal_percent: 99, wte_counts_as_diverted: true },
  sites: SITES.map(({ id, name, region, active }) => ({ id, name, region, active })),
  waste,
  utilities,
  locked_months: LOCKED_MONTHS,
  targets: [
    { name: 'Landfill-free goal', value: 99, unit: 'percent', year: null, source_note: 'Matches the goal in a manufacturer\'s public 2025 sustainability report. Target year not set.' },
  ],
  reference: {
    title: 'Scope 1 net zero roadmap',
    source_note: "From a manufacturer's public 2025 sustainability report. Not linked to the sample data above.",
    source_url: null,
    unit: 'MT CO2e',
    points: [
      { label: '2014', value: 76828 },
      { label: '2025', value: 37434 },
      { label: '2030', value: 11524 },
      { label: '2040 to 2050', value: 3841 },
    ],
  },
};

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/fixture.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(fixture, null, 1) + '\n');
console.log(`Wrote ${waste.length} waste rows and ${utilities.length} utility rows to ${out}`);
