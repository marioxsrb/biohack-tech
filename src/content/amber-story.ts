/**
 * NEUROS Amber product page (Romanian): the two-step evening (galben, then roșu), when to wear each lens,
 * the lens comparison, "Știai că?", the studies explained simply and the questions people ask.
 * Every number here was checked against the abstract or full text linked next to it (PubMed, October 2026).
 * The studies are about amber/orange blue-blocking lenses and evening light in general, not NEUROS Amber itself.
 * Wellness copy: it supports calmer evenings, it does not treat insomnia or any other condition.
 */
import type { Chart } from '@/content/calm-science'
import type { FocusFact } from '@/content/focus-story'

import { terms } from '@/config/site'

const doi = (d: string) => `https://doi.org/${d}`

export type AmberLens = 'galben' | 'rosu'

// ── 1. Seara în doi pași ───────────────────────────────────────────────────────

/** The idea behind the two lenses: one for the evening, one for the last hour. Same frame, only the lens differs. */
export const amberRoutine = {
  title: 'Seara în doi pași',
  intro: 'Aceeași ramă, două lentile. Galbenul te însoțește de la apus, iar roșul preia ultima oră înainte de somn. Așa lumina scade treptat, ca afară.',
  steps: [
    {
      lens: 'galben',
      when: 'De la apus',
      title: 'Lentila galbenă, pentru ultimele 2–3 ore ale zilei',
      text: 'Când se întunecă afară, acasă se aprind becurile și ecranele. Lentila galbenă oprește cea mai mare parte din lumina albastră, iar tu îți vezi liniștit de seară.',
      bullets: [
        'O porți la laptop, la serial sau la cină',
        'Culorile rămân ușor de recunoscut',
        'Becurile LED reci par mai calde',
      ],
    },
    {
      lens: 'rosu',
      when: 'Ultima oră înainte de somn',
      title: 'Lentila roșie, pentru ultima oră',
      text: 'Când ajungi în pat, schimbi lentila. Cea roșie oprește lumina albastră și o bună parte din cea verde, așa că seara se așază mai ușor.',
      bullets: [
        'O porți în pat, la citit sau cu telefonul în mână',
        'Camera pare luminată de o lumânare',
        'O dai jos când stingi lumina',
      ],
    },
  ] satisfies { lens: AmberLens; when: string; title: string; text: string; bullets: string[] }[],
}

// ── 2. Când le porți ───────────────────────────────────────────────────────────

/** Everyday situations and the lens that fits each one. */
export const amberWhen = {
  title: 'Când le porți',
  intro: 'Seara arată diferit pentru fiecare. Iată câteva momente în care ochelarii își fac treaba.',
  cards: [
    { title: 'Seara, la laptop', text: 'Mai ai un email de trimis după cină. Pui lentila galbenă și termini fără lumina rece a ecranului în ochi.', lens: 'galben' },
    { title: 'Un episod din serialul preferat', text: 'Te uiți la televizor cu toată familia. Lentila galbenă face lumina din sufragerie mai blândă.', lens: 'galben' },
    { title: 'Telefonul, în pat', text: 'Mai citești câteva mesaje înainte de somn. Lentila roșie oprește și mai mult din lumina ecranului.', lens: 'rosu' },
    { title: 'O carte înainte de somn', text: 'Citești pe tabletă sau la veioză. Cu lentila roșie, ultima oră a zilei devine mai liniștită.', lens: 'rosu' },
    { title: 'După o tură de noapte', text: 'Ajungi acasă când alții se trezesc. Porți lentila galbenă cât îți faci treburile, apoi pe cea roșie până adormi.', lens: 'ambele' },
    { title: 'În călătorii, cu alt fus orar', text: 'Seara, în hotel sau în avion, ecranele și luminile sunt peste tot. Ochelarii îți fac seara mai blândă oriunde ai fi.', lens: 'ambele' },
    { title: 'Noaptea, cu bebelușul', text: 'Te trezești să îl hrănești sau să îl liniștești. Pui lentila roșie și aprinzi lumina fără să te trezești de tot.', lens: 'rosu' },
    { title: 'Seara, în bucătărie', text: 'Speli vasele și pregătești ziua de mâine sub becuri puternice. Lentila galbenă le face mai calde.', lens: 'galben' },
  ] satisfies { title: string; text: string; lens: AmberLens | 'ambele' }[],
}

// ── 3. Galben sau roșu ─────────────────────────────────────────────────────────

/** Side-by-side comparison of the two lenses. Wavelengths are approximate, in general optical terms. */
export const amberCompare = {
  title: 'Galben sau roșu?',
  intro: 'Rama e aceeași. Diferă doar cât de mult din lumină oprește lentila.',
  rows: [
    { label: 'Ce oprește', galben: 'Cea mai mare parte din lumina albastră (aproximativ 400–500 nm)', rosu: 'Lumina albastră și o bună parte din cea verde (până pe la 550 nm și puțin peste)' },
    { label: 'Ce lasă să treacă', galben: 'Verdele, galbenul, portocaliul și roșul', rosu: 'Mai ales portocaliul și roșul' },
    { label: 'Când o porți', galben: 'De la apus, în ultimele 2–3 ore ale zilei', rosu: 'În ultima oră înainte de somn' },
    { label: 'Ce vezi prin ea', galben: 'Culori mai calde. Albul pare crem', rosu: 'Totul în nuanțe de portocaliu și roșu. Albastrul și verdele par închise' },
    { label: 'La ecran', galben: 'Lucrezi și citești ușor, culorile se recunosc', rosu: 'Bună pentru citit și pentru telefon, mai puțin pentru lucru în care contează culorile' },
    { label: 'Lumina din casă', galben: 'Becurile LED reci par mai calde', rosu: 'Camera pare luminată de o lumânare' },
    { label: 'Potrivită pentru', galben: 'Laptop, serial, cină, treburile de seară', rosu: 'Pat, carte, telefon, ultimele minute înainte să stingi lumina' },
    { label: 'La volan, noaptea', galben: 'Nu', rosu: 'Nu' },
  ] satisfies { label: string; galben: string; rosu: string }[],
}

// ── 4. Știai că? ───────────────────────────────────────────────────────────────

/** Short facts about light and the body clock. Each number is in the linked source. */
export const amberFacts: FocusFact[] = [
  {
    big: '446–477 nm',
    small: 'lumina albastră',
    title: 'Ceasul corpului răspunde cel mai tare la albastru',
    text: 'Cercetătorii au testat noaptea lumini de culori diferite pe 72 de oameni. Melatonina, hormonul care anunță corpului că e noapte, a scăzut cel mai mult la lumina albastră.',
    source: { label: 'Brainard și colegii, 2001, Journal of Neuroscience', url: doi('10.1523/JNEUROSCI.21-16-06405.2001') },
  },
  {
    big: '2002',
    small: 'o descoperire nouă',
    title: 'Ochiul are celule care țin ora',
    text: 'În 2002, o echipă de la Universitatea Brown a arătat că ochiul are celule speciale, care nu te ajută să vezi. Ele simt lumina și îi spun ceasului din creier dacă e zi sau noapte.',
    source: { label: 'Berson și colegii, 2002, Science', url: doi('10.1126/science.1067262') },
  },
  {
    big: '2×',
    small: 'albastru față de verde',
    title: 'Albastrul cântărește dublu',
    text: 'La Harvard, lumina albastră a scăzut melatonina de două ori mai mult decât lumina verde, la aceeași cantitate de lumină. Verdele contează și el, doar mai puțin.',
    source: { label: 'Lockley, Brainard și Czeisler, 2003, Journal of Clinical Endocrinology & Metabolism', url: doi('10.1210/jc.2003-030570') },
  },
  {
    big: '555 nm',
    small: 'galben-verde',
    title: 'Vezi bine și fără albastru',
    text: 'Vederea noastră e cea mai sensibilă la un galben-verde, în jur de 555 nm. De aceea, printr-o lentilă galbenă vezi în continuare clar.',
    source: { label: 'Lockley, Brainard și Czeisler, 2003, Journal of Clinical Endocrinology & Metabolism', url: doi('10.1210/jc.2003-030570') },
  },
  {
    big: '~90 min',
    small: 'mai puțină noapte',
    title: 'Lumina din cameră scurtează noaptea corpului',
    text: 'La 116 tineri, lumina obișnuită din cameră, în orele dinaintea somnului, a scurtat cu aproximativ 90 de minute perioada în care corpul produce melatonină.',
    source: { label: 'Gooley și colegii, 2011, Journal of Clinical Endocrinology & Metabolism', url: doi('10.1210/jc.2010-2098') },
  },
  {
    big: '99%',
    small: 'dintre participanți',
    title: 'Aproape toți au primit semnalul de noapte mai târziu',
    text: 'În același studiu, la 99% dintre oameni melatonina a pornit mai târziu în lumina camerei decât în lumină slabă.',
    source: { label: 'Gooley și colegii, 2011, Journal of Clinical Endocrinology & Metabolism', url: doi('10.1210/jc.2010-2098') },
  },
  {
    big: '~100 lux',
    small: 'lumina unei camere',
    title: 'Nu trebuie lumină puternică',
    text: 'O lumină slabă de cameră, de circa 100 de lucși, a avut seara jumătate din efectul unei lumini de circa 9.000 de lucși asupra ceasului corpului. Asta e puțin peste 1% din lumină.',
    source: { label: 'Zeitzer și colegii, 2000, Journal of Physiology', url: doi('10.1111/j.1469-7793.2000.00695.x') },
  },
  {
    big: '55%',
    small: 'mai puțină melatonină',
    title: 'Cititul pe tabletă, seara',
    text: 'Când oamenii au citit seara pe o tabletă în loc de o carte tipărită, melatonina lor de seară a fost cu aproximativ 55% mai mică.',
    source: { label: 'Chang și colegii, 2015, PNAS', url: doi('10.1073/pnas.1418490112') },
  },
  {
    big: '90%',
    small: 'dintre americani',
    title: 'Aproape toți folosim ecrane înainte de somn',
    text: 'Un sondaj pe 1.508 adulți americani a arătat că 90% folosesc un dispozitiv electronic în ultima oră înainte de culcare, cel puțin câteva seri pe săptămână.',
    source: { label: 'Sondaj citat de Chang și colegii, 2015, PNAS', url: doi('10.1073/pnas.1418490112') },
  },
]

// ── 5. Ce spune știința ────────────────────────────────────────────────────────

/** Header and footnote for the studies section. */
export const amberScience = {
  title: 'Ce spune știința, pe înțelesul tuturor',
  intro: 'Seara, corpul se pregătește de somn și produce melatonină. Lumina albastră, iar într-o măsură mai mică și cea verde, îi spune ceasului din creier că e încă zi. Lentilele galbene și roșii opresc o parte din această lumină.',
  studiesTitle: 'Studiile, explicate simplu',
  footnote: 'Studiile privesc lentilele chihlimbar și portocalii în general și lumina de seară, nu ochelarii NEUROS Amber în sine. Rezultatele diferă de la un studiu la altul: o analiză Cochrane din 2023 a găsit rezultate amestecate pentru somn. NEUROS Amber este un produs de wellness, nu un dispozitiv medical, și nu înlocuiește un tratament.',
}

export type AmberStudy = {
  tag: 'Somn' | 'Lumina' | 'Ecrane'
  title: string
  text: string
  cite: string
  url: string
  chart?: Chart
  visual?: 'melatonin' | 'spectrum' | 'clock'
}

/** The studies, in plain words. Charts only use numbers stated in the paper. */
export const amberStudies: AmberStudy[] = [
  {
    tag: 'Somn',
    title: 'Ochelari chihlimbar, 3 ore înainte de somn',
    text: '20 de adulți au purtat seara, timp de 2 săptămâni, fie ochelari chihlimbar, fie ochelari care nu opreau lumina albastră. Cei cu lentile chihlimbar au spus că au dormit mai bine și s-au simțit mai bine dispuși.',
    cite: 'Burkhart și Phelps, 2009, Chronobiology International',
    url: doi('10.3109/07420520903523719'),
    visual: 'clock',
  },
  {
    tag: 'Somn',
    title: 'O săptămână cu lentile chihlimbar',
    text: '14 adulți care dormeau greu au purtat 2 ore înainte de culcare, câte o săptămână, lentile chihlimbar și lentile transparente. Cu cele chihlimbar au dormit mai mult și au spus că somnul a fost mai bun.',
    cite: 'Shechter și colegii, 2018, Journal of Psychiatric Research',
    url: doi('10.1016/j.jpsychires.2017.10.015'),
    visual: 'clock',
  },
  {
    tag: 'Ecrane',
    title: 'Adolescenții, seara, la calculator',
    text: '13 băieți între 15 și 17 ani au stat seara la ecrane LED, o săptămână cu ochelari care opresc albastrul și o săptămână cu lentile transparente. Cu ochelarii, melatonina a scăzut mai puțin și s-au simțit mai puțin alerți înainte de culcare. Fazele somnului au rămas la fel.',
    cite: 'van der Lely și colegii, 2015, Journal of Adolescent Health',
    url: doi('10.1016/j.jadohealth.2014.08.002'),
    visual: 'melatonin',
  },
  {
    tag: 'Lumina',
    title: 'Lumină puternică, la ora 1 noaptea',
    text: '14 oameni au stat o oră în lumină puternică, cu ochelari portocalii sau cu ochelari gri. Cu cei gri, melatonina a scăzut cu 46%. Cu cei portocalii, nu a scăzut semnificativ.',
    cite: 'Sasseville și colegii, 2006, Journal of Pineal Research',
    url: doi('10.1111/j.1600-079X.2006.00332.x'),
    visual: 'melatonin',
  },
  {
    tag: 'Lumina',
    title: 'Când oprești și o parte din verde',
    text: '19 tineri au petrecut nopți întregi în lumină puternică, cu și fără ochelari care opreau toată lumina sub 530 nm, adică albastrul și o parte din verde. Cu ochelarii, melatonina a arătat ca în lumină slabă, iar atenția lor a rămas la fel de bună.',
    cite: 'Kayumov și colegii, 2005, Journal of Clinical Endocrinology & Metabolism',
    url: doi('10.1210/jc.2004-2062'),
    visual: 'spectrum',
  },
  {
    tag: 'Lumina',
    title: 'Lumina obișnuită din cameră',
    text: 'La Harvard, 116 tineri au trăit câteva zile în laborator, seara fie în lumina obișnuită a unei camere, fie în lumină slabă. Lumina camerei a scurtat noaptea corpului cu aproximativ o oră și jumătate.',
    cite: 'Gooley și colegii, 2011, Journal of Clinical Endocrinology & Metabolism',
    url: doi('10.1210/jc.2010-2098'),
    chart: {
      caption: 'Câte ore a produs corpul melatonină (mediana)',
      unit: 'ore',
      bars: [
        { label: 'Lumină slabă', value: 10.3, highlight: true },
        { label: 'Lumina camerei', value: 8.8 },
      ],
    },
  },
  {
    tag: 'Ecrane',
    title: 'Tabletă sau carte, înainte de somn',
    text: '12 adulți au citit câteva seri la rând pe o tabletă, apoi pe o carte tipărită. După tabletă au adormit mai greu, ceasul corpului s-a mutat cu peste o oră și jumătate mai târziu, iar dimineața au fost mai puțin alerți.',
    cite: 'Chang și colegii, 2015, PNAS',
    url: doi('10.1073/pnas.1418490112'),
    chart: {
      caption: 'Cât le-a luat să adoarmă (media)',
      unit: 'minute',
      lowerIsBetter: true,
      bars: [
        { label: 'Carte tipărită', value: 15.8, highlight: true },
        { label: 'Tabletă', value: 25.7 },
      ],
    },
  },
  {
    tag: 'Ecrane',
    title: 'Cinci ore la un ecran LED',
    text: '13 tineri au stat seara câte 5 ore la două ecrane. Cel cu LED dădea de peste două ori mai multă lumină albastră. La el, melatonina de seară a crescut mai puțin și s-au simțit mai puțin somnoroși.',
    cite: 'Cajochen și colegii, 2011, Journal of Applied Physiology',
    url: doi('10.1152/japplphysiol.00165.2011'),
    visual: 'spectrum',
  },
  {
    tag: 'Somn',
    title: '29 de studii, puse cap la cap',
    text: 'O analiză a 29 de publicații despre ochelarii chihlimbar purtați seara a găsit cele mai multe dovezi pentru adormirea mai rapidă, inclusiv la oameni care lucrează în ture sau care schimbă fusul orar.',
    cite: 'Hester și colegii, 2021, Chronobiology International',
    url: doi('10.1080/07420528.2021.1930029'),
    visual: 'clock',
  },
]

// ── 6. Întrebări ───────────────────────────────────────────────────────────────

/** Questions people ask before buying. Commercial terms come from src/config/site.ts. */
export const amberFaq: { q: string; a: string }[] = [
  {
    q: 'Care e diferența dintre lentila galbenă și cea roșie?',
    a: 'Lentila galbenă oprește cea mai mare parte din lumina albastră și o porți de la apus. Lentila roșie oprește și albastrul, și o bună parte din verde, așa că o porți în ultima oră înainte de somn. Rama e aceeași.',
  },
  {
    q: 'Pot să le folosesc pe amândouă?',
    a: 'Da, una după alta. Porți galbenul de la apus, iar când ajungi în pat treci la roșu. Pachetul le are pe amândouă, pentru toată seara.',
  },
  {
    q: 'De ce nu îmi ajunge modul de noapte de pe telefon?',
    a: 'Modul de noapte schimbă doar ecranul acela. Becurile din casă, televizorul și laptopul rămân la fel. Ochelarii filtrează toată lumina care ajunge la ochii tăi, oricare ar fi sursa.',
  },
  {
    q: 'Pot conduce cu ei seara?',
    a: 'Nu. Nu le folosi la volan noaptea, nici pe cei cu lentilă galbenă, nici pe cei cu lentilă roșie. Lentilele colorate schimbă culorile și lasă mai puțină lumină să treacă, iar la volan ai nevoie de toată vederea. Îi porți acasă.',
  },
  {
    q: 'Ce văd prin lentila roșie?',
    a: 'Totul în nuanțe de portocaliu și roșu, ca la lumina unei lumânări. Albastrul și verdele par închise. Poți citi și folosi telefonul fără grijă, dar nu e lentila potrivită pentru lucru în care contează culorile.',
  },
  {
    q: 'Se pot face cu dioptrie sau cu lentile progresive?',
    a: 'Din păcate, nu. NEUROS Amber vine doar cu lentilele lui, fără dioptrie, așa că nu le putem face după rețetă și nici cu lentile progresive. Dacă ai întrebări despre cum ți s-ar potrivi, scrie-ne și te ajutăm cu drag.',
  },
  {
    q: 'Îi pot purta peste ochelarii de vedere?',
    a: 'Ramele au o mărime obișnuită și nu sunt făcute să încapă peste alți ochelari. Dacă porți ochelari de vedere, scrie-ne înainte de comandă și ne uităm împreună ce ți s-ar potrivi.',
  },
  {
    q: 'Ce rame pot alege?',
    a: 'Cat eye, în negru sau bej. Unisex pătrat, în negru sau maro. Și o ramă subțire de metal, în negru. Fiecare ramă vine cu lentilă galbenă sau roșie, iar o pereche costă 315 lei.',
  },
  {
    q: 'Cum îi curăț?',
    a: 'Clătește lentilele cu apă călduță, apoi șterge-le cu o lavetă din microfibră. Evită șervețelele de hârtie și hainele, pentru că pot zgâria lentila.',
  },
  {
    q: 'Îi pot purta și copiii?',
    a: 'Ramele sunt gândite pentru adulți. Un adolescent îi poate purta seara, la ecran, dacă rama i se potrivește. Pentru un copil mai mic, scrie-ne înainte și te ajutăm să vezi dacă rama i se potrivește.',
  },
  {
    q: 'Cum plătesc și cât durează livrarea?',
    a: `Plătești cu cardul, prin transfer bancar sau ramburs, la livrare. Livrarea în România e gratuită. Pregătim coletul în ${terms.processingDays}, iar curierul îl aduce în ${terms.transitDays}. Ochelarii au garanție ${terms.warrantyYears} ani.`,
  },
  {
    q: 'Pot să îi returnez?',
    a: `Da, în ${terms.returnDays} zile de la primire.`,
  },
]
