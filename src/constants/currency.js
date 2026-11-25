// Lira per dollar, used to show equivalents and to total mixed payments.
export const EXCHANGE_RATE = 90000;

/** USD value of an amount paid partly in USD and partly in LBP. */
export function toUSD(usd, lbp) {
  return (Number(usd) || 0) + (Number(lbp) || 0) / EXCHANGE_RATE;
}

/**
 * "$20 + 900,000 L.L" style label; empty parts are left out.
 * A reversal (both parts zero or negative) shows as "−($20 + 900,000 L.L)".
 */
export function formatMixed(usd, lbp) {
  const u = Number(usd) || 0;
  const l = Number(lbp) || 0;
  const negative = u <= 0 && l <= 0 && (u < 0 || l < 0);
  const parts = [];
  if (u) parts.push(`$${Math.abs(u).toLocaleString('en-US')}`);
  if (l) parts.push(`${Math.abs(l).toLocaleString('en-US')} L.L`);
  const text = parts.join(' + ') || '$0';
  return negative ? `−(${text})` : text;
}
