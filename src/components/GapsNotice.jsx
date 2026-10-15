import { Link } from 'react-router-dom';
import { monthLabel } from '../lib/format.js';

/**
 * Lists site months with missing waste data. Missing months are left out of
 * the numbers (never counted as zero), and this notice says so.
 */
export default function GapsNotice({ missing, sites }) {
  if (!missing.length) return null;
  const bySite = new Map();
  for (const m of missing) {
    if (!bySite.has(m.siteId)) bySite.set(m.siteId, []);
    bySite.get(m.siteId).push(m);
  }
  const name = (id) => sites.find((s) => s.id === id)?.name || id;
  return (
    <div className="notice" role="note">
      <strong>Data gaps: {missing.length} site {missing.length === 1 ? 'month' : 'months'} missing waste data.</strong>{' '}
      These months are left out of totals and rates on this page, not counted as zero.
      <ul>
        {[...bySite.entries()].map(([siteId, list]) => (
          <li key={siteId}>
            <Link to={`/waste?site=${siteId}`}>{name(siteId)}</Link>:{' '}
            {list.map((m) => `${monthLabel(m.month)}${m.reported ? ` (${m.reported} of 5 streams)` : ''}`).join(', ')}
          </li>
        ))}
      </ul>
    </div>
  );
}
