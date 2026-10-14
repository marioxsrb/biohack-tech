# Operations: GHL, FGO, workflows, admin (14.10.2026)

## GoHighLevel (verified on the live API with synthetic contacts, created and deleted)

- Location NEUROS, pipeline "Comenzi Biohack Tech" (id matches `GHL_PIPELINE_ID`) with all 9 stages incl.
  "Ramburs, de pregătit"; all 15 `bt_*` custom fields and the `bt-*` tags exist.
- **The location allows duplicate contacts.** `contacts/upsert` created a new contact for an address it already
  had. The app now looks the address up (stored contact id first, then exact-email search, oldest contact) and
  updates it (`PUT`, without `source`, so existing NEUROS contacts keep their own); it creates only addresses
  GHL does not have. GHL's search does not see a brand-new contact for a while, so the contact id is stored on
  every lead/order of the address right after the first save, and a lead's consent sync runs a minute later.
- **Custom fields were silently ignored** (`contact.bt_…` with `fieldValue`). The API accepts the short key with
  `field_value`; fixed and verified (consent and unsubscribe link set on a synthetic contact).
- The private integration token has no access to `locations` (401) or `workflows` (401): workflow statuses
  cannot be read by the app. Existing duplicates for one test address (created by earlier tests and by an
  unknown source at 07:05 UTC) were not touched.

## Workflows W1–W7: what the application does instead

| Workflow | Replaced by (application, own SMTP + outbox) |
|---|---|
| Order confirmation / transfer instructions | `email.send` order emails |
| W2 abandoned checkout | lead recovery sequence (30 min / 24 h, consent required); the `bt-recuperare-eligibil` tag is no longer set and is removed where present |
| W3 transfer reminder | `email.send` template `transfer_reminder` (2 days) + transfer expiry job |
| Preparation / shipping / delivery alerts | `notify.send` to `orders@` (internal) and shipping emails |
| Post-delivery follow-up | `email.send` template `delivery_followup` |
| W7 refund | refund emails from the order service |

**Keep W1–W7 in Draft.** Their statuses must be checked by a person in GHL (the token cannot); if one is
Published and duplicates a row above, disable that BiohackTech workflow only.

## Unpaid card orders

Recovered by the application: when a card order is marked abandoned (after `ABANDON_AFTER_MINUTES`), it gets a
checkout lead if it had none and follows the same lead sequence and suppression (payment, cancellation,
unsubscribe, no consent, one sequence per person). Its link restores the cart; a new checkout is a new order.

## FGO (verified read-only on api.fgo.ro; no invoice issued)

- Authentication and series: `factura/getstatus` on a non-existent number answers "Factura nu exista" with the
  configured hash (a wrong hash is refused with 409). VAT 21% exists in FGO's nomenclature.
- Duplicate protection: `IdExtern` = order number with `VerificareDuplicat: true`; the invoice number is stored
  before any retry; FGO's own timeout message is retried, other errors are not.
- `FGO_AUTO_STORNO` is not set (off): a cancelled/refunded order with an invoice appears in Admin → "Facturi de
  verificat" for a manual storno.
- **Accounting decisions still open:** cash-on-delivery invoice timing (today: issued when the order is placed,
  marked "Plata ramburs"), and whether storno should become automatic.

## Admin

- Stats (`/admin/stats`): both funnels from Supabase data; sessions are counted without identifiers.
- Operational (`/admin`, leads, messages): queues, order detail (customer, shipping, billing, integrations,
  history, retries), printing (`/admin/print`: preparation sheet, shipping sheet, internal parcel label, order
  details; A4). The internal label is not a courier AWB; courier and AWB are entered by hand until a courier is chosen
  (`server/fulfillment/courier.ts` is the adapter point for a future integration).
