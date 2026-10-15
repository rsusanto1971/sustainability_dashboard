// The only place screens get data from.
// Stage 2: reads the fixture JSON, then applies any values entered in the
// prototype Enter data screen (saved in this browser).
// Stage 4: swap this for Supabase queries and keep the same return shape, so
// the screens do not change.

import { indexUtilities, indexWaste } from '../lib/calc.js';
import { getEntries } from './entries.js';

let cache = null;

export function loadDashboardData() {
  if (!cache) {
    cache = import('./fixture.json')
      .then((mod) => normalize(mod.default, getEntries().overrides))
      .catch((err) => {
        cache = null; // let a retry try again
        throw err;
      });
  }
  return cache;
}

/** Call after saving entries so every screen reloads with the new values. */
export function invalidateDashboardData() {
  cache = null;
}

function applyOverrides(rows, kind, valueField, keyField, overrides) {
  const byKey = new Map(rows.map((r) => [`${kind}|${r.site_id}|${r.month}|${r[keyField]}`, r]));
  for (const [key, value] of Object.entries(overrides)) {
    const [k, siteId, month, field] = key.split('|');
    if (k !== kind) continue;
    if (value === null) byKey.delete(key);
    else byKey.set(key, { ...(byKey.get(key) || { site_id: siteId, month, [keyField]: field }), [valueField]: value });
  }
  return [...byKey.values()];
}

function normalize(raw, overrides) {
  const waste = applyOverrides(raw.waste, 'waste', 'pounds', 'stream', overrides);
  const utilities = applyOverrides(raw.utilities, 'utility', 'value', 'type', overrides);
  const months = [...waste, ...utilities].map((r) => r.month).sort();
  return {
    notice: raw.meta.notice,
    firstMonth: months[0] || raw.meta.months.first,
    lastMonth: months[months.length - 1] || raw.meta.months.last,
    settings: {
      goal: raw.settings.goal_percent / 100,
      goalPercent: raw.settings.goal_percent,
      wteCounts: raw.settings.wte_counts_as_diverted,
    },
    sites: raw.sites.filter((s) => s.active),
    wasteIdx: indexWaste(waste),
    utilIdx: indexUtilities(utilities),
    lockedMonths: new Set(raw.locked_months),
    targets: raw.targets,
    reference: raw.reference,
    entryCount: Object.keys(overrides).length,
  };
}
