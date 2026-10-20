/**
 * NEUROS Calm product page (Romanian): "Știai că?" facts and "Ce spune știința, pe înțelesul tuturor".
 * Approved copy. Every number below was checked against the source it links to (October 2026):
 * the abstract, or the paper's table where the abstract has no figures (Hoedlmoser 2008, Table 1).
 * The studies look at the methods (vagus nerve stimulation, red/near-infrared light, the SMR rhythm),
 * not at NEUROS Calm itself; the section says so.
 */

export type Source = { id: string; label: string; url: string }

const doi = (d: string) => `https://doi.org/${d}`

// ── Știai că? ──────────────────────────────────────────────────────────────────

export const factSources: Source[] = [
  { id: 'breit', label: 'Breit și colegii, 2018, Frontiers in Psychiatry', url: doi('10.3389/fpsyt.2018.00044') },
  { id: 'gordan', label: 'Gordan, Gwathmey și Xie, 2015, World Journal of Cardiology', url: doi('10.4330/wjc.v7.i4.204') },
  { id: 'yasuma', label: 'Yasuma și Hayano, 2004, Chest', url: doi('10.1378/chest.125.2.683') },
  { id: 'trinder', label: 'Trinder și colegii, 2001, Journal of Sleep Research', url: doi('10.1046/j.1365-2869.2001.00263.x') },
  { id: 'nobel', label: 'NobelPrize.org, Otto Loewi, biografie', url: 'https://www.nobelprize.org/prizes/medicine/1936/loewi/biographical/' },
  { id: 'borges', label: 'Borges și García, 2021, Pflügers Archiv', url: doi('10.1007/s00424-021-02580-9') },
  { id: 'hamblin', label: 'Hamblin, 2016, Journal of Biophotonics', url: doi('10.1002/jbio.201670113') },
  { id: 'whelan', label: 'Whelan și colegii, 2001, Journal of Clinical Laser Medicine & Surgery', url: doi('10.1089/104454701753342758') },
  { id: 'sliney', label: 'Sliney și colegii, 1976, Journal of the Optical Society of America', url: doi('10.1364/JOSA.66.000339') },
]

export type FactVisual = 'vagus' | 'percent' | 'heart' | 'breath' | 'night' | 'nobel' | 'budapest' | 'nasa' | 'spectrum'

export const facts: { visual: FactVisual; title: string; text: string; sources: string[] }[] = [
  {
    visual: 'vagus',
    title: 'Numele lui înseamnă „rătăcitor”',
    text: '„Vagus” vine din latină și înseamnă „rătăcitor”. Nervul vag pornește din creier, coboară prin gât și ajunge la inimă, la plămâni și la stomac.',
    sources: ['breit'],
  },
  {
    visual: 'percent',
    title: 'Corpul vorbește mai mult decât ascultă',
    text: 'Între 80% și 90% din firele nervului vag duc mesaje de la corp spre creier. Creierul află de la inimă și de la stomac cum te simți.',
    sources: ['breit'],
  },
  {
    visual: 'heart',
    title: 'Inima ta are o frână',
    text: 'Lăsată singură, inima ar bate cam de 100 de ori pe minut. Când stai liniștit, nervul vag o încetinește la 60 sau 80 de bătăi.',
    sources: ['gordan'],
  },
  {
    visual: 'breath',
    title: 'Expirația încetinește inima',
    text: 'Inima bate puțin mai repede când inspiri și puțin mai rar când expiri. Încearcă acum trei expirații lungi.',
    sources: ['yasuma'],
  },
  {
    visual: 'night',
    title: 'Noaptea, nervul vag lucrează din plin',
    text: 'În somnul profund, activitatea nervului vag ajunge la cel mai înalt nivel din toată noaptea. Inima bate mai rar, iar tensiunea scade.',
    sources: ['trinder'],
  },
  {
    visual: 'nobel',
    title: 'Un vis a dus la Premiul Nobel',
    text: 'În 1921, Otto Loewi a visat un experiment cu două inimi de broască. Așa a descoperit substanța prin care nervul vag încetinește inima, iar în 1936 a primit Premiul Nobel.',
    sources: ['borges', 'nobel'],
  },
  {
    visual: 'budapest',
    title: 'Terapia cu lumină s-a născut la Budapesta',
    text: 'În 1967, medicul maghiar Endre Mester a îndreptat un laser roșu slab spre niște șoareci rași. Blana lor a crescut la loc mai repede, iar așa a început fotobiomodularea.',
    sources: ['hamblin'],
  },
  {
    visual: 'nasa',
    title: 'LED-urile NASA au ajuns în medicină',
    text: 'NASA a creat LED-uri roșii ca să crească plante în spațiu. Cercetătorii au văzut apoi că aceeași lumină ajută celulele umane să se înmulțească mai repede.',
    sources: ['whelan'],
  },
  {
    visual: 'spectrum',
    title: 'O parte din lumină abia se vede',
    text: 'Lumina roșie pe care o vezi pe NEUROS Calm are 660 nm. Lumina de 810 nm stă la marginea vederii, așa că ochiul o prinde cel mult ca pe o licărire roșie.',
    sources: ['sliney'],
  },
]

// ── Ce spune știința, pe înțelesul tuturor ──────────────────────────────────────

export const science = {
  title: 'Ce spune știința, pe înțelesul tuturor',
  intro: 'NEUROS Calm pornește de la două lucruri studiate de zeci de ani: nervul vag și lumina roșie. Studiile de mai jos privesc aceste metode.',
  howTitle: 'Cum lucrează NEUROS Calm',
  how: [
    { key: 'nerve', label: 'Nervul vag', text: 'Pe gât trece nervul vag, un nerv lung care leagă creierul de inimă, plămâni și stomac. El ajută corpul să treacă din alertă în repaus.' },
    { key: 'ir', label: 'Lumina infraroșie', text: 'Pe partea stângă, 6 diode de 810 nm luminează zona pe unde trece nervul vag. Lumina infraroșie ajunge mai adânc în țesut decât cea roșie.' },
    { key: 'red', label: 'Lumina roșie', text: 'Pe restul gâtului, lumina roșie de 660 nm lucrează aproape de suprafața pielii.' },
    { key: 'rhythm', label: 'Ritmul', text: 'Lumina pulsează de 14 ori pe secundă, același ritm cu undele SMR. Creierul face aceste unde când e calm și când se pregătește de somn.' },
    { key: 'method', label: 'Numele metodei', text: 'Se numește fotobiomodulare: lumină de anumite culori, folosită ca să sprijine celulele.' },
  ] as const,
  studiesTitle: 'Studiile, explicate simplu',
}

export type Chart = {
  caption: string
  /** true when a lower value is the better outcome (the chart says so). */
  lowerIsBetter?: boolean
  unit?: string
  bars: { label: string; value: number; highlight?: boolean }[]
}

export type Study = {
  tag: 'Nervul vag' | 'Lumina' | 'Ritmul'
  title: string
  text: string
  cite: string
  url: string
  chart?: Chart
  /** A drawing instead of data, for studies whose point isn't a number (marked as a diagram). */
  visual?: 'hrv' | 'mito' | 'moon' | 'collar' | 'depth'
  /** A study that hasn't started yet. */
  upcoming?: boolean
}

export const studies: Study[] = [
  {
    tag: 'Nervul vag',
    title: 'Un nerv vag activ merge mână în mână cu liniștea',
    text: 'Oamenii cu un nerv vag mai activ își gestionează mai ușor emoțiile și stresul. Cercetătorii măsoară asta prin HRV, cifra pe care o vezi și în ceasul tău.',
    cite: 'Laborde, Mosley și Thayer, 2017, Frontiers in Psychology',
    url: doi('10.3389/fpsyg.2017.00213'),
    visual: 'hrv',
  },
  {
    tag: 'Nervul vag',
    title: 'Stimularea blândă a nervului vag și somnul',
    text: '72 de adulți care dormeau prost de mult timp au primit stimulare blândă la ureche, 8 săptămâni. Somnul lor s-a îmbunătățit de două ori mai mult decât la grupul cu stimulare falsă, iar efectul a ținut până în săptămâna 20. Studiul a folosit un curent slab.',
    cite: 'Zhang și colegii, 2024, JAMA Network Open',
    url: doi('10.1001/jamanetworkopen.2024.51217'),
    chart: {
      caption: 'Cu cât s-a îmbunătățit scorul de somn (PSQI) în 8 săptămâni',
      unit: 'puncte',
      bars: [
        { label: 'Stimulare reală', value: 8.2, highlight: true },
        { label: 'Stimulare falsă', value: 3.9 },
      ],
    },
  },
  {
    tag: 'Lumina',
    title: 'Lumina dă un impuls celulelor',
    text: 'Lumina roșie și infraroșie e absorbită de mitocondrii, micile fabrici de energie din celule. În studiile de laborator, celulele fac mai multă energie după expunere.',
    cite: 'de Freitas și Hamblin, 2016, IEEE Journal of Selected Topics in Quantum Electronics',
    url: doi('10.1109/JSTQE.2016.2561201'),
    visual: 'mito',
  },
  {
    tag: 'Lumina',
    title: 'Lumina roșie seara și somnul',
    text: '20 de sportive au stat 30 de minute sub lumină roșie în fiecare seară, timp de două săptămâni. Au dormit mai bine și au avut mai multă melatonină decât grupul cu lumina stinsă.',
    cite: 'Zhao și colegii, 2012, Journal of Athletic Training',
    url: doi('10.4085/1062-6050-47.6.08'),
    visual: 'moon',
  },
  {
    tag: 'Lumina',
    title: 'Lumina infraroșie și starea de calm',
    text: '15 adulți foarte agitați au purtat o bandă cu lumină infraroșie pe frunte, 20 de minute pe zi, timp de 8 săptămâni. Scorul lor de neliniște a scăzut la jumătate, iar somnul s-a îmbunătățit. Studiul a fost unul pilot.',
    cite: 'Maiello și colegii, 2019, Photobiomodulation, Photomedicine, and Laser Surgery',
    url: doi('10.1089/photob.2019.4677'),
    chart: {
      caption: 'Scorul de neliniște (scala Hamilton)',
      lowerIsBetter: true,
      bars: [
        { label: 'La început', value: 17.3 },
        { label: 'După 8 săptămâni', value: 8.5, highlight: true },
      ],
    },
  },
  {
    tag: 'Lumina',
    title: 'Un colier cu lumină la gât, înainte de somn',
    text: '30 de adulți între 30 și 60 de ani au purtat seara un colier cu lumină roșie și infraroșie, trei săptămâni. Cei cu lumina aprinsă au spus că se simt mai relaxați și dorm mai bine decât cei cu un colier fals.',
    cite: 'Kennedy și colegii, 2023, Journal of Clinical Sleep Medicine',
    url: doi('10.5664/jcsm.10648'),
    visual: 'collar',
  },
  {
    tag: 'Lumina',
    title: 'De ce 810 nm',
    text: 'Cercetătorii au măsurat cât de departe trece lumina prin țesut. Lumina infraroșie de 808 nm a ajuns mult mai adânc decât lumina roșie de 660 nm.',
    cite: 'Tedford și colegii, 2015, Lasers in Surgery and Medicine',
    url: doi('10.1002/lsm.22343'),
    visual: 'depth',
  },
  {
    tag: 'Ritmul',
    title: 'De ce 14 Hz',
    text: '27 de tineri au învățat să își întărească undele SMR, între 12 și 15 Hz. După antrenament adormeau în 8 minute, față de aproape 15 înainte. Studiul a folosit neurofeedback, iar de aici vine alegerea ritmului de 14 Hz.',
    cite: 'Hoedlmoser și colegii, 2008, Sleep',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2572745/',
    chart: {
      caption: 'Minute până la adormire, la un pui de somn în laborator',
      lowerIsBetter: true,
      unit: 'min',
      bars: [
        { label: 'Înainte', value: 14.8 },
        { label: 'După antrenament', value: 8.1, highlight: true },
      ],
    },
  },
]
