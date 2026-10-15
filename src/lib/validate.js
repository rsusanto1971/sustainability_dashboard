// Validation rules for entered values (spec section 3).

/**
 * Parse what someone typed into a weight or reading field.
 *   ''          -> { ok: true, value: null }   blank means not reported
 *   '1,200'     -> { ok: true, value: 1200 }
 *   '-5', 'abc' -> { ok: false, error: '...' }
 */
export function parseAmount(text) {
  const t = String(text ?? '').trim();
  if (t === '') return { ok: true, value: null };
  const cleaned = t.replace(/,/g, '');
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return { ok: false, error: 'Enter a number, like 12500.' };
  const value = Number(cleaned);
  if (value < 0) return { ok: false, error: 'Must be zero or more.' };
  return { ok: true, value };
}

/** True when the month (first of month, "YYYY-MM-01") is after the current month. */
export function isFutureMonth(month, today = new Date()) {
  const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  return month > current;
}
