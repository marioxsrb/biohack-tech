# Reclame: tot ce a rulat și rulează

**Scop:** o listă cu toate reclamele (Meta, Google, TikTok), ce mesaj și ce imagine/video au, cât au costat și ce au adus, ca să vedem ce merge.

## Ce acces avem acum
- Site-ul trimite către Meta evenimentele de cumpărare (Meta Pixel + Conversions API). Asta **nu** permite citirea reclamelor sau a rezultatelor.
- **Nu avem** acces la contul de reclame (Ads Manager).

## Ce ne trebuie (una dintre variante)
1. **Cel mai bine:** un „System User” în Meta Business Manager cu permisiunea `ads_read` pe contul de reclame al proiectului, și tokenul lui. Așa Claude citește singur campaniile, reclamele și rezultatele, oricând.
2. **Mai simplu:** un export din Ads Manager (CSV), pe toată perioada, la nivel de reclamă, cu coloanele: campanie, set, reclamă, stare, buget, cheltuieli, afișări, click-uri, CTR, adăugări în coș, cumpărări, valoare, ROAS. Plus imaginile/video-urile.
3. Același lucru pentru Google Ads / TikTok, dacă rulează.

## Ce putem vedea fără acces
Reclamele **active** acum sunt publice în Meta Ad Library (facebook.com/ads/library). Le pot lua de acolo (text și imagine), dar fără cheltuieli și rezultate.

## Tabelul (de completat după acces)

| Platformă | Campanie | Reclamă | Produs | Mesaj / unghi | Perioadă | Cheltuit (lei) | Cumpărări | ROAS | Concluzie |
|---|---|---|---|---|---|---|---|---|---|
