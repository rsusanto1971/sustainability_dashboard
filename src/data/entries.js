// Prototype storage for entered data. Saves to this browser only
// (localStorage). Stage 4 replaces this with Supabase tables and a real
// history table written by the database.
//
// Shape: { overrides: { "waste|plant-a|2026-03-01|recycling": 1200 }, history: [...] }
// An override of null means "not reported" (the value was cleared).

const KEY = 'wud.prototype-entries.v1';
let memory = { overrides: {}, history: [] }; // used when localStorage is blocked

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) memory = JSON.parse(raw);
  } catch {
    // Storage blocked or bad JSON: keep the in-memory copy.
  }
  return memory;
}

function write(state) {
  memory = state;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false; // saved for this visit only
  }
}

export const overrideKey = (kind, siteId, month, field) => `${kind}|${siteId}|${month}|${field}`;

export function getEntries() {
  return read();
}

/**
 * Save a batch of changes. Each change: { kind, siteId, month, field, oldValue, newValue }.
 * Writes one history row per changed field. Returns { persisted } where
 * persisted is false if the browser blocked storage.
 */
export function saveChanges(changes, who) {
  const state = read();
  const at = new Date().toISOString();
  const overrides = { ...state.overrides };
  const rows = changes.map((c) => {
    overrides[overrideKey(c.kind, c.siteId, c.month, c.field)] = c.newValue;
    return { at, who, source: 'form', ...c };
  });
  const persisted = write({ overrides, history: [...rows.reverse(), ...state.history].slice(0, 500) });
  return { persisted };
}

export function clearEntries() {
  write({ overrides: {}, history: [] });
}
