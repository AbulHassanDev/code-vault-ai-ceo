/** Discounted amount in cents, rounded down to a whole cent. Percent clamped to 0–100. */
export function applyDiscount(priceCents: number, percentOff: number | null | undefined) {
  const pct = Math.min(100, Math.max(0, Math.floor(percentOff ?? 0)));
  const discountCents = Math.floor((priceCents * pct) / 100);
  return { pct, discountCents, totalCents: priceCents - discountCents };
}
