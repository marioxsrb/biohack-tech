/**
 * NEUROS Focus product page (Romanian): the story sections above the reviews (when attention drifts,
 * the same day with the headset, how it's used, when it's used) and "Știai că?" under them.
 * Approved copy. The facts were checked against the sources linked here (October 2026).
 */
import type { StaticImageData } from 'next/image'

import type { Chart } from '@/content/calm-science'

import adolescent from '@/assets/img/brainlink/adolescent-examen.webp'
import copilTableta from '@/assets/img/brainlink/copil-tableta.webp'
import copilTeme from '@/assets/img/brainlink/copil-teme.webp'
import familie from '@/assets/img/brainlink/familie-seara.webp'
import meditatie from '@/assets/img/brainlink/audience-meditatie.webp'
import birou from '@/assets/img/brainlink/result-focus.webp'
import energie from '@/assets/img/brainlink/result-energy.webp'
import tableta from '@/assets/img/brainlink/pillar-games.webp'

export type Audience = 'copil' | 'tu'
export const AUDIENCES: { id: Audience; label: string }[] = [
  { id: 'copil', label: 'Pentru copilul tău' },
  { id: 'tu', label: 'Pentru tine' },
]

// ── 2. Când atenția fuge ───────────────────────────────────────────────────────

export const drift = {
  title: 'Când atenția fuge',
  intro: 'Mintea știe ce are de făcut, iar atenția pleacă în altă parte.',
  cards: {
    copil: [
      { title: 'Tema de 20 de minute durează două ore', text: 'E ora 19 și caietul de matematică e deschis la aceeași pagină. Copilul se ridică după apă, apoi după o gumă, apoi rămâne la fereastră.' },
      { title: 'Știe lecția și se pierde la test', text: 'Acasă îți spune lecția pe de rost. La test, după primele două exerciții, privirea lui e deja pe geam.' },
      { title: 'Tableta câștigă mereu', text: 'Îi iei tableta ca să se apuce de teme. Peste un sfert de oră îl găsești iar cu ea în brațe.' },
      { title: 'Seara se termină cu cearta', text: 'Repeți „hai, concentrează-te” de zece ori pe seară. Amândoi ajungeți obosiți la culcare.' },
    ],
    tu: [
      { title: 'Te apuci de lucru și ajungi pe telefon', text: 'Deschizi taskul la 9:00. La 9:04 ești pe Instagram și abia îți amintești când ai luat telefonul.' },
      { title: 'Ziua se umple de întreruperi', text: 'Un mesaj pe Slack, apoi un email, apoi o notificare. Taskul important se mută din dimineață în seară.' },
      { title: 'Ai muncit mult și ai terminat puțin', text: 'La 18:00 închizi laptopul cu 30 de taburi deschise. Lista de dimineață arată aproape la fel.' },
      { title: 'Meditația pare o corvoadă', text: 'Ai descărcat o aplicație de meditație de trei ori. După câteva minute, mintea era deja la ședința de mâine.' },
    ],
  } satisfies Record<Audience, { title: string; text: string }[]>,
  footnote: 'În weekend, adolescenții din România stau în medie 6,7 ore pe zi în fața ecranelor, mai mult decât media din Uniunea Europeană.',
  footnoteSource: {
    label: 'Eurobarometru, 2026',
    url: 'https://cursdeguvernare.ro/eurobarometru-adolescentii-din-romania-petrec-aproape-sapte-ore-pe-zi-in-fata-ecranelor-in-weekend-peste-media-ue.html',
  },
}

// ── 3. Aceeași zi, cu NEUROS Focus ─────────────────────────────────────────────

export type Moment = { when: string; text: string; image?: StaticImageData; alt?: string; drawing?: 'dinner' | 'chart' | 'school' | 'evening' }

export const sameDay = {
  title: 'Aceeași zi, cu NEUROS Focus',
  intro: 'Ziua are aceleași teme și aceleași taskuri. Se schimbă cât timp rămâne atenția pe ele.',
  moments: {
    copil: [
      { when: 'După școală', text: 'Copilul pune casca și alege jocul preferat. Mingea de pe ecran urcă doar când el e atent, așa că se adună singur.', image: copilTableta, alt: 'Copil pe canapea, cu NEUROS Focus pe frunte, jucând un joc pe tabletă' },
      { when: 'La teme', text: 'Se așază la masă cu mintea deja adunată. Lucrează mai mult timp dintr-o bucată, iar tu stai liniștită în bucătărie.', image: copilTeme, alt: 'Copil la birou, făcând teme, cu NEUROS Focus pe frunte' },
      { when: 'Înainte de cină', text: 'Tema e gata, iar seara rămâne pentru joacă și povești.', drawing: 'dinner' },
      { when: 'După câteva săptămâni', text: 'În aplicație vedeți împreună cum crește scorul de la o săptămână la alta. Copilul îți cere el casca.', drawing: 'chart' },
      { when: 'La ședința cu părinții', text: 'Auzi că lucrează mai liniștit la ore și că termină exercițiile la timp.', drawing: 'school' },
    ],
    tu: [
      { when: 'Dimineața', text: 'Înainte să deschizi laptopul, pui casca pentru un joc scurt. Telefonul stă cu ecranul în jos.', image: tableta, alt: 'Bărbat pe canapea, cu NEUROS Focus, jucând un joc de concentrare pe tabletă' },
      { when: 'La primul task', text: 'Deschizi întâi taskul greu. Intri în el mai repede și rămâi în el mai mult timp.', image: birou, alt: 'Bărbat la birou, concentrat, purtând NEUROS Focus' },
      { when: 'După prânz', text: 'Când energia scade, faci o meditație scurtă cu casca și vezi pe ecran cum te liniștești.', image: meditatie, alt: 'Femeie care meditează pe canapea, purtând NEUROS Focus' },
      { when: 'La 18:00', text: 'Închizi laptopul cu lista bifată și cu energie pentru seară.', drawing: 'evening' },
      { when: 'După câteva săptămâni', text: 'În istoric vezi cum crește timpul în care rămâi concentrat. Telefonul îl iei când vrei tu.', drawing: 'chart' },
    ],
  } satisfies Record<Audience, Moment[]>,
  footnote: 'Fiecare om răspunde în ritmul lui, așa că îți recomandăm câteva minute pe zi, câteva săptămâni la rând.',
}

// ── 4. Cum o folosești ─────────────────────────────────────────────────────────

export const howTo = {
  title: 'Cum o folosești',
  steps: [
    { lead: 'Pui casca pe cap și o pornești.', text: 'Senzorii de pe frunte citesc semnalele foarte slabe ale creierului.' },
    { lead: 'O legi de tabletă, prin Bluetooth,', text: 'din aplicația Neuros Game.' },
    { lead: 'Alegi un joc sau o meditație.', text: 'Când ești atent, jocul merge înainte.' },
  ],
  note: 'O încarci o oră și o folosești până la 4 ore. O ții în geanta ei, lângă tabletă, ca să fie gata oricând.',
}

// ── 5. Când o folosești ────────────────────────────────────────────────────────

export const whenToUse = {
  title: 'Când o folosești',
  intro: 'O sesiune scurtă înainte de orice ai de făcut cu mintea limpede.',
  cards: [
    { title: 'Înainte de teme', text: 'Un joc scurt după școală, apoi caietul. Copilul se așază la masă cu mintea adunată.', image: copilTeme, alt: 'Copil la teme, cu NEUROS Focus' },
    { title: 'Când cere tableta', text: 'Timpul pe tabletă devine antrenament. Copilul se joacă, iar jocul îi cere să fie atent.', image: copilTableta, alt: 'Copil cu tableta și NEUROS Focus' },
    { title: 'În săptămânile dinaintea examenelor', text: 'Înainte de teză, de Evaluarea Națională sau de Bacalaureat, o sesiune pe zi îl ajută să stea mai mult timp pe un exercițiu.', image: adolescent, alt: 'Adolescent care învață pentru examen, cu NEUROS Focus' },
    { title: 'Înainte de taskul greu', text: 'Dimineața, înainte să deschizi emailul. Intri în lucru mai repede și ții telefonul departe.', image: birou, alt: 'Bărbat la birou, cu NEUROS Focus' },
    { title: 'În sesiune', text: 'Între două capitole de învățat, un joc scurt îți adună atenția pentru următorul.', image: tableta, alt: 'Tânăr cu tableta și NEUROS Focus' },
    { title: 'După prânz, când energia scade', text: 'O sesiune scurtă la birou și te întorci la lucru cu mintea mai limpede.', image: energie, alt: 'Bărbat la laptop, cu NEUROS Focus' },
    { title: 'Seara, pentru liniște', text: 'Meditațiile ghidate îți arată pe loc cât de relaxat ești. Vezi pe ecran momentul în care mintea se așază.', image: meditatie, alt: 'Femeie care meditează cu NEUROS Focus' },
  ],
  family: {
    title: 'În familie',
    text: 'Fiecare își face sesiunea lui și își vede scorul. Copiii vor să își bată recordul, iar părinții la fel.',
    image: familie,
    alt: 'Părinte și copil pe canapea, fiecare cu NEUROS Focus și o tabletă',
  },
}

// ── 7. Știai că? ───────────────────────────────────────────────────────────────

export type FocusFact = { big: string; small?: string; title: string; text: string; source: { label: string; url: string } }

export const focusFacts: FocusFact[] = [
  {
    big: 'Londra',
    small: 'taximetriștii',
    title: 'Creierul se schimbă cu exercițiul',
    text: 'Taximetriștii din Londra învață pe de rost mii de străzi. Partea creierului care ține minte drumurile e la ei mai mare, cu atât mai mare cu cât au mai mulți ani de meserie.',
    source: { label: 'Maguire și colegii, 2000, PNAS', url: 'https://doi.org/10.1073/pnas.070039597' },
  },
  {
    big: '47 s',
    small: 'față de 2,5 minute în 2004',
    title: 'Atenția pe un ecran a scăzut la 47 de secunde',
    text: 'În 2004, oamenii stăteau în medie două minute și jumătate pe un ecran înainte să treacă la altul. Din 2016, cercetătoarea Gloria Mark măsoară în jur de 47 de secunde.',
    source: { label: 'Gloria Mark, Attention Span, 2023', url: 'https://www.steelcase.com/research/articles/our-47-second-attention-span-with-gloria-mark-s5-ep3-transcript/' },
  },
  {
    big: '47%',
    small: 'din timpul în care suntem treji',
    title: 'Mintea hoinărește aproape jumătate din zi',
    text: 'Un studiu Harvard pe 2.250 de oameni a arătat că mintea noastră e în altă parte în 47% din timpul în care suntem trezi.',
    source: { label: 'Killingsworth și Gilbert, 2010, Science', url: 'https://doi.org/10.1126/science.1192439' },
  },
  {
    big: '23 min',
    small: 'ca să revii',
    title: 'Revenirea după o întrerupere durează',
    text: 'După o întrerupere, ne trebuie în medie 23 de minute ca să ne întoarcem la ce făceam, spune Gloria Mark.',
    source: { label: 'Gloria Mark, interviu Fast Company, 2008', url: 'https://www.fastcompany.com/944128/worker-interrupted-cost-task-switching' },
  },
  {
    big: '40%',
    small: 'din timpul productiv',
    title: 'Multitaskingul mănâncă timp',
    text: 'Când sari de la o sarcină la alta, pierzi până la 40% din timpul productiv, spune psihologul David Meyer.',
    source: { label: 'American Psychological Association', url: 'https://www.apa.org/topics/research/multitasking' },
  },
  {
    big: '51',
    small: 'de ridicări ale telefonului pe zi',
    title: 'Adolescenții își iau telefonul de 51 de ori pe zi',
    text: 'Un studiu american pe tineri între 11 și 17 ani a numărat 51 de ridicări ale telefonului pe zi și în jur de 237 de notificări.',
    source: { label: 'Common Sense Media, 2023', url: 'https://www.commonsensemedia.org/sites/default/files/research/report/2023-cs-smartphone-research-report_final-for-web.pdf' },
  },
  {
    big: '1924',
    small: 'Jena',
    title: 'Primul EEG are peste 100 de ani',
    text: 'Pe 6 iulie 1924, la Jena, medicul german Hans Berger a înregistrat pentru prima dată semnalele electrice ale unui creier uman.',
    source: { label: 'Haas, 2003, Journal of Neurology, Neurosurgery & Psychiatry', url: 'https://doi.org/10.1136/jnnp.74.1.9' },
  },
  {
    big: '10–100 µV',
    small: 'la suprafața capului',
    title: 'Semnalele creierului sunt foarte slabe',
    text: 'La suprafața capului, semnalele creierului au între 10 și 100 de milionimi de volt. O baterie AA are 1,5 volți, de zeci de mii de ori mai mult.',
    source: { label: 'Electroencefalografie, Wikipedia', url: 'https://en.wikipedia.org/wiki/Electroencephalography' },
  },
  {
    big: '25 de ani',
    small: 'zona din spatele frunții',
    title: 'Zona din spatele frunții se maturizează ultima',
    text: 'Partea creierului din spatele frunții te ajută să fii atent și să îți planifici ziua. Ea se maturizează abia după 25 de ani, iar chiar acolo stau senzorii NEUROS Focus.',
    source: { label: 'Arain și colegii, 2013, Neuropsychiatric Disease and Treatment', url: 'https://doi.org/10.2147/NDT.S39776' },
  },
  {
    big: 'Anii ’60',
    small: 'Barry Sterman',
    title: 'Neurofeedbackul a pornit de la pisici',
    text: 'În anii ’60, cercetătorul Barry Sterman a învățat pisici să își crească un anumit ritm al creierului. La un test pentru Forțele Aeriene americane, pisicile antrenate au rezistat de două ori mai mult la crizele provocate de un combustibil de rachetă.',
    source: { label: 'Sterman, 2000, Clinical Electroencephalography', url: 'https://doi.org/10.1177/155005940003100111' },
  },
  {
    big: '2006',
    small: 'Mind Room, AC Milan',
    title: 'Campionii mondiali din 2006 și-au antrenat mintea',
    text: 'Înainte de Cupa Mondială din 2006, Pirlo, Nesta, Gattuso și Gilardino s-au antrenat luni de zile în „Mind Room”-ul de la AC Milan, cu aparate care le măsurau undele cerebrale. Italia a câștigat titlul în acel an.',
    source: { label: 'Wilson, Peper și Moss, 2006, „The Mind Room” in Italian soccer training', url: 'https://www.researchgate.net/publication/259558691_The_Mind_Room_in_Italian_soccer_training_The_use_of_biofeedback_and_neurofeedback_for_optimum_performance' },
  },
]

// ── 8. Ce spune știința, pe înțelesul tuturor ──────────────────────────────────
// Checked against the papers (abstracts; Lim 2023 Table 2; Lim 2019 full text). Two wordings were
// corrected to match the papers: Bhayee 2016 (13 adults meditated, 13 did math; healthy, not stressed)
// and Lumsden 2016 (the review says gamified training boosts motivation, not "in every study").


export const focusScience = {
  title: 'Ce spune știința, pe înțelesul tuturor',
  intro: 'NEUROS Focus pleacă de la o idee studiată de zeci de ani: când îți vezi atenția pe loc, înveți să o aduci înapoi mai ușor.',
  howTitle: 'Cum lucrează NEUROS Focus',
  how: [
    { key: 'signals', label: 'Semnalele creierului', text: 'Creierul tău produce semnale electrice foarte slabe. Medicii le măsoară de aproape 100 de ani, prin EEG.' },
    { key: 'headset', label: 'Casca', text: 'Senzorii de pe frunte citesc aceste semnale și recunosc stări precum concentrarea și relaxarea. Gândurile rămân ale tale.' },
    { key: 'game', label: 'Jocul', text: 'Aplicația Neuros Game transformă semnalul într-un joc. Când ești atent, jocul merge înainte, iar când mintea pleacă, jocul încetinește.' },
    { key: 'training', label: 'Antrenamentul', text: 'Așa vezi pe loc momentul în care atenția fuge și înveți să o aduci înapoi. Metoda se numește neurofeedback, adică feedback de la propriul creier.' },
    { key: 'meditation', label: 'Meditațiile', text: 'În meditațiile ghidate, casca îți arată cât de relaxat ești, așa că mintea se așază mai ușor.' },
  ] as const,
  studiesTitle: 'Studiile, explicate simplu',
  footnote: 'Studiile privesc metoda de antrenament (neurofeedbackul și biofeedbackul), nu casca NEUROS Focus în sine. NEUROS Focus este un produs de wellness și nu înlocuiește un tratament medical.',
}

export type FocusStudy = {
  tag: 'Copii' | 'Adulți' | 'Metoda'
  title: string
  text: string
  cite: string
  url: string
  chart?: Chart
  visual?: 'game' | 'motivation' | 'adult' | 'realtime' | 'meditation' | 'signals' | 'heart'
}

const doi = (d: string) => `https://doi.org/${d}`

export const focusStudies: FocusStudy[] = [
  {
    tag: 'Copii',
    title: 'Un joc cu cască, pentru atenția copiilor',
    text: 'În Singapore, 20 de copii cărora le era greu să stea atenți au jucat 8 săptămâni un joc controlat cu atenția, cu o cască asemănătoare. Părinții au văzut o atenție mai bună, iar progresul se vedea și după 24 de săptămâni.',
    cite: 'Lim și colegii, 2012, PLoS ONE',
    url: doi('10.1371/journal.pone.0046692'),
    visual: 'game',
  },
  {
    tag: 'Copii',
    title: 'Studiul mare, cu 172 de copii',
    text: 'Copiii au fost împărțiți în două grupuri. Cei care s-au antrenat de 3 ori pe săptămână, timp de 8 săptămâni, au progresat mai mult decât cei care au așteptat, iar progresul a ținut și o lună după final.',
    cite: 'Lim și colegii, 2019, PLoS ONE',
    url: doi('10.1371/journal.pone.0216225'),
    chart: {
      caption: 'Cu cât a scăzut scorul de neatenție în 8 săptămâni (ADHD-RS)',
      unit: 'puncte',
      bars: [
        { label: 'Cu antrenament', value: 3.5, highlight: true },
        { label: 'Au așteptat', value: 1.9 },
      ],
    },
  },
  {
    tag: 'Copii',
    title: 'Acasă, pe tabletă',
    text: 'În 2023, același antrenament s-a mutat pe tabletă, acasă. 19 din 20 de copii au făcut aproape toate sesiunile, iar rezultatele de acasă au semănat cu cele de la clinică.',
    cite: 'Lim și colegii, 2023, Child and Adolescent Psychiatry and Mental Health',
    url: doi('10.1186/s13034-022-00539-x'),
    chart: {
      caption: 'Cu cât a scăzut scorul de neatenție în 8 săptămâni',
      unit: 'puncte',
      bars: [
        { label: 'Acasă', value: 3.2, highlight: true },
        { label: 'La clinică', value: 3.9 },
      ],
    },
  },
  {
    tag: 'Copii',
    title: 'Progresul rămâne și după antrenament',
    text: 'O analiză a 10 studii a urmărit copiii luni de zile după ultima sesiune de neurofeedback. Atenția lor a continuat să crească între 2 și 12 luni după final.',
    cite: 'Van Doren și colegii, 2019, European Child and Adolescent Psychiatry',
    url: doi('10.1007/s00787-018-1121-4'),
    chart: {
      caption: 'Cât de mare e efectul asupra atenției (mărimea efectului)',
      bars: [
        { label: 'La finalul antrenamentului', value: 0.64 },
        { label: 'După 2–12 luni', value: 0.8, highlight: true },
      ],
    },
  },
  {
    tag: 'Metoda',
    title: 'Jocurile țin copiii motivați',
    text: 'O analiză a 33 de studii a găsit că antrenamentul sub formă de joc îi ține pe oameni implicați și le crește motivația.',
    cite: 'Lumsden și colegii, 2016, JMIR Serious Games',
    url: doi('10.2196/games.5888'),
    visual: 'motivation',
  },
  {
    tag: 'Adulți',
    title: 'Și adulții își antrenează atenția',
    text: '25 de adulți sănătoși au făcut câteva săptămâni de antrenament al undelor cerebrale. La final, atenția lor a fost mai stabilă la un test pe calculator, iar grupul de control a rămas la același nivel.',
    cite: 'Egner și Gruzelier, 2004, Clinical Neurophysiology',
    url: doi('10.1016/s1388-2457(03)00353-5'),
    visual: 'adult',
  },
  {
    tag: 'Adulți',
    title: 'Când îți vezi atenția pe loc',
    text: 'La Princeton, oamenii au văzut pe ecran, în timp ce lucrau, momentul în care atenția începea să fugă. După o singură sesiune, atenția lor a devenit mai stabilă, cu mai puține scăpări.',
    cite: 'deBettencourt și colegii, 2015, Nature Neuroscience',
    url: doi('10.1038/nn.3940'),
    visual: 'realtime',
  },
  {
    tag: 'Adulți',
    title: 'Meditație cu o cască, 6 săptămâni',
    text: '13 adulți au meditat zilnic cu o cască ce le dădea feedback prin sunet, iar alți 13 au făcut exerciții de matematică. După 6 săptămâni, cei care au meditat au fost mai rapizi la un test de atenție și s-au simțit mai calmi.',
    cite: 'Bhayee și colegii, 2016, BMC Psychology',
    url: doi('10.1186/s40359-016-0168-6'),
    visual: 'meditation',
  },
  {
    tag: 'Metoda',
    title: 'Cât de bine citește o cască de acasă',
    text: 'Cercetătorii au pus pe aceleași 21 de persoane o cască de acasă și un aparat medical, în același timp. Semnalele s-au potrivit bine, și pe o sesiune lungă.',
    cite: 'Rieiro și colegii, 2019, Sensors',
    url: doi('10.3390/s19122808'),
    visual: 'signals',
  },
  {
    tag: 'Metoda',
    title: 'Biofeedbackul și stresul',
    text: 'O analiză a 24 de studii a arătat că oamenii care își văd pe loc semnalele corpului învață să își reducă stresul. Studiile au folosit ritmul inimii.',
    cite: 'Goessl, Curtiss și Hofmann, 2017, Psychological Medicine',
    url: doi('10.1017/S0033291717001003'),
    visual: 'heart',
  },
]
