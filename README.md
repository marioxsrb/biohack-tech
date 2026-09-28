# Biohack Tech

Magazin online pentru NEUROS Calm, NEUROS Focus și NEUROS Amber. Face parte din același univers vizual ca [curs.neuros.ro](https://curs.neuros.ro): aceleași culori, tipografie (Geist / Geist Mono), raze, buton roșu și ierarhie a marginilor, cu o arhitectură gândită pentru vânzare.

## Pornire

```bash
npm install
npm run dev                  # http://localhost:3000
```

Fără nicio variabilă de mediu, site-ul rulează cu o bază de date locală (PGlite în `.data/`) și emailurile se scriu în `.data/emails/`. Metodele de plată apar „în curând” până le configurezi (`.env.example`).

Comenzi: `npm run build`, `npm start` (port `$PORT` sau 3000), `npm run lint`, `npm run typecheck`, `npm test` (vitest; cu `TEST_DATABASE_URL` rulează și testele pe PostgreSQL), `npm run db:migrate`.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, PostgreSQL (`pg`; PGlite local), Stripe Payment Element. Node 22.18+.

## Structura

```
src/
  config/        prices.ts (SINGURUL loc cu prețuri), site.ts (contact, termeni comerciali)
  content/       catalog (produse, variante, galerii), conținutul paginilor de produs, texte legale
  components/    cart (store, confirmare compactă, buton, preț), product, home, site (header, footer)
  lib/           money (RON), checkout (formular + validare comună), orders/resolve (prețuri pe server), analytics
  server/        doar pe server:
    config.ts    variabile de mediu, validate; ce metode de plată sunt active
    db/          PostgreSQL / PGlite + migrații
    orders/      comanda canonică: model, mașina de stări, numere BHT-AAAALLZZ-NNNN, operații idempotente, reconciliere Stripe
    jobs/        outbox: sincronizări cu reîncercare (CRM, factură, email)
    integrations/stripe, fgo, ghl, email (șabloane + trimitere)
  app/
    cart/, checkout/, comanda/[token]/     coș, checkout, pagina comenzii
    admin/                                 operațiuni (Basic Auth)
    api/checkout, api/webhooks/stripe, api/jobs/run, api/health
tests/           vitest
```

Arhitectura, integrările și pașii de lansare: **docs/PRODUCTION-LAUNCH.md**.

## Cum adaugi sau modifici un produs

1. Pune imaginile în ZIP-ul sursă și adaugă o linie în `scripts/prepare-assets.py`, apoi `npm run assets`.
2. Adaugă produsul în `content/catalog.ts` și prețul în `config/prices.ts` (în bani: 299 lei = `29900`).
3. Adaugă conținutul paginii în `content/product-content.ts`. Secțiunile opționale (`use`, `lookbook`, `explain`) apar doar dacă există.

## Mișcare

Pagina se derulează nativ. Nicio secțiune nu depinde de poziția de scroll și nimic nu e ascuns în așteptarea
JavaScript-ului: tot conținutul e randat de server și rămâne vizibil chiar fără script.
Mișcarea există doar ca răspuns la vizitator (hover, alegerea ramei, adăugarea în coș) și ca un singur efect
la încărcare (fotografia din hero), totul în CSS. Header-ul are două stări, alese de un IntersectionObserver.

## Regula de bază: poveste liberă, cumpărare convențională

Scenele pot fi editoriale. Tot ce ține de cumpărare arată și se comportă la fel peste tot:
`components/home/SceneBuy.tsx` (scop, nume, o propoziție, preț, „Adaugă în coș”, „Vezi produsul”),
zona de cumpărare de pe pagina de produs, confirmarea compactă, coșul și checkout-ul. Butonul roșu înseamnă mereu „cumpără”.
După „Adaugă în coș” coșul nu se deschide singur: apare o confirmare mică, cu „Finalizează comanda” și „Continuă cumpărăturile”.

## Comenzi și plăți, pe scurt

Browserul trimite id-uri, cantități și formularul. Serverul calculează prețurile, salvează comanda (`BHT-20260929-0007`) și, pentru card, creează un PaymentIntent Stripe doar pentru card, exact pe total. Comanda devine plătită doar când Stripe confirmă: webhook semnat sau, dacă webhook-ul se pierde, job-ul `stripe.reconcile`. Pagina comenzii doar afișează starea din baza de date; plata rămâne valabilă chiar dacă clientul închide browserul imediat după plată. Test cu Stripe (mod test): `scripts/stripe-e2e.mjs`. Transferul bancar devine plătit doar când cineva confirmă extrasul în `/admin`. Factura (FGO), CRM-ul (GoHighLevel) și emailurile pleacă din outbox, o singură dată, cu reîncercări. Detalii: docs/PRODUCTION-LAUNCH.md.

## Documente

- `docs/PRODUCTION-LAUNCH.md`: runbook de lansare (conturi, chei, Stripe, FGO, GoHighLevel, email, DNS, teste, go-live).
- `docs/OPEN-POINTS.md`: doar ce trebuie să furnizeze sau să decidă clientul.
- `docs/CONTENT-DECISIONS.md`: ce s-a păstrat, ce s-a schimbat și ce s-a scos din materialele primite, și de ce.
