// The only place screens get data from.
// Stage 2: reads the fixture JSON. Stage 4: swap this for Supabase queries and
// keep the same return shape, so the screens do not change.

import { indexUtilities, indexWaste } from '../lib/calc.js';

let cache = null;

export function loadDashboardData() {
  if (!cache) {
    cache = import('./fixture.json')
      .then((mod) => normalize(mod.default))
      .catch((err) => {
        cache = null; // let a retry try again
        throw err;
      });
  }
  return cache;
}

function normalize(raw) {
  return {
    notice: raw.meta.notice,
    firstMonth: raw.meta.months.first,
    lastMonth: raw.meta.months.last,
    settings: {
      goal: raw.settings.goal_percent / 100,
      goalPercent: raw.settings.goal_percent,
      wteCounts: raw.settings.wte_counts_as_diverted,
    },
    sites: raw.sites.filter((s) => s.active),
    wasteIdx: indexWaste(raw.waste),
    utilIdx: indexUtilities(raw.utilities),
    lockedMonths: new Set(raw.locked_months),
    targets: raw.targets,
    reference: raw.reference,
  };
}
