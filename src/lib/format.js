// Display rules (spec section 4): diversion to one decimal place, pounds with
// thousands separators, group waste totals in million lb with two decimals.
// Values are stored at full precision; only the display rounds.

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const DASH = 'n/a';

export function pct(fraction, digits = 1) {
  if (fraction === null || fraction === undefined) return DASH;
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function int(n) {
  if (n === null || n === undefined) return DASH;
  return Math.round(n).toLocaleString('en-US');
}

export function lb(n) {
  return n === null || n === undefined ? DASH : `${int(n)} lb`;
}

export function millionLb(n) {
  return n === null || n === undefined ? DASH : `${(n / 1e6).toFixed(2)}M lb`;
}

/** Group totals in million lb, single site totals in full pounds. */
export function wasteTotal(n, isGroup) {
  return isGroup ? millionLb(n) : lb(n);
}

export function points(n) {
  if (n === null || n === undefined) return DASH;
  return `${n.toFixed(1)} pts`;
}

/** "+3.2% (up)" style change text, so direction never depends on color. */
export function change(fraction) {
  if (fraction === null || fraction === undefined) return null;
  const v = (fraction * 100).toFixed(1);
  if (Number(v) === 0) return 'no change';
  return fraction > 0 ? `up ${v}%` : `down ${Math.abs(Number(v)).toFixed(1)}%`;
}

export function withUnit(n, unit) {
  return n === null || n === undefined ? DASH : `${int(n)} ${unit}`;
}

/** Short axis ticks: 1.2M, 450k. */
export function compact(n) {
  if (n === null || n === undefined) return '';
  const a = Math.abs(n);
  if (a >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${+(n / 1e3).toFixed(0)}k`;
  return String(Math.round(n));
}

export function monthLabel(month) {
  return `${MONTHS_SHORT[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}

export function monthShort(month) {
  return MONTHS_SHORT[Number(month.slice(5, 7)) - 1];
}

export function monthTick(month) {
  return `${MONTHS_SHORT[Number(month.slice(5, 7)) - 1]} ${month.slice(2, 4)}`;
}
