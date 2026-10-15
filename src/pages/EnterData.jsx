// Enter data (spec screen 4), as a prototype pulled forward from stage 5.
// No login yet: an "Acting as" picker stands in for roles. The role rules here
// are screen-only; stage 5 enforces them in the database with RLS.
// Entries save in this browser (src/data/entries.js).

import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDashboardData } from '../data/useDashboardData.js';
import { invalidateDashboardData } from '../data/source.js';
import { clearEntries, getEntries, saveChanges } from '../data/entries.js';
import { ErrorState, Loading } from '../components/States.jsx';
import Panel from '../components/Panel.jsx';
import { STREAMS, UTILITY_TYPES, diversionRate, isComplete, outlierCheck, totalWaste, wteShare } from '../lib/calc.js';
import { isFutureMonth, parseAmount } from '../lib/validate.js';
import { addMonths, monthRange } from '../lib/periods.js';
import * as fmt from '../lib/format.js';

const ROLES = [
  { id: 'admin', label: 'Admin (all sites)' },
  { id: 'plant-a', label: 'Site user, Plant A' },
  { id: 'plant-b', label: 'Site user, Plant B' },
];

const FIELDS = [
  ...STREAMS.map((s) => ({ kind: 'waste', field: s.key, label: s.label, unit: 'lb' })),
  ...UTILITY_TYPES.map((t) => ({ kind: 'utility', field: t.key, label: t.label, unit: t.unit })),
];

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

export default function EnterData() {
  const { status, data, error, retry } = useDashboardData();
  const [flash, setFlash] = useState(null);
  const reload = () => {
    invalidateDashboardData();
    retry();
  };

  return (
    <>
      <div className="page-head">
        <h1>Enter data</h1>
        <p>
          Monthly waste and utilities for one site. <span className="tag">Prototype</span> No login yet. Entries save
          in this browser only and show up on every dashboard screen.
        </p>
      </div>
      {flash && (
        <div className={`flash ${flash.persisted ? '' : 'flash-warn'}`} role="status">
          {flash.text}
          {!flash.persisted && ' This browser blocked storage, so the entries last until you close the page.'}
        </div>
      )}
      {status === 'loading' && <Loading />}
      {status === 'error' && <ErrorState error={error} onRetry={retry} />}
      {status === 'ready' && <EntryScreen data={data} reload={reload} setFlash={setFlash} />}
    </>
  );
}

function EntryScreen({ data, reload, setFlash }) {
  const [params, setParams] = useSearchParams();
  const role = ROLES.find((r) => r.id === params.get('as')) || ROLES[0];
  const isAdmin = role.id === 'admin';
  const siteId = isAdmin ? data.sites.find((s) => s.id === params.get('site'))?.id || data.sites[0].id : role.id;
  const site = data.sites.find((s) => s.id === siteId);
  const months = monthRange(data.firstMonth < '2024-10-01' ? data.firstMonth : '2024-10-01', currentMonth()).reverse();
  const month = months.includes(params.get('month')) ? params.get('month') : data.lastMonth;

  const set = (changes) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) v ? next.set(k, v) : next.delete(k);
    setParams(next, { replace: true });
    setFlash(null);
  };

  const gaps = months.filter((m) => m <= data.lastMonth && !isComplete(data.wasteIdx.get(`${siteId}|${m}`)));

  return (
    <>
      <div className="filters">
        <label>
          Acting as
          <select id="role" value={role.id} onChange={(e) => set({ as: e.target.value === 'admin' ? null : e.target.value, site: null })}>
            {ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Site
          <select id="site" value={siteId} disabled={!isAdmin} onChange={(e) => set({ site: e.target.value })}>
            {data.sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Month
          <select id="month" value={month} onChange={(e) => set({ month: e.target.value })}>
            {months.map((m) => (
              <option key={m} value={m}>
                {fmt.monthLabel(m)}
                {data.lockedMonths.has(m) ? ' (locked)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!isAdmin && <p className="card-note">Site users can only enter data for their own site, so the site is fixed.</p>}

      {gaps.length > 0 && (
        <p className="card-sub">
          {site.name} has waste gaps in:{' '}
          {gaps.map((m, i) => (
            <span key={m}>
              {i > 0 && ', '}
              <button className="linklike" onClick={() => set({ month: m })}>
                {fmt.monthLabel(m)}
              </button>
            </span>
          ))}
        </p>
      )}

      <EntryForm key={`${siteId}|${month}|${role.id}|${data.entryCount}`} data={data} site={site} month={month} role={role} reload={reload} setFlash={setFlash} />
      <History role={role} data={data} reload={reload} setFlash={setFlash} />
    </>
  );
}

function EntryForm({ data, site, month, role, reload, setFlash }) {
  const isAdmin = role.id === 'admin';
  const locked = data.lockedMonths.has(month);
  const readOnly = locked && !isAdmin;
  const future = isFutureMonth(month);

  const existing = (f) => {
    const v = f.kind === 'waste' ? data.wasteIdx.get(`${site.id}|${month}`)?.[f.field] : data.utilIdx.get(`${site.id}|${month}|${f.field}`);
    return v === undefined ? null : v;
  };
  const [text, setText] = useState(() => Object.fromEntries(FIELDS.map((f) => [f.field, existing(f) === null ? '' : fmt.int(existing(f))])));
  const [reviewing, setReviewing] = useState(false);
  const [outliersOk, setOutliersOk] = useState(false);

  // One row per field: what is saved now, what was typed, and any problems.
  const rows = useMemo(
    () =>
      FIELDS.map((f) => {
        const old = existing(f);
        const parsed = parseAmount(text[f.field]);
        const changed = parsed.ok && parsed.value !== old;
        let outlier = null;
        if (changed && parsed.value !== null) {
          const prior = [];
          for (let i = 1; i <= 12; i++) {
            const m = addMonths(month, -i);
            prior.push(f.kind === 'waste' ? data.wasteIdx.get(`${site.id}|${m}`)?.[f.field] : data.utilIdx.get(`${site.id}|${m}|${f.field}`));
          }
          const check = outlierCheck(parsed.value, prior);
          if (check?.isOutlier) outlier = check;
        }
        return { ...f, old, parsed, changed, outlier };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text, data, site.id, month],
  );

  const errors = rows.filter((r) => !r.parsed.ok);
  const changes = rows.filter((r) => r.changed);
  const outliers = changes.filter((r) => r.outlier);

  // Live preview of this site month, from the values as typed.
  const streams = Object.fromEntries(rows.filter((r) => r.kind === 'waste').map((r) => [r.field, r.parsed.ok ? r.parsed.value : null]));
  const complete = isComplete(streams);
  const reported = STREAMS.filter((s) => streams[s.key] !== null).length;

  const save = () => {
    const batch = changes.map((r) => ({ kind: r.kind, siteId: site.id, month, field: r.field, label: r.label, unit: r.unit, oldValue: r.old, newValue: r.parsed.value }));
    const { persisted } = saveChanges(batch, role.label);
    setFlash({ persisted, text: `Saved ${batch.length} ${batch.length === 1 ? 'change' : 'changes'} for ${site.name}, ${fmt.monthLabel(month)}.` });
    reload();
  };

  if (future) {
    return <div className="notice">{fmt.monthLabel(month)} is in the future. Future months can&apos;t be entered.</div>;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!errors.length && changes.length) setReviewing(true);
      }}
    >
      <div className="status-row">
        <span className={`chip ${complete ? 'chip-ok' : 'chip-gap'}`}>
          {complete ? '✓ Waste complete: 5 of 5 streams' : `! Waste has gaps: ${reported} of 5 streams`}
        </span>
        {locked && <span className="chip chip-lock">Locked month</span>}
      </div>
      {readOnly && (
        <div className="notice">
          {fmt.monthLabel(month)} is locked. Site users can&apos;t change a locked month. Switch &quot;Acting as&quot; to Admin to see
          how an admin change works.
        </div>
      )}
      {locked && isAdmin && <div className="notice">This month is locked. As an admin you can still change it, and the change is logged.</div>}

      <div className="grid-2">
        <Panel title={`Waste, ${site.name}, ${fmt.monthLabel(month)} (lb)`} subtitle="Leave a field blank if it wasn't reported. Enter 0 if it was reported as zero.">
          <div className="fields">
            {rows.filter((r) => r.kind === 'waste').map((r) => (
              <Field key={r.field} row={r} value={text[r.field]} disabled={readOnly || reviewing} onChange={(v) => setText((t) => ({ ...t, [r.field]: v }))} />
            ))}
          </div>
          <div className="preview">
            {complete ? (
              <>
                <span>Total {fmt.lb(totalWaste(streams))}</span>
                <span>Diversion {fmt.pct(diversionRate(streams, true))} with WtE</span>
                <span>{fmt.pct(diversionRate(streams, false))} without</span>
                <span>WtE share {fmt.pct(wteShare(streams))}</span>
              </>
            ) : (
              <span>Rates show once all five streams have a value. Until then this month counts as a data gap, not as zero.</span>
            )}
          </div>
        </Panel>
        <Panel title={`Utilities, ${site.name}, ${fmt.monthLabel(month)}`} subtitle="Units are fixed. No unit conversion.">
          <div className="fields">
            {rows.filter((r) => r.kind === 'utility').map((r) => (
              <Field key={r.field} row={r} value={text[r.field]} disabled={readOnly || reviewing} onChange={(v) => setText((t) => ({ ...t, [r.field]: v }))} />
            ))}
          </div>
        </Panel>
      </div>

      {!reviewing && !readOnly && (
        <div className="actions">
          <button type="submit" className="primary" disabled={!!errors.length || !changes.length}>
            Review {changes.length || ''} {changes.length === 1 ? 'change' : 'changes'}
          </button>
          <span className="card-note">
            {errors.length ? `Fix ${errors.length} ${errors.length === 1 ? 'field' : 'fields'} first.` : !changes.length ? 'No changes yet.' : 'Nothing is saved until you confirm.'}
          </span>
        </div>
      )}

      {reviewing && (
        <section className="panel review" aria-label="Review changes">
          <h2>Check before saving</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Field</th>
                  <th scope="col">Saved now</th>
                  <th scope="col">New value</th>
                  <th scope="col">Check</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((r) => (
                  <tr key={r.field}>
                    <td>
                      {r.label} ({r.unit})
                    </td>
                    <td>{r.old === null ? 'Not reported' : fmt.int(r.old)}</td>
                    <td>{r.parsed.value === null ? 'Not reported' : fmt.int(r.parsed.value)}</td>
                    <td style={{ whiteSpace: 'normal', textAlign: 'left' }}>
                      {r.outlier && <div className="warn-text">⚠ {r.outlier.ratio ? `${r.outlier.ratio.toFixed(1)} times` : 'Far above'} the 12 month average ({fmt.int(r.outlier.average)})</div>}
                      {r.old !== null && <div>Replaces a saved value</div>}
                      {r.old === null && r.parsed.value !== null && <div>New value</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {outliers.length > 0 && (
            <label className="confirm">
              <input id="outliers-ok" type="checkbox" checked={outliersOk} onChange={(e) => setOutliersOk(e.target.checked)} />
              {outliers.length === 1 ? 'The flagged value is correct.' : `All ${outliers.length} flagged values are correct.`}
            </label>
          )}
          <div className="actions">
            <button type="button" className="primary" disabled={outliers.length > 0 && !outliersOk} onClick={save}>
              Confirm and save
            </button>
            <button type="button" onClick={() => setReviewing(false)}>
              Back to edit
            </button>
          </div>
        </section>
      )}
    </form>
  );
}

function Field({ row, value, disabled, onChange }) {
  const id = `f-${row.field}`;
  return (
    <div className="field">
      <label htmlFor={id}>
        {row.label} <span className="unit">{row.unit}</span>
      </label>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        disabled={disabled}
        aria-invalid={!row.parsed.ok}
        aria-describedby={`${id}-msg`}
        placeholder="Not reported"
        onChange={(e) => onChange(e.target.value)}
      />
      <div id={`${id}-msg`} className="field-msg">
        {!row.parsed.ok && <span className="error-text">✕ {row.parsed.error}</span>}
        {row.outlier && (
          <span className="warn-text">
            ⚠ {row.outlier.ratio ? `${row.outlier.ratio.toFixed(1)} times` : 'Far above'} the 12 month average of {fmt.int(row.outlier.average)}. You can still save it.
          </span>
        )}
        {row.parsed.ok && row.changed && !row.outlier && <span className="muted-text">Changed from {row.old === null ? 'not reported' : fmt.int(row.old)}</span>}
      </div>
    </div>
  );
}

function History({ role, data, reload, setFlash }) {
  const [confirmClear, setConfirmClear] = useState(false);
  const all = getEntries().history;
  const rows = role.id === 'admin' ? all : all.filter((h) => h.siteId === role.id);
  const name = (id) => data.sites.find((s) => s.id === id)?.name || id;
  const show = (v) => (v === null || v === undefined ? 'Not reported' : fmt.int(v));

  return (
    <Panel
      title="Change history"
      subtitle={role.id === 'admin' ? 'Every change saved in this browser, newest first.' : `Changes for ${name(role.id)} only.`}
    >
      {rows.length === 0 ? (
        <p className="card-sub">No changes yet. Saved changes show here with the old value, the new value, who and when.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Who</th>
                <th scope="col">Site</th>
                <th scope="col">Month</th>
                <th scope="col">Field</th>
                <th scope="col">Old</th>
                <th scope="col">New</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 50).map((h, i) => (
                <tr key={`${h.at}-${i}`}>
                  <td>{new Date(h.at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td>{h.who}</td>
                  <td>{name(h.siteId)}</td>
                  <td>{fmt.monthLabel(h.month)}</td>
                  <td>
                    {h.label} ({h.unit})
                  </td>
                  <td>{show(h.oldValue)}</td>
                  <td>{show(h.newValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {all.length > 0 && role.id === 'admin' && (
        <div className="actions">
          {!confirmClear ? (
            <button type="button" onClick={() => setConfirmClear(true)}>
              Clear my entries
            </button>
          ) : (
            <>
              <span>Remove all entries and history from this browser and go back to the sample data?</span>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  clearEntries();
                  setConfirmClear(false);
                  setFlash({ persisted: true, text: 'Cleared. Back to the sample data.' });
                  reload();
                }}
              >
                Yes, clear
              </button>
              <button type="button" onClick={() => setConfirmClear(false)}>
                Keep them
              </button>
            </>
          )}
        </div>
      )}
    </Panel>
  );
}
