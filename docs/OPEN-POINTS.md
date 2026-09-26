# De decis înainte de lansare

Doar informații de business care lipsesc din materialele primite (ZIP, 25 septembrie 2026). Nimic de aici nu a fost inventat pe site: unde lipsește o valoare, site-ul spune deschis că urmează sau oprește funcția respectivă.

## Blocante

1. **Prețurile în lei pentru NEUROS Calm și NEUROS Amber.** Materialele au doar 1.210 EUR (Calm) și 60 EUR (Amber). Nu am aplicat niciun curs de schimb. Până la un preț aprobat în lei, cele două produse afișează „Preț în curând” și „Întreabă de preț” și nu pot fi puse în coș. Prețul se completează într-un singur loc: `src/config/prices.ts` (în bani, TVA inclus: 1.990 lei = `199000`). NEUROS Focus are 2.490 lei, din materiale.
2. **Plata cu cardul: cheia Stripe.** `STRIPE_SECRET_KEY` (sk_live_… / sk_test_…). Fără ea, opțiunea „Card bancar” apare ca „în curând”. Testat: toate căile de eroare (inclusiv o cheie invalidă). Netestat: o plată reală în modul test Stripe, care are nevoie de cheie.
3. **Transfer bancar: datele contului.** `BANK_BENEFICIARY`, `BANK_NAME`, `BANK_IBAN` și, opțional, `BANK_SWIFT`. IBAN-ul este verificat automat (cifra de control); un IBAN greșit oprește transferul în loc să fie afișat clienților.
4. **Unde ajung comenzile.** Comenzile prin transfer sunt trimise ca JSON la `ORDER_WEBHOOK_URL` (Make, Zapier, n8n sau sistemul vostru), cu `status: awaiting_payment`, referința `BT-XXXXXX` în header-ul `Idempotency-Key` și, opțional, `Authorization: Bearer ORDER_WEBHOOK_SECRET`. Fără webhook, transferul bancar rămâne oprit: o comandă nu are voie să se piardă. Tot acolo trebuie hotărât cine trimite clientului emailul de confirmare și cine marchează comanda plătită după extras. Site-ul nu marchează niciodată o comandă prin transfer ca plătită.
5. **Plățile cu cardul, după plată.** Comanda există în Stripe (cu datele de livrare și facturare în `metadata`). Pentru notificarea echipei și factură e nevoie de un webhook Stripe `checkout.session.completed` spre același sistem.
6. **Datele firmei vânzătoare.** Denumirea legală, CUI, nr. Registrul Comerțului și sediul nu apar în materiale. Sunt obligatorii în footer, în termeni și pe factură.
7. **Textele legale complete.** ZIP-ul are doar titlurile secțiunilor. Paginile publicate conțin doar faptele confirmate (livrare 1-3 + 2-5 zile, AWB, retur 14 zile, garanție 2 ani, card sau transfer) și spun deschis că textul complet urmează.

## De confirmat

8. **Termenul de plată pentru transfer.** Cât timp rezervăm o comandă neplătită? Nu apare în materiale, așa că pagina de confirmare nu promite niciun termen.
9. **Certificările CE și FCC** pentru NEUROS Focus apar în specificații. Păstrate, dar trebuie documentele înainte de publicare.
10. **Numele NEUROS Calm / Focus / Amber.** Propunere (vezi `docs/CONTENT-DECISIONS.md`). Dacă se aleg alte nume, se schimbă în `src/content/catalog.ts`; slug-urile vechi (`/products/balancewave`, `/brainlink`, `/glasses`) redirecționează deja permanent.
11. **Ce conține cutia** fiecărui produs. Nu apare în materiale, așa că secțiunea lipsește. O fotografie arată casca lângă o geantă de transport, dar nu scrie că e inclusă.
12. **Tableta pentru NEUROS Focus.** Aplicația Neuros Game rulează pe tabletă. Nu reiese dacă tableta e inclusă; site-ul spune „ai nevoie de o tabletă”.
13. **Adresa de email** este `contact@neuros.ro` (din materiale). Dacă Biohack Tech are adresă proprie, se schimbă în `src/config/site.ts`.
14. **Logo.** Nu există fișier de logo în ZIP; header-ul folosește wordmark-ul text „BIOHACK TECH”.
