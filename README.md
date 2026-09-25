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
    home/                     hero (parallax, hotspot pe dispozitiv) și scena „Ce vrei să îmbunătățești?”
    scenes/                   momentul fiecărui produs, folosit pe home și pe pagina lui:
                              Balance Wave (se aprinde la scroll), BrainLink (semnal interactiv), Ochelari (selector de rame)
    motion/scroll-vars.ts     un singur listener de scroll care scrie --in / --pin / --out; animațiile sunt CSS
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

Toate animațiile folosesc doar `transform`, `opacity`, `filter` și culoare, citite din variabile CSS scrise de
`motion/scroll-vars.ts` (un listener pasiv, `requestAnimationFrame`, nicio bibliotecă). Semnalul BrainLink rulează
doar cât scena e vizibilă. Cu `prefers-reduced-motion`, fiecare scenă apare direct în starea finală.

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
