import { DataGate } from '../components/States.jsx';
import { SiteFilter, useFilters } from '../components/Filters.jsx';
import Panel from '../components/Panel.jsx';
import GapsNotice from '../components/GapsNotice.jsx';
import { STREAMS, aggregateWaste, monthlyWaste } from '../lib/calc.js';
import { monthRange } from '../lib/periods.js';
import * as fmt from '../lib/format.js';

export default function Waste() {
  return <DataGate>{(data) => <WasteBody data={data} />}</DataGate>;
}

function WasteBody({ data }) {
  const f = useFilters(data);
  const { goal, wteCounts } = data.settings;
  const months = monthRange(data.firstMonth, data.lastMonth);
  const rows = monthlyWaste(data.wasteIdx, f.siteIds, months, { goal, wteCounts }).reverse();
  const missing = aggregateWaste(data.wasteIdx, f.siteIds, months).missing;
  const cell = (r, v, format) => (r.streams ? format(v) : '');

  return (
    <>
      <div className="page-head">
        <h1>Waste</h1>
        <p>Pounds by stream for every month, newest first. Both diversion rates are shown, with and without waste-to-energy.</p>
      </div>
      <div className="filters">
        <SiteFilter data={data} filters={f} />
      </div>
      <GapsNotice missing={missing} sites={data.sites} />
      <Panel
        title={`Monthly waste, ${f.site ? f.site.name : 'all sites'} (lb)`}
        subtitle={`Headline rate setting: waste-to-energy ${wteCounts ? 'counted' : 'not counted'} as diverted.`}
        foot="A blank month means not reported. A month counts as complete only when all five streams have a value. Group months with a missing site add up the sites that did report."
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Month</th>
                {STREAMS.map((s) => (
                  <th scope="col" key={s.key}>
                    {s.label}
                  </th>
                ))}
                <th scope="col">Total</th>
                <th scope="col">Rate with WtE</th>
                <th scope="col">Rate without WtE</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month} className={r.streams ? '' : 'gap'}>
                  <th scope="row" style={{ fontWeight: 400 }}>
                    {fmt.monthLabel(r.month)}
                  </th>
                  {STREAMS.map((s) => (
                    <td key={s.key}>{cell(r, r.streams?.[s.key], fmt.int)}</td>
                  ))}
                  <td>{cell(r, r.total, fmt.int)}</td>
                  <td>{cell(r, r.rateWithWte, fmt.pct)}</td>
                  <td>{cell(r, r.rateWithoutWte, fmt.pct)}</td>
                  <td>
                    {!r.streams ? (
                      <span className="tag tag-gap">Not reported</span>
                    ) : r.sitesCovered < r.sitesTotal ? (
                      <span className="tag tag-gap">
                        {r.sitesCovered} of {r.sitesTotal} sites
                      </span>
                    ) : (
                      <span className="tag">Complete</span>
                    )}
                    {data.lockedMonths.has(r.month) && (
                      <>
                        {' '}
                        <span className="tag">Locked</span>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
