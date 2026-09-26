# Biohack Tech

Magazin online pentru NEUROS Calm, NEUROS Focus și NEUROS Amber. Face parte din același univers vizual ca [curs.neuros.ro](https://curs.neuros.ro): aceleași culori, tipografie (Geist / Geist Mono), raze, buton roșu și ierarhie a marginilor, cu o arhitectură gândită pentru vânzare.

## Pornire

```bash
npm install
cp .env.example .env.local   # cheile de plată, datele bancare, webhook-ul de comenzi
npm run dev                  # http://localhost:3000
```

Alte comenzi: `npm run build`, `npm start` (port 3000), `npm run lint`, `npm run typecheck`, `npm test` (vitest).

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4. Nicio altă dependență de runtime în afară de `server-only`.

## Structura

```
src/
  config/
    prices.ts                 SINGURUL loc cu prețuri (bani, RON). null = „Preț în curând”
    bank.ts                   datele pentru transfer și webhook-ul de comenzi, doar din variabile de mediu
    site.ts                   contact, URL, termeni comerciali (livrare, retur, garanție)
  content/
    catalog.ts                produsele: nume, variante, imagini, galerii
    product-content.ts        paginile de produs: intro, beneficii, utilizare, explicație, momente, detalii, FAQ
    legal.ts                  paginile de informații (versiuni scurte, vezi docs/OPEN-POINTS.md)
  components/
    cart/                     store în localStorage, confirmarea compactă, coșul pe <dialog>, buton, preț
    product/                  galerie, zona de cumpărare cu variante, secțiunile paginii de produs
    home/                     Hero, Discover, CalmFeature (secțiunea întunecată), FocusFeature
    scenes/                   GlassesScene (selectorul de rame) și SceneBuy (blocul de cumpărare comun)
    site/                     header, footer, raftul cu cele trei produse
  lib/
    money.ts                  RON în bani, formatare „2.490 lei”
    checkout.ts               formularul (PF/PJ, CUI, adrese, metodă de plată), validare comună client + server
    orders/                   rezolvarea liniilor pe server, referința comenzii, notificarea
    payments/                 interfața PaymentProvider + implementarea Stripe
    seo.tsx                   metadata, JSON-LD (Organization, Product, BreadcrumbList)
  assets/img/                 imaginile optimizate (generate de scripts/prepare-assets.py)
tests/                        vitest: bani, coș, validare, comenzi, IBAN
```

Produsele au slug-uri noi (`/products/calm`, `/products/focus`, `/products/amber`). Adresele vechi (`/products/balancewave`, `/brainlink`, `/glasses`) redirecționează permanent (301/308, `next.config.ts`). Restul URL-urilor sunt cele de pe site-ul actual.

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
`components/scenes/SceneBuy.tsx` (scop, nume, o propoziție, preț, „Adaugă în coș”, „Vezi produsul”),
zona de cumpărare de pe pagina de produs, confirmarea compactă, coșul și checkout-ul. Butonul roșu înseamnă mereu „cumpără”.
După „Adaugă în coș” coșul nu se deschide singur: apare o confirmare mică, cu „Finalizează comanda” și „Continuă cumpărăturile”.

## Comenzi și plăți

Browserul trimite doar id-ul produsului, id-ul variantei și cantitatea. Serverul (`lib/orders/resolve.ts`) citește numele și prețul din catalog, calculează totalul în lei și respinge orice produs necunoscut, fără preț sau cu cantitate invalidă.

- **Card:** o sesiune Stripe Checkout în RON. `/checkout/success` confirmă doar ce confirmă Stripe (`payment_status = paid`) și abia atunci scoate produsele din coș. Datele de livrare și facturare (inclusiv firmă, CUI) sunt în `metadata`.
- **Transfer bancar:** comanda pleacă la `ORDER_WEBHOOK_URL` cu statusul `awaiting_payment` și o referință `BT-XXXXXX`; clientul vede pe `/checkout/transfer` datele contului (citite pe server) și suma. Comanda nu e marcată niciodată ca plătită de site.
- O metodă apare activă doar când e configurată complet; altfel e „în curând”. Fără nicio metodă, checkout-ul trimite clientul la email / telefon și nu colectează date degeaba.
- Dublul click nu creează două comenzi: fiecare încercare are un id, iar referința și cheia de idempotență Stripe derivă din el și din conținutul comenzii.
- Pentru alt procesator: o nouă implementare a interfeței din `lib/payments/types.ts`.

Ce mai trebuie înainte de lansare: docs/OPEN-POINTS.md.

## Documente

- `docs/OPEN-POINTS.md`: ce lipsește din materiale și trebuie decis de client înainte de lansare.
- `docs/CONTENT-DECISIONS.md`: ce s-a păstrat, ce s-a schimbat și ce s-a scos din materialele primite, și de ce.
