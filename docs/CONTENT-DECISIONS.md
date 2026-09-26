# Decizii de conținut

## Nume și prețuri (26 septembrie 2026)

- **Pagina principală** nu mai explică produsele (secțiunile cu instrucțiuni și imagini mici au fost scoase). Are: fotografia, cele trei produse, un moment NEUROS Calm, ideea de brand cu trei fotografii din viața reală. Explicațiile stau pe paginile de produs.

- **Numele.** Produsele au primit nume sub marca NEUROS, care apare deja pe dispozitivul de gât și în aplicația Neuros Game: **NEUROS Calm** (fostul Balance Wave), **NEUROS Focus** (fostul BrainLink Pro) și **NEUROS Amber** (foștii Ochelari Biohack, după culoarea lentilelor). Biohack Tech rămâne numele magazinului. Denumirea hardware „BrainLink Pro” apare o singură dată, în specificațiile NEUROS Focus. Id-urile interne nu s-au schimbat, așa că un coș salvat rămâne valid; adresele vechi redirecționează permanent.
- **Prețurile** sunt doar în lei, într-un singur fișier (`src/config/prices.ts`). Aprobate pe 26.09.2026: NEUROS Calm 6.380 lei, NEUROS Amber 315 lei. NEUROS Focus: 2.490 lei, din materiale. Niciun curs de schimb.
- **Galeriile** sunt ordonate intenționat: produsul, produsul în folosire, unghiuri, detalii. Fiecare ramă NEUROS Amber are galeria ei și, unde există, fotografia de lifestyle cu exact rama aceea.
- **NEUROS Focus** e prezentat ca hardware plus tabletă (fotografia cu jocul pe tabletă), fără grafice de semnal EEG.

## Scene (26 septembrie 2026, a doua iterație)

Scroll-ul animat din această iterație a fost scos ulterior; paginile se derulează nativ. A rămas măsurarea contrastului
pe pixelii reali ai fotografiilor și butonul roșu mai închis: #E64545 (3,96:1) a devenit #D23B3B (4,74:1).

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
| „Cere ofertă personalizată” lângă prețuri | Prețul e fix și afișat; al doilea buton concura cu „Adaugă în coș”. Excepție: produsele fără preț aprobat în lei au „Întreabă de preț”. |

## Păstrat, cu grijă

- Studiile de pe pagina NEUROS Focus (linkuri reale, verificabile), cu mențiunea explicită că privesc metoda în general, nu acest produs.
- „Rezultatele variază de la o persoană la alta” și „nu înlocuiește sfatul medicului”, pe fiecare pagină de produs.
- Specificațiile NEUROS Focus au fost transcrise din imaginea cu componentele, ca să fie text citibil și indexabil.

## Imagini

- Fotografiile de produs sunt decupaje transparente, tăiate la conturul produsului, ca toate să aibă aceeași scară în galerie.
- `cay-eye-pink_02` avea un fundal alb opac; a fost eliminat.
- `neck-joy_02` și `neck-joy_03` sunt aproape identice; a rămas una.
- Pe site-ul vechi, alt-urile a două poze BrainLink erau inversate (meditație / lucru la laptop). Aici sunt corecte.
- Din 40 MB de PNG-uri au rămas 2 MB de WebP; `next/image` servește AVIF/WebP la dimensiunea potrivită.
