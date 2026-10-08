/**
 * Social proof: "500+ clienți au ales produsele noastre" (product pages), "500+ clienți mulțumiți" and the
 * average rating above the reviews. THE ONLY PLACE these numbers live. `null` hides each one.
 *
 * Both are the business's figures across all its customers (confirmed 08.10.2026), not computed from the
 * reviews shown on the site, which are a selection (content/reviews.ts). Keep them true; round DOWN.
 */
export const socialProof: { customers: number | null; averageRating: number | null; confirmed?: string } = {
  customers: 500,
  averageRating: 4.9,
  confirmed: 'Confirmat de business pe 08.10.2026: peste 500 de clienți, nota medie 4,9 din 5.',
}
