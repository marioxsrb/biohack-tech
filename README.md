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
  components/    cart (store, confirmare compactă, buton, preț), product, home, site (header, footer), landing
  lib/           money (RON), checkout (formular + validare comună), orders/resolve (prețuri pe server), analytics
  server/        doar pe server:
    config.ts    variabile de mediu, validate; ce metode de plată sunt active
    db/          PostgreSQL / PGlite + migrații
    orders/      comanda canonică: model, mașina de stări, numere BHT-AAAALLZZ-NNNN, operații idempotente, reconciliere Stripe
    jobs/        outbox: sincronizări cu reîncercare (CRM, factură, email)
    integrations/stripe, fgo, ghl, email (șabloane + trimitere)
  app/
    (site)/                                magazinul, cu header și footer:
      cart/, checkout/, comanda/[token]/   coș, checkout, pagina comenzii
      admin/                               operațiuni (Basic Auth)
    (landing)/lp/[slug]/                   landing-urile pentru reclame (fără meniu, noindex)
    api/checkout, api/webhooks/stripe, api/jobs/run, api/health
tests/           vitest
```

Arhitectura, integrările și pașii de lansare: **docs/PRODUCTION-LAUNCH.md**.

## Cum adaugi sau modifici un produs

1. Pune imaginile în ZIP-ul sursă și adaugă o linie în `scripts/prepare-assets.py`, apoi `npm run assets`.
2. Adaugă produsul în `content/catalog.ts` și prețul în `config/prices.ts` (în bani: 299 lei = `29900`).
   Dacă variantele au prețuri diferite (Brain Flow: 1, 4, 13 zone), prețul este un obiect `{ idVariantă: bani }`;
   produsul apare „de la” cel mai mic preț, iar serverul încasează prețul variantei alese. Id-urile variantelor nu se mai schimbă după prima vânzare.
3. Adaugă conținutul paginii în `content/product-content.ts`. Secțiunile opționale (`use`, `lookbook`, `explain`) apar doar dacă există.
4. Adaugă tag-ul GHL în `PRODUCT_TAG` (`server/integrations/ghl.ts`) și în `scripts/ghl-check.mjs`; un test pică dacă lipsește.
5. Pentru reclame: adaugă landing-ul în `content/landings.ts` și slug-ul în `lib/landing-hosts.ts`.

## Promoții, ofertă după plată, contact

- Promoțiile sunt definite o singură dată în `config/promotions.ts` și calculate de `lib/promotions.ts` (doar numere întregi). Serverul recalculează tot; coșul doar afișează același calcul.
- Oferta de după plată (doar card): `config/upsell.ts` spune ce se propune. E o comandă separată, legată de prima, plătită cu același card doar după două confirmări explicite (`server/orders/upsell.ts`).
- Formularul de contact scrie în tabelul `enquiries`; mesajele se văd în `/admin/mesaje`.

## Landing-uri pentru reclame

Câte unul pe produs: `/lp/calm`, `/lp/focus`, `/lp/amber`, `/lp/brain-flow` local, respectiv `calm.biohack-tech.ro` etc. în producție (rutare după host în `src/proxy.ts`, doar hostnames din listă). Nu apar în meniu, footer, grilă sau sitemap și au `noindex`. Butonul duce direct în checkout cu id-urile produsului și ale variantei; serverul recalculează prețul. Parametrii UTM și landing-ul ajung în comandă și în GHL (`contact.bt_last_order_source`). Detalii: docs/PRODUCTION-LAUNCH.md §26.

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

## Confidențialitate și consimțământ, pe scurt

- **Cookie-uri:** `components/consent/ConsentManager.tsx` + `lib/consent/`. Nimic opțional nu e în HTML. GA4, Clarity și Meta pornesc doar după acord pe categorie și doar dacă au id setat (`NEXT_PUBLIC_*`). Fără id-uri nu apare niciun banner. „Setări cookies” este în footer.
- **Emailuri de marketing:** bifa din checkout este separată și nebifată. Dovada (text, versiune, oră, comandă) stă în baza de date (`server/marketing/`).
  - Dezabonarea se face la `/dezabonare/<token>`.
  - Recuperarea checkout-ului (`/reluare/<token>`, tag `bt-recuperare-eligibil`) merge doar cu acord.
  - Emailurile despre comenzi pleacă oricum: nu sunt marketing.
- **Retragere din contract:** `/retragere` (OUG 34/2014 art. 11^1). Paginile legale sunt în `content/legal.ts`, iar datele firmei vin din `COMPANY_*`.
- **Verificare GoHighLevel:** `npm run ghl:check` (pipeline, etape, câmpuri, tag-uri; doar citește).

## Documente

- `docs/PRODUCTION-LAUNCH.md`: runbook de lansare (conturi, chei, Stripe, FGO, GoHighLevel, email, DNS, teste, go-live).
- `docs/OPEN-POINTS.md`: doar ce trebuie să furnizeze sau să decidă clientul.
- `docs/CONTENT-DECISIONS.md`: ce s-a păstrat, ce s-a schimbat și ce s-a scos din materialele primite, și de ce.
