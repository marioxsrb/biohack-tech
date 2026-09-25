# De decis înainte de lansare

Lucruri care lipsesc din materialele primite (ZIP, 25 septembrie 2026). Nu au fost inventate.

## Blocante

1. **Monedele sunt amestecate.** Balance Wave (1.210 EUR) și Ochelarii (60 EUR) sunt în euro, BrainLink Pro (2.490 RON) în lei, exact ca pe site-ul actual. Stripe nu poate încasa două monede într-o singură plată, așa că un coș mixt se plătește în două tranzacții (checkout-ul te lasă să alegi moneda și păstrează restul în coș). Recomandare: toate prețurile în aceeași monedă, ideal RON. Se schimbă în `src/content/catalog.ts`.
2. **Cheia Stripe.** Fără `STRIPE_SECRET_KEY`, plata nu pornește (intenționat). Testat: toate căile de eroare. Netestat: o plată reală în modul test, care are nevoie de cheie.
3. **Datele firmei.** Denumirea legală, CUI, nr. Registrul Comerțului și sediul nu apar nicăieri în materiale. Sunt obligatorii în footer și în termeni.
4. **Textele legale complete.** ZIP-ul are doar titlurile secțiunilor. Paginile publicate conțin doar faptele confirmate (livrare 1–3 + 2–5 zile, AWB, retur 14 zile, garanție 2 ani, Stripe) și spun deschis că textul complet urmează.
5. **Notificarea comenzilor.** După plată, comanda există doar în Stripe. Trebuie un webhook `checkout.session.completed` care anunță echipa (email / CRM) și emite factura.

## De confirmat

6. **Certificările CE și FCC** pentru BrainLink Pro apar în copy. Păstrate, dar trebuie documentele înainte de publicare.
7. **Ce conține cutia** fiecărui produs. Nu apare în materiale, așa că secțiunea lipsește. O fotografie arată BrainLink Pro lângă o geantă de transport, dar nu scrie că e inclusă.
8. **Tableta pentru BrainLink Pro.** Copy-ul spune că aplicația Neuros Game rulează pe tabletă. Nu reiese dacă tableta e inclusă; site-ul spune „ai nevoie de o tabletă”.
9. **Adresa de email** este `contact@neuros.ro` (din materiale). Dacă Biohack Tech are adresă proprie, se schimbă în `src/config/site.ts`.
10. **Logo.** Nu există fișier de logo în ZIP; header-ul folosește un wordmark text „BIOHACK TECH”.
11. **Brain Flow** (casca cu laser, 810 nm) apare în copy-ul vechi, dar nu are pagină, preț sau descriere. Nu apare pe site. Pozele lui sunt în `08_Nefolosite-pe-site`.
12. **Formular de contact.** Site-ul vechi avea unul, fără backend precizat. Pagina de contact are acum email și telefon direct; un formular are nevoie de un serviciu de trimitere (Resend, CRM etc.).
