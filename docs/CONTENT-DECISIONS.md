# Decizii de conținut

## Scene (26 septembrie 2026, a doua iterație)

Pagina principală e o succesiune de șase scene, cu foarte puțin text: campania (hero), „Ce vrei să îmbunătățești?”,
Balance Wave (camera se întunecă, dispozitivul se aprinde), BrainLink (un semnal care se liniștește când ții apăsat,
marcat „Ilustrație”), Ochelarii (selector de rame, ca într-un magazin de modă) și raftul cu toate trei.
Contrastul a fost măsurat pe pixelii reali ai fotografiilor, nu estimat: meniul și textul din hero trec pragul WCAG.
Butonul roșu a trecut de la #E64545 (3,96:1) la #D23B3B (4,74:1).

## Direcția (26 septembrie 2026)

Site-ul e un magazin cu trei produse, nu o pagină de vânzare lungă. Pagina principală are cinci momente: o fotografie mare cu un singur mesaj, cele trei produse, o frază despre brand, livrare/retur/garanție și, în footer, drumul înapoi spre produse. Detaliile tehnice stau pe paginile de produs, mai jos, explicate o singură dată.

Copy-ul din ZIP e materie primă. A fost rescris pentru cineva care vede produsul prima dată: ce e, ce face pentru tine, cum îl folosești, cât costă. Faptele și limitele afirmațiilor au rămas aceleași. Exemple:

| Înainte | Acum |
| --- | --- |
| Stimularea nervului vag prin photobiomodulare duală | Se poartă la gât. Câteva minute de lumină roșie, când ai nevoie de liniște. |
| Neuromodulare EEG · 3 electrozi · 10+ jocuri | O cască ușoară și jocuri pe tabletă pe care le controlezi cu atenția. |
| Antrenament mental EEG | Pentru focus |

Scoase de pe pagina principală: tabelul de comparație, „Cum comanzi”, FAQ-ul general, secțiunea „Abordare”, numerotarea 01/02/03, faptele tehnice din fiecare rând de produs. De pe paginile de produs: diagrama explodată (etichete ilizibile), blocul de contact repetat, lista de studii desfășurată (acum ascunsă sub „Vezi studiile”).


Sursa: `Biohack-Tech_Structura_si_Copy.docx` și folderul `poze/` din ZIP. Copy-ul a fost scurtat și reorganizat; sensul a rămas același. Nicio afirmație nouă despre produse.

## Scos, și de ce

| Ce | De ce |
| --- | --- |
| Statisticile de pe home (92% somn mai bun, 85% concentrare, 2.500+ hărți qEEG) | Fără sursă sau metodologie. Ca afirmații de sănătate, nu pot fi publicate fără dovadă. |
| Cele 6 testimoniale | Nu pot fi verificate. O fotografie e o previzualizare Shutterstock cu watermark, „Dr. Ioana R., neurolog” are poza modelului Brain Flow, iar două testimoniale vorbesc despre Brain Flow, care nu se vinde. |
| Badge-ul „Dovedit științific” | Niciun studiu din materiale nu testează aceste produse. |
| „Înainte / după Biohack Tech” (te trezești odihnit, rămâi calm…) | Promisiuni de rezultat pe care produsele nu le pot garanta. |
| Ochelari: „pot inhiba cortizolul și promova melatonina” | Afirmație hormonală fără sursă. Rămâne efectul direct: filtrează lumina albastră, lumină mai blândă seara. |
| Balance Wave: „anxietate”, „echilibru cardiac” | Termeni medicali. Rămâne formularea de wellness: stres, relaxare, confort cervical. Explicația anatomică a nervului vag a rămas. |
| BrainLink: „de ultimă generație”, „unul dintre cele mai mici dispozitive EEG din lume”, „100% privat” | Superlative fără sursă. Rămâne faptul: detectează stări mentale, nu gânduri. |
| Video-ul Balance Wave (`neck-joy_unknown.mp4`) | În engleză, menționează migrene și digestie și un „Seal of Approval” neverificat. |
| Slider-ul din hero | Carusel automat cu un singur mesaj vizibil. Înlocuit cu toate trei produsele vizibile deodată. |
| „Cere ofertă personalizată” lângă prețuri | Prețul e fix și afișat; al doilea buton concura cu „Adaugă în coș”. Recomandarea de specialist a rămas ca link de contact. |

## Păstrat, cu grijă

- Studiile de pe pagina BrainLink Pro (linkuri reale, verificabile), cu mențiunea explicită că nu testează BrainLink Pro direct.
- „Rezultatele variază de la o persoană la alta” și „nu înlocuiește sfatul medicului”, pe fiecare pagină de produs.
- Specificațiile BrainLink Pro au fost transcrise din imaginea cu componentele, ca să fie text citibil și indexabil.

## Imagini

- Fotografiile de produs sunt decupaje transparente, tăiate la conturul produsului, ca toate să aibă aceeași scară în galerie.
- `cay-eye-pink_02` avea un fundal alb opac; a fost eliminat.
- `neck-joy_02` și `neck-joy_03` sunt aproape identice; a rămas una.
- Pe site-ul vechi, alt-urile a două poze BrainLink erau inversate (meditație / lucru la laptop). Aici sunt corecte.
- Din 40 MB de PNG-uri au rămas 2 MB de WebP; `next/image` servește AVIF/WebP la dimensiunea potrivită.
