# Test A/B: comanda telefonică întâi vs. comanda pe site

**Întrebarea:** vindem mai mult dacă butonul principal e comanda prin telefon (omul vorbește cu cineva care îi înțelege nevoile) decât comanda directă pe site?
**Durata:** 2 săptămâni. **Unde:** paginile de produs Calm, Focus, Amber (și subdomeniile lor), site-ul în română.

## Variantele

| | A (cum e acum) | B (telefon întâi) |
|---|---|---|
| Butonul roșu, mare | „Comandă acum” (site) | „Sună și comandă” + număr, sau „Te sunăm noi în 5 minute” (nume + telefon) |
| Dedesubt | Telefon, WhatsApp, Adaugă în coș | Comandă pe site, WhatsApp, Adaugă în coș |

Fiecare vizitator vede mereu aceeași variantă (50% / 50%, ținut minte în browser).

## Ce măsurăm
- **Principal:** comenzi finalizate la 100 de vizitatori, pe variantă (comenzi pe site + comenzi luate la telefon).
- **Și:** încasări la 100 de vizitatori, valoarea medie a comenzii, comenzi refuzate la livrare (ramburs), cereri de apel la care n-am răspuns.

## Partea grea: să știm din ce variantă vine o comandă telefonică
Propunerea: în varianta B butonul principal e **„Te sunăm noi”** (formular cu nume și telefon). Cererea intră în admin cu varianta B atașată; când omul de la telefon pune comanda în admin, ea rămâne legată de cerere. Click-urile pe „Sună” le numărăm separat. Alternativa: un număr de telefon diferit pentru varianta B.

## Ce ne trebuie de la echipă înainte de start
- [ ] Cine răspunde la telefon, în ce ore (și ce facem cu cererile din afara programului)
- [ ] Câte apeluri pe zi puteți prelua (testul poate aduce zeci)
- [ ] Scriptul de apel: întrebările pentru nevoi („pentru cine e?”, „ce vrei să se schimbe?”), răspunsurile la obiecții, cum închizi comanda
- [ ] Cererile de apel le preia un om sau și agentul AI de apeluri?

## După 2 săptămâni
Raport cu cifrele pe variantă și o recomandare. Dacă diferența nu e clară (prea puține comenzi), prelungim sau decidem pe încasări la vizitator.
