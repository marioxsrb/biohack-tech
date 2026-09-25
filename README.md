# Biohack Tech

Magazin online pentru Balance Wave, BrainLink Pro și Ochelari Biohack. Face parte din același univers vizual ca [curs.neuros.ro](https://curs.neuros.ro): aceleași culori, tipografie (Geist / Geist Mono), raze, buton roșu și ierarhie a marginilor, cu o arhitectură gândită pentru vânzare.

## Pornire

```bash
npm install
cp .env.example .env.local   # completează STRIPE_SECRET_KEY pentru plăți
npm run dev                  # http://localhost:3004
```

Alte comenzi: `npm run build`, `npm start`, `npm run lint`, `npm run typecheck`.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4. Nicio altă dependență de runtime.

## Structura

```
src/
  config/site.ts              contact, URL, termeni comerciali (livrare, retur, garanție)
  content/
    catalog.ts                produsele: preț, variante, imagini (tot ce trebuie coșului)
    product-content.ts        paginile de produs: intro, beneficii, povești foto, pași, explicație, detalii, FAQ
    legal.ts                  paginile de informații (versiuni scurte, vezi docs/OPEN-POINTS.md)
  components/
    cart/                     coșul: store în localStorage, drawer pe <dialog>, buton, stepper
    product/                  galerie, zona de cumpărare cu variante, secțiunile paginii de produs
    home/                     pagina principală, secțiuni simple: Hero, Discover (cele trei panouri peste fotografie),
                              BalanceWaveFeature (secțiunea întunecată), BrainLinkFeature
    scenes/                   GlassesScene (selectorul de rame) și SceneBuy (blocul de cumpărare comun)
    site/                     header, footer, raftul cu cele trei produse
  lib/
    money.ts                  prețuri în unități mici (bani/cenți), formatare ro-RO
    checkout.ts               validare comună client + server
    payments/                 interfața PaymentProvider + implementarea Stripe
    seo.tsx                   metadata, JSON-LD (Organization, Product, BreadcrumbList)
  assets/img/                 imaginile optimizate (generate de scripts/prepare-assets.py)
```

URL-urile sunt identice cu site-ul actual (`/products/glasses`, `/products/balancewave`, `/products/brainlink`, `/about-us`, `/contact-us`, paginile legale), ca linkurile existente și indexarea să nu se piardă.

## Cum adaugi sau modifici un produs

1. Pune imaginile în ZIP-ul sursă și adaugă o linie în `scripts/prepare-assets.py`, apoi `npm run assets`.
2. Adaugă produsul în `content/catalog.ts` (preț în unități mici: 60 EUR = `6000`).
3. Adaugă conținutul paginii în `content/product-content.ts`. Secțiunile opționale (`steps`, `detail`) apar doar dacă există.

## Mișcare

Pagina se derulează nativ. Nicio secțiune nu depinde de poziția de scroll și nimic nu e ascuns în așteptarea
JavaScript-ului: tot conținutul e randat de server și rămâne vizibil chiar fără script.
Mișcarea există doar ca răspuns la vizitator (hover, alegerea ramei, adăugarea în coș) și ca un singur efect
la încărcare (fotografia din hero), totul în CSS. Header-ul are două stări, alese de un IntersectionObserver.

## Regula de bază: poveste liberă, cumpărare convențională

Scenele pot fi editoriale. Tot ce ține de cumpărare arată și se comportă la fel peste tot:
`components/scenes/SceneBuy.tsx` (scop, nume, o propoziție, preț, „Adaugă în coș”, „Vezi produsul”),
zona de cumpărare de pe pagina de produs, coșul și checkout-ul. Butonul roșu înseamnă mereu „cumpără”.

## Plăți

Checkout-ul colectează datele de livrare pe site, apoi trimite cumpărătorul pe pagina de plată Stripe (Stripe Checkout). Prețurile sunt citite pe server din catalog; clientul trimite doar id-uri și cantități.

- Fără `STRIPE_SECRET_KEY`, `/api/checkout` răspunde 503, iar formularul îi spune cumpărătorului că plata online nu e activă și cum poate comanda. Nu se simulează nicio comandă.
- `/checkout/success` confirmă doar ce confirmă Stripe (`payment_status = paid`) și abia atunci scoate din coș produsele plătite.
- Datele de livrare ajung în `metadata` pe sesiunea și pe PaymentIntent-ul Stripe.
- Pentru alt procesator: o nouă implementare a interfeței din `lib/payments/types.ts`.

Înainte de lansare mai e nevoie de un webhook `checkout.session.completed` pentru notificarea echipei și facturare (vezi docs/OPEN-POINTS.md).

## Documente

- `docs/OPEN-POINTS.md`: ce lipsește din materiale și trebuie decis de client înainte de lansare.
- `docs/CONTENT-DECISIONS.md`: ce s-a păstrat, ce s-a schimbat și ce s-a scos din materialele primite, și de ce.
