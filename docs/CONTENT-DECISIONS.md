# Decizii de conținut

## Nume și prețuri (26 septembrie 2026)

- **Pagina principală** nu mai explică produsele (secțiunile cu instrucțiuni și imagini mici au fost scoase). Are: fotografia, cele trei produse, un moment NEUROS Calm, ideea de brand cu trei fotografii din viața reală. Explicațiile stau pe paginile de produs.

- **Numele.** Produsele au primit nume sub marca NEUROS, care apare deja pe dispozitivul de gât și în aplicația Neuros Game: **NEUROS Calm** (fostul Balance Wave), **NEUROS Focus** (fostul BrainLink Pro) și **NEUROS Amber** (foștii Ochelari Biohack, după culoarea lentilelor). Biohack Tech rămâne numele magazinului. Denumirea hardware „BrainLink Pro” apare o singură dată, în specificațiile NEUROS Focus. Id-urile interne nu s-au schimbat, așa că un coș salvat rămâne valid; adresele vechi redirecționează permanent.
- **Prețurile** sunt doar în lei, într-un singur fișier (`src/config/prices.ts`). Aprobate pe 26.09.2026: NEUROS Calm 6.380 lei, NEUROS Amber 315 lei. NEUROS Focus: 790 lei (prețul nou, stabilit 30.09.2026; nu este o reducere, nu se afișează preț barat). Niciun curs de schimb.
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
| Cele 6 testimoniale | Nu pot fi verificate. O fotografie e o previzualizare Shutterstock cu watermark, „Dr. Ioana R., neurolog” are poza modelului NEUROS Flow, iar două testimoniale vorbesc despre NEUROS Flow, care nu se vinde. |
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

## Faza 3/4: NEUROS Flow devine produsul 4 (29.09.2026)

Decizia de mai sus („NEUROS Flow, care nu se vinde”) este înlocuită la cerere: NEUROS Flow se vinde, cu trei configurații (1, 4, 13 zone). Păstrăm numele din sursă (fără marca NEUROS, nestatată pentru el), prețurile din sursă (de confirmat, vezi OPEN-POINTS) și doar faptele tehnice (810 nm, zone, telecomandă, baterie, consultație inițială). Studiile medicale și testimonialele din sursă nu sunt folosite. Pe pagina principală, cardurile trec de la trei la patru (două pe rând pe tabletă).

## Faza 3.5: pagina principală mai completă (29.09.2026)

Ordinea: hero, produsele (cu oferta lor, discret), ideea de brand cu cele patru produse în viața reală, „Aceeași zi. Alt ritm.” (fără obicei / cu un obicei BiohackTech, despre rutine, nu despre rezultate), „O zi, patru momente.” (experiențe descrise de noi, cu oameni în cadru, nu citate de clienți), cele două oferte, momentul NEUROS Calm, întrebări frecvente, contact. Secțiunile deschise și închise alternează. Testimonialele din sursă rămân nefolosite; arhitectura le afișează doar dacă se adaugă unele reale, cu acord și sursă (`src/content/home.ts`).

## Pagina principală editată și NEUROS Flow (29.09.2026)

- Casca de fotobiomodulare se numește pentru clienți **NEUROS Flow** (fost „Brain Flow”). Id-ul tehnic rămâne `brain-flow`.
- Pagina principală a fost editată, nu extinsă: au ieșit secțiunea de brand cu 4 fotografii, „O zi, patru momente” (4 fotografii), momentul NEUROS Calm și fotografia din contact. Au rămas două fotografii cu oameni (hero, „Ce vrei să schimbi?”) și imaginile produselor.
- „Ce vrei să schimbi?” înlocuiește momentele zilei: patru nevoi, fiecare cu produsul ei și cum se folosește.
- Întrebările: 7 pe pagina principală (cele care decid cumpărarea), toate 14 pe `/intrebari-frecvente`.

## Trecerea finală pe pagina principală și landingurile refăcute (29.09.2026)

- Produsele apar o singură dată pe pagina principală: un raft editorial cu patru produse (momentul, ce este, prețul, oferta, o acțiune). „Ce vrei să schimbi?” a ieșit, pentru că repeta produsele.
- Ordinea: hero, produsele, de ce Biohack Tech (trei puncte, o fotografie), „Aceeași zi. Alt ritm.”, ofertele, întrebările, contactul.
- „Aceeași zi. Alt ritm.” compară patru momente (relaxare, atenție, ecrane, acasă), fără o rutină și cu o rutină. Nu vorbește despre amânare și nu promite rezultate. Fără simboluri ❌/✅.
- Contactul este un panou de suport („Nu ești sigur ce să alegi?”) lângă formular, fără fotografie.
- În coș, progresul spre oferte are trei stări (departe, încă un produs, activă), cu butoane explicite. Nimic nu se adaugă automat.
- Fiecare landing este o prezentare completă, cu povestea produsului: NEUROS Calm (seara, liniștit, cald), NEUROS Focus (munca și jocul care antrenează atenția, fără ton de gaming), NEUROS Amber (ecranele serii, 2+1 calculat cu prețurile reale), NEUROS Flow (cel mai explicativ, cu specialistul și cele trei configurații).
- Nu există testimoniale, ratinguri, certificări noi sau promisiuni medicale. Locul pentru testimoniale există, dar nu se afișează gol.
- Sunt folosite doar faptele deja prezente pe paginile de produs.

## Fluxul de cumpărare și NEUROS Amber în familia Biohack Tech (29.09.2026)

- Landingul NEUROS Amber folosește acum suprafețele, tipografia, liniile și butonul roșu ale site-ului. Căldura vine din fotografiile cu lentile, dintr-o singură culoare de accent (chihlimbar), dintr-o lumină caldă discretă în hero și în secțiunea de seară și din panoul cald al ofertei 2+1. Nu mai are fundal crem și maro peste tot.
- Pe landingul NEUROS Amber se poate alege și numărul de perechi. La 3 perechi, totalul arată direct reducerea 2+1, calculată de același motor ca în coș.
- În coș, beneficiul este partea cea mai vizibilă („și primești 20% reducere.”, „și primești 2+1 gratis.”), cu suma exactă economisită. Butoanele ofertei sunt teal, ca să nu concureze cu „Finalizează comanda”.

## Landinguri curățate, NEUROS Amber mix and match, checkout concentrat (29.09.2026)

- Fiecare secțiune de landing are o singură treabă. Au ieșit repetițiile: la NEUROS Calm „Ce este” (titlul repeta hero-ul) s-a unit cu „Trei gesturi”, iar „Ce primești” a intrat în blocul de comandă; la NEUROS Focus au ieșit banda cu cifre și „Trei pași” (repetau hero-ul, mecanismul și specificațiile), iar detaliile au intrat în blocul de comandă; la NEUROS Flow a ieșit „Pe scurt” (repeta hero-ul) și 810 nm apare doar în hero și în fișa tehnică; la NEUROS Amber, banda cu rame, blocul 2+1, oferta pe o singură ramă și specificațiile s-au unit în selectorul de perechi.
- Prețul apare în hero, în locul unde alegi (bloc de comandă / selector) și în bara fixă de pe telefon. Secțiunea finală are o frază și un buton, fără preț.
- NEUROS Amber folosește exact paleta site-ului; căldura vine din fotografii și dintr-un accent chihlimbar mic (eticheta 2+1, progresul). Fără suprafețe, borduri sau texte maro.
- Checkout-ul nu mai arată meniul și lista de produse, nici venind de pe site, nici de pe un landing.
