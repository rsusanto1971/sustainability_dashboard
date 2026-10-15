# Progress

The spec says what to build. This file says where the build is.

## Status

| Stage | What | Status |
|---|---|---|
| 1 | Check the spec | Done |
| 2 | Screens on fixture data | Done, waiting for review |
| 3 | Calculations module tests | Not started |
| 4 | Database and seed script | Not started |
| 5 | Login, roles, RLS, Enter data, history | Not started |
| 6 | CSV upload and import log | Not started |
| 7 | Admin, locked months, exports | Not started |
| 8 | Polish and deploy | Not started |

---

## Stage 1: spec check (done)

The first PDF stopped at section 7. Sections 8 and 9 arrived separately. Richard answered: Ryan is his son, and Claude's proposed defaults are approved.

### Decisions taken (all defaults)

- **Calculations.** `src/lib/calc.js` is written in stage 2 so the screens use it from day one. Its tests come in stage 3.
- **Public read.** RLS can't tell a dashboard screen apart from a direct API call made with the public key. So the public gets read-only access to the dashboard tables and views and no write access at all. That's fine because every row is sample data.
- **CSV units.** The waste template uses a `pounds` column. The utilities template gets a `unit` column that has to match the type (kWh, therms, gallons). Any other unit gets the row rejected. (Stage 6.)
- **Overview diversion card** follows the period filter. The default period is the last 12 months, so by default it shows the rolling 12 month rate.
- **Seed imperfections** stay out of calendar 2025 so the 2025 anchors hold:
  - Plant E is missing waste for Feb, Jun and Aug 2026.
  - The 3x outlier is Plant C Recycling, Mar 2026.
  - Dec 2025 is the locked month.
- **"Last 12 months" and "this year"** are counted back from the latest month with data (Sep 2026), not from today.
- **Missing months in group math.** Only the missing site month is left out, and the screen says "based on N of M sites".
- **Year over year** shows on the Overview cards. It uses only the site months reported in both years, so a data gap never shows up as a fake drop.
- **Gap to goal** shows under the diversion rate card. If a site is at or above the goal, the card says "Goal met" instead of a negative number.
- **Waste page** gets a site picker. The Utilities "by site" bar chart covers this year to date.
- **Single site totals** show in full pounds. Group totals show in million lb.
- **3x warning** compares against the same stream or utility type. With fewer than 12 months of history it uses whatever months exist. (Stage 5.)
- **CSV duplicates** are matched on site + month + stream (or type). Overwriting existing values takes one confirmation per file, and the preview lists every row that would change. (Stage 6.)
- **Waste-to-energy decline.** Recycling picks up the share that waste-to-energy loses.
- **Regions** are generic (Midwest, Southeast, Northeast, Southwest, West). Busy months are Mar to May and Sep to Nov.
- **Goal year.** I don't know it. It's left blank and the Targets page says "Target year not set."
- **Email.** Supabase's built-in email sender only allows a few emails an hour. Stage 5 needs a custom SMTP sender (for example Resend's free tier).
- **Language.** Plain JavaScript with Vitest, no TypeScript.
- **Fixture.** It's made by a generator script with a fixed seed, and stage 4 reuses the same script for the database seed.

### Section 9 open decisions

| # | Decision | Answer |
|---|---|---|
| 1 | Waste-to-energy counts as diverted | Yes. It's an admin setting, and both rates are shown |
| 2 | Natural gas unit | therms |
| 3 | Ryan's admin email | Still needed, before stage 5 |
| 4 | Project name, name in footer | Working name "Waste and Utilities Dashboard", no personal name in the footer yet |
| 5 | Repo | Public |
| 6 | Phase 2 | Not decided, not needed until phase 2 |

---

## Stage 2: screens on fixture data (done)

### What changed, in plain words

- There's now a React app (Vite + Recharts) with four public screens: Overview, Waste, Utilities and Targets. There's no login and no database yet.
- All numbers come from one JSON file, `src/data/fixture.json`.
  - A script (`scripts/generate-data.js`) makes that file.
  - It uses a fixed random seed, so it gives the same numbers every time.
  - If the 2025 anchors drift, the script stops with an error.
- Every formula lives in `src/lib/calc.js`. The screens only call it.
- Screens never read the JSON directly. They go through `src/data/source.js`. In stage 4 only that file changes to read from Supabase.
- Every screen shows the yellow "Illustrative data. Not real company figures." banner and has a loading state and an error state with a retry button. The Overview also has an empty state for selections with no data.
- Filters live in the page address (for example `/waste?site=plant-e`). That's how the data gaps notice can link straight to the missing months.

### Fixture checks (calendar 2025, all sites)

| Check | Target | Fixture |
|---|---|---|
| Total waste (M lb) | 20.99, within 1% | 20.95 |
| Diversion, WtE counted (%) | 96.7, within 0.2 | 96.7 |
| Diversion, WtE not counted (%) | about 86.7 | 86.6 |
| Waste-to-energy share (%) | 10 | 10.1 |

| Site | 2025 waste (M lb) | 2025 diversion (%) | Spec diversion (%) |
|---|---|---|---|
| Plant A | 7.36 | 97.5 | 97.5 |
| Plant B | 5.20 | 96.5 | 96.5 |
| Plant C | 4.19 | 96.0 | 96.0 |
| Plant D | 2.51 | 95.5 | 95.5 |
| Plant E | 1.68 | 97.0 | 97.0 |

| Waste-to-energy share, all sites | % |
|---|---|
| Oct 2024 | 10.8 |
| Jun 2025 | 10.2 |
| Sep 2026 | 8.5 |

| Section 8 example, checked by hand (formal tests come in stage 3) | Expected | Got |
|---|---|---|
| Diversion, WtE counted | 97.2% | 97.2% |
| Diversion, WtE not counted | 83.3% | 83.3% |
| Gap to goal (pts) | 1.8 | 1.8 |
| Pounds still to divert | 3,200 | 3,200 |
| WtE share | 13.9% | 13.9% |
| Group rate, X 100,000 lb at 90% + Y 1,000,000 lb at 99% | 98.2% | 98.2% |

| Screen check | Result |
|---|---|
| Screens checked at 1280 px and 390 px | 5 views x 2 widths |
| Horizontal page scroll at 390 px | 0 |
| Browser console errors | 0 |
| npm audit vulnerabilities | 0 |

### Things I changed or chose that you should know about

- **Diversion by site chart.** The bars start at zero (truncated bars mislead), so 95.5% and 97.5% look almost the same length. The exact value is printed inside each bar. If you want the differences to be visible, the honest fix is a dot chart with a 90 to 100% axis. That would be a change from the spec's "bars", so it needs your OK.
- **Monthly diversion line chart** starts its axis at about 95%, so the month to month movement is visible. The chart says so in its footnote.
- **The 3x outlier** (Plant C, Mar 2026) is a real stored value. It shows up as a spike in the stacked bars and the line chart. That's on purpose, so the warning path can be demoed later.
- **Utilities year to date** follows the site filter but not the period filter. It's always Jan to Sep 2026 against Jan to Sep 2025. The strip says so on screen.
- **Utility magnitudes** are my rough estimates for a mid-size factory. The reasoning is in the comment at the top of `scripts/generate-data.js`. They are not taken from any company or dataset.
- **Scope 1 roadmap chart** spaces its four points evenly, so the time axis isn't to scale. The last point is a range (2040 to 2050). The chart says both. The source link shows "not added yet" until you or Ryan add the URL in the generator.
- **Dependencies.** I bumped Vite to 7.3.7 and react-router-dom to 7.18.4 to clear the npm audit warnings.

### Not done in stage 2 (by design)

- No login, no database, no entry forms, no upload, no admin, no Export CSV button. Those come in stages 4 to 7.
- No automated tests yet. That's stage 3.

### What Ryan should be able to explain after this stage

- Where the sample numbers come from and how the generator hits the 2025 anchors (open `scripts/generate-data.js`).
- Why group rates are computed from summed pounds: the group rate is total diverted pounds divided by total pounds, not an average of site percentages.
- What happens to a missing month: it's left out and flagged, never counted as zero.
- Why year over year only compares months reported in both years.

## Before stage 3

- Review the screens (`npm install`, then `npm run dev`).
- Answer: keep bars for the by-site chart, or switch to a dot chart?
- Ryan's admin email is needed before stage 5.
