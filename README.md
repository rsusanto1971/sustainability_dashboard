# Waste and Utilities Dashboard

> **Illustrative data. Not real company figures.**

A web tool for monthly waste and utilities data. It tracks diversion from landfill against a 99% goal and compares electricity, natural gas and water with last year. It's a portfolio project, and every number in it is sample data.

The waste figures are scaled to match public totals from a manufacturer's 2025 sustainability report (about 20.99 million lb of waste, 96.7% diverted). Site names, streams and utility figures are made up.

## Run it

Needs Node 20 or newer.

```bash
npm install
npm run dev            # http://localhost:5173
```

To rebuild the sample data:

```bash
npm run generate-data  # writes src/data/fixture.json, fixed seed
```

## Where things are

- `src/lib/calc.js`: every formula (diversion rate, gap to goal, rolling and year to date math)
- `src/data/source.js`: the only place screens get data from
- `src/pages/`: Overview, Waste, Utilities, Targets
- `scripts/generate-data.js`: sample data generator, with the reasoning for its numbers
- `PROGRESS.md`: build status, stage by stage

Screenshots, deploy steps and the full write-up come in stage 8.
