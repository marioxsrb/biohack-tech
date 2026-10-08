/**
 * Product page content, written for someone who sees the product for the first time:
 * what it is, what it does for you, how you use it. Technology is explained once, lower
 * on the page. Claims stay within the source material, at "poate ajuta" strength.
 * See docs/CONTENT-DECISIONS.md.
 */
import type { Locale } from '@/i18n/locales'
import type { ProductId, ProductImage } from './catalog'

import bwCalm from '@/assets/img/balance-wave/result-calm.webp'
import bwSomn from '@/assets/img/balance-wave/result-somn.webp'
import bwNervVag from '@/assets/img/balance-wave/pillar-nerv-vag.webp'
import bwSpate from '@/assets/img/balance-wave/dispozitiv.webp'

import blFocus from '@/assets/img/brainlink/result-focus.webp'
import blMeditatie from '@/assets/img/brainlink/result-meditation.webp'
import blLateral from '@/assets/img/brainlink/casca-lateral.webp'
import blComponente from '@/assets/img/brainlink/componente.webp'

import glTerasa from '@/assets/img/glasses/lifestyle-terasa.webp'
import glToate from '@/assets/img/glasses/audience-stil.webp'
import glBirou from '@/assets/img/glasses/result-focus.webp'
import glSeara from '@/assets/img/glasses/result-seara.webp'

import bfBarbat from '@/assets/img/brain-flow/lifestyle-barbat.webp'
import bfTelecomanda from '@/assets/img/brain-flow/casca-telecomanda.webp'
import bfInterior from '@/assets/img/brain-flow/casca-interior.webp'
import bfBirou from '@/assets/img/brain-flow/birou-scris.webp'
import bfConsultatie from '@/assets/img/brain-flow/consultatie.webp'

export type Story = { title: string; text: string; image: ProductImage }

export type ProductContent = {
  seo: { title: string; description: string }
  /** Buy area: one or two short sentences under the price. */
  intro: string
  /** Buy area: four short facts about this product, each on its own line with a check, above the price. */
  highlights: string[]
  /** Three short benefits, straight after the first photograph. */
  benefits: { title: string; text: string }[]
  /** The large photograph after the buy area. */
  scene: Story
  /** How it's used: three steps beside a clean product shot. */
  use?: { title: string; image: ProductImage; steps: string[] }
  /** Amber only: the four frames together. */
  lookbook?: { title: string; text: string; image: ProductImage }
  /** The technology, once, in plain words. */
  explain?: {
    title: string
    paragraphs: string[]
    image: ProductImage
    /** Background the image was shot on, so its frame matches it exactly. */
    imageBg?: string
    studies?: { label: string; href: string }[]
  }
  /** Photographs with a line of text each. */
  moments: Story[]
  specs: { label: string; value: string }[]
  faqs: { q: string; a: string }[]
}

const photo = (src: ProductImage['src'], alt: string): ProductImage => ({ src, alt, kind: 'photo' })
const cut = (src: ProductImage['src'], alt: string): ProductImage => ({ src, alt, kind: 'cutout' })

export const productContent: Record<ProductId, ProductContent> = {
  'balance-wave': {
    seo: {
      title: 'NEUROS Calm, dispozitiv cu lumină roșie pentru relaxare',
      description: 'NEUROS Calm se poartă la gât și aplică lumină roșie și infraroșie în zona nervului vag. Câteva minute de relaxare, acasă. Livrare gratuită în România.',
    },
    intro: 'Stresul zilei se adună în corp. NEUROS Calm aplică lumină pe gât. Pe partea stângă, 6 diode de 810 nm luminează zona nervului vag. O ședință durează câteva minute.',
    highlights: [
      '6 diode de 810 nm pe zona nervului vag',
      'Lumină roșie de 660 nm pe restul gâtului',
      'Ședințe de câteva minute, cu oprire automată',
      'Un specialist te ajută să începi',
    ],
    benefits: [
      { title: 'Relaxare în câteva minute', text: 'O ședință durează câteva minute.' },
      { title: 'Se oprește singur', text: 'Îl pornești și te relaxezi.' },
      { title: 'Ghidaj inclus', text: 'Un specialist te ajută să începi.' },
    ],
    scene: {
      title: 'Un moment doar pentru tine.',
      text: 'Îl așezi la gât și îl pornești. Apoi te relaxezi.',
      image: photo(bwCalm, 'Femeie relaxată pe canapea, purtând NEUROS Calm la gât'),
    },
    use: {
      title: 'Cum îl folosești',
      image: cut(bwSpate, 'NEUROS Calm văzut din spate, cu butonul de pornire'),
      steps: ['Îl așezi la gât.', 'Îl pornești dintr-un singur buton.', 'Te relaxezi. Se oprește singur.'],
    },
    explain: {
      title: 'De ce la gât?',
      paragraphs: [
        'Pe acolo trece nervul vag, cel mai lung nerv din corp. Leagă creierul de inimă, plămâni și digestie.',
        'Nervul vag are un rol în trecerea corpului din alertă în repaus.',
        'Este cel mai puternic dispozitiv de acest fel de pe piață. Pe partea stângă a gâtului, 6 diode emit lumină infraroșie de 810 nm, care pătrunde mai adânc, spre nervul vag. Pe restul gâtului, lumină roșie de 660 nm.',
        'Lumina pulsează de 14 ori pe secundă, ritmul undelor cerebrale SMR, asociat cu o stare calmă și echilibrată. Metoda se numește fotobiomodulare.',
      ],
      image: photo(bwNervVag, 'Ilustrație: nervul vag pornește din creier și ajunge la inimă, plămâni și digestie'),
    },
    moments: [
      {
        title: 'Seara, înainte de somn.',
        text: 'O ședință scurtă seara te poate ajuta să treci mai ușor spre somn.',
        image: photo(bwSomn, 'Femeie în pat, seara, purtând NEUROS Calm'),
      },
    ],
    specs: [
      { label: 'Tehnologie', value: 'Fotobiomodulare duală: 660 nm și 810 nm' },
      { label: 'Partea stângă', value: '6 diode de 810 nm, în zona nervului vag' },
      { label: 'Restul gâtului', value: 'Lumină roșie de 660 nm' },
      { label: 'Lumină pulsată', value: '14 Hz (ritmul SMR)' },
      { label: 'Oprire', value: 'Automată' },
      { label: 'Garanție', value: '2 ani' },
    ],
    faqs: [
      { q: 'Pot să lucrez în timp ce îl port?', a: 'Da. Poți citi, medita sau lucra ușor în timpul ședinței.' },
      { q: 'Mă ajută cineva să încep?', a: 'Da. Un specialist Biohack Tech îți recomandă programul potrivit pentru tine.' },
      { q: 'Ce fel de produs este?', a: 'NEUROS Calm este un produs de wellness. Pentru o afecțiune, vorbește întâi cu medicul tău.' },
    ],
  },

  'brainlink-pro': {
    seo: {
      title: 'NEUROS Focus, cască EEG pentru concentrare',
      description: 'NEUROS Focus este o cască EEG ușoară, cu peste 10 jocuri pe tabletă controlate prin atenție. Îți antrenezi concentrarea acasă. Livrare gratuită.',
    },
    intro: 'Atenția se risipește ușor printre notificări. Pui casca și deschizi aplicația Neuros Game pe tabletă. Jocurile răspund la cât de atent ești.',
    highlights: [
      '3 senzori EEG, conectare Bluetooth la tabletă',
      'Peste 10 jocuri și meditații ghidate',
      'Până la 4 ore pe o încărcare',
      'Un specialist îți recomandă programul',
    ],
    benefits: [
      { title: 'Antrenezi concentrarea', text: 'Prin jocuri scurte, pe tabletă.' },
      { title: 'Și calmul', text: 'Meditații ghidate, cu feedback în timp real.' },
      { title: 'Îți vezi progresul', text: 'Fiecare sesiune rămâne salvată.' },
    ],
    scene: {
      title: 'Focus, când ai nevoie de el.',
      text: 'Antrenamentul te poate ajuta să intri mai repede în concentrare. La muncă, la studiu, oriunde.',
      image: photo(blFocus, 'Bărbat la birou, concentrat, purtând NEUROS Focus'),
    },
    use: {
      title: 'Cum o folosești',
      image: cut(blLateral, 'NEUROS Focus văzută din lateral, cu senzorul de ureche'),
      steps: ['Pui casca și o pornești.', 'O conectezi la tabletă, prin Bluetooth.', 'Alegi un joc sau o meditație.'],
    },
    explain: {
      title: 'Cum știe casca?',
      paragraphs: [
        'Creierul produce semnale electrice foarte slabe. Casca le citește prin trei senzori mici (EEG).',
        'Aplicația transformă semnalul în joc. Când ești atent, jocul înaintează. Așa înveți treptat să ajungi mai ușor în starea potrivită.',
        'Casca recunoaște stări, precum concentrarea și relaxarea. Gândurile rămân ale tale.',
        'Metoda vine din cercetarea despre biofeedback. Studiile de mai jos privesc biofeedbackul ca metodă, în general.',
      ],
      image: photo(blComponente, 'NEUROS Focus în interior: carcasa, placa electronică, bateria și difuzorul'),
      imageBg: '#f6f6f6',
      studies: [
        { label: 'Biofeedback și stres, Psychological Medicine (2017)', href: 'https://pubmed.ncbi.nlm.nih.gov/28349743/' },
        { label: 'Biofeedback la distanță, 18 studii (2025)', href: 'https://link.springer.com/article/10.1007/s10484-025-09750-w' },
        { label: 'Neurofeedback și atenție, Imaging Neuroscience (2024)', href: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12224457/' },
        { label: 'Prezentare generală, NIH', href: 'https://www.ncbi.nlm.nih.gov/books/NBK279007/' },
      ],
    },
    moments: [
      {
        title: 'Și pentru momentele de liniște.',
        text: 'Casca îți arată în timp real cât de relaxat ești. Meditația devine mai ușor de urmărit.',
        image: photo(blMeditatie, 'Femeie meditând în grădină, purtând NEUROS Focus'),
      },
    ],
    specs: [
      { label: 'Senzori', value: '3 senzori EEG' },
      { label: 'Aplicație', value: 'Neuros Game: peste 10 jocuri și meditații ghidate' },
      { label: 'Conectare', value: 'Bluetooth, la tabletă' },
      { label: 'Baterie', value: 'Până la 4 ore, după o oră de încărcare' },
      { label: 'Certificări', value: 'CE, FCC' },
      { label: 'Model hardware', value: 'BrainLink Pro' },
      { label: 'Garanție', value: '2 ani' },
    ],
    faqs: [
      { q: 'Am nevoie de tabletă?', a: 'Da. Aplicația Neuros Game rulează pe tabletă, iar casca se conectează prin Bluetooth.' },
      { q: 'Ce citește casca?', a: 'Stări precum concentrarea și relaxarea. Gândurile rămân ale tale.' },
      { q: 'Mă ajută cineva să încep?', a: 'Da. Un specialist îți recomandă jocurile și programul potrivite pentru ce vrei să obții.' },
    ],
  },

  'ochelari-biohack': {
    seo: {
      title: 'NEUROS Amber, ochelari pentru lumina albastră',
      description: 'Ochelari NEUROS Amber cu lentile chihlimbar, care filtrează lumina albastră a ecranelor. Cat eye sau unisex pătrat, în trei culori. Livrare gratuită.',
    },
    intro: 'Ochii tăi petrec ore întregi în lumina ecranelor. Lentilele chihlimbar filtrează lumina albastră de la monitor, telefon și becuri LED. Rama este ușoară, pentru toată ziua.',
    highlights: [
      'Lentile chihlimbar care filtrează lumina albastră',
      'Pentru monitor, telefon și becuri LED',
      'Ramă ușoară, pentru toată ziua',
      'Cat eye sau unisex pătrat, în trei culori',
    ],
    benefits: [
      { title: 'Mai puțină lumină albastră', text: 'La birou, în orele din fața ecranului.' },
      { title: 'Seri mai liniștite', text: 'Lumina ecranelor devine mai blândă.' },
      { title: 'Patru rame', text: 'Cat eye sau unisex pătrat, în trei culori.' },
    ],
    scene: {
      title: 'O ramă pe care o porți cu plăcere.',
      text: 'Cat eye sau unisex pătrat, în negru, bej sau maro. Același filtru în toate.',
      image: photo(glTerasa, 'Femeie pe o terasă, la apus, purtând NEUROS Amber cat eye bej'),
    },
    lookbook: {
      title: 'Patru rame. Același filtru.',
      text: 'Alegi silueta și culoarea. Lentilele sunt aceleași în toate modelele.',
      image: photo(glToate, 'Cele patru rame NEUROS Amber: cat eye negru și bej, unisex pătrat negru și maro'),
    },
    moments: [
      {
        title: 'Pentru zilele lungi la birou.',
        text: 'Filtrul reduce lumina albastră a monitorului.',
        image: photo(glBirou, 'Bărbat la birou, concentrat, purtând NEUROS Amber'),
      },
      {
        title: 'Și seara, cu telefonul în mână.',
        text: 'Lumina ecranelor devine mai blândă înainte de somn.',
        image: photo(glSeara, 'Femeie în pat, seara, citind pe tabletă cu NEUROS Amber'),
      },
    ],
    specs: [
      { label: 'Modele', value: 'Cat eye, unisex pătrat' },
      { label: 'Culori', value: 'Cat eye: negru, bej. Unisex pătrat: negru, maro' },
      { label: 'Lentile', value: 'Filtru pentru lumina albastră, nuanță chihlimbar' },
      { label: 'Ramă', value: 'Ușoară, pentru purtare zilnică' },
      { label: 'Garanție', value: '2 ani' },
    ],
    faqs: [
      { q: 'Când îi port?', a: 'La birou, în fața ecranelor, și seara, când folosești telefonul sau laptopul.' },
      { q: 'Pot să îi returnez?', a: 'Da, în 14 zile de la primire.' },
    ],
  },

  // NEUROS Flow: only what the source states (810 nm, 1/4/13 zones, adjustable protocol, remote, battery,
  // initial consultation). No health outcome is claimed; the source's study list is not reused.
  'brain-flow': {
    seo: {
      title: 'NEUROS Flow, cască cu lumină infraroșie 810 nm',
      description: 'NEUROS Flow: cască de fotobiomodulare cu lumină infraroșie la 810 nm, în configurații cu 1, 4 sau 13 zone. Protocol stabilit cu un specialist. Livrare gratuită în România.',
    },
    intro: 'Alegi configurația cu 1, 4 sau 13 zone. La început, un specialist Biohack Tech stabilește cu tine zonele, durata și frecvența ședințelor.',
    highlights: [
      'Lumină infraroșie de 810 nm, prin scalp',
      '1, 4 sau 13 zone, după configurație',
      'Protocol stabilit cu un specialist',
      'Baterie reîncărcabilă și telecomandă incluse',
    ],
    benefits: [
      { title: 'Se folosește acasă', text: 'Are baterie reîncărcabilă. Te așezi unde vrei.' },
      { title: 'Protocolul tău', text: 'Zone, durată și frecvență, setate cu un specialist.' },
      { title: 'Control simplu', text: 'Telecomandă inclusă. Ședința se oprește singură.' },
    ],
    scene: {
      title: 'Ședința, în ritmul tău.',
      text: 'Pui casca, confirmi zonele pe telecomandă și pornești ședința. Stai relaxat până se termină.',
      image: photo(bfBarbat, 'Bărbat relaxat pe canapea, cu casca NEUROS Flow pe cap'),
    },
    use: {
      title: 'Cum o folosești',
      image: cut(bfTelecomanda, 'NEUROS Flow lângă telecomanda inclusă'),
      steps: ['Stabilești protocolul cu specialistul, la început.', 'Pui casca și confirmi zonele pe telecomandă.', 'Pornești ședința. Casca se oprește la finalul timpului setat.'],
    },
    explain: {
      title: 'Ce înseamnă fotobiomodulare?',
      paragraphs: [
        'Fotobiomodulare înseamnă lumină roșie sau infraroșie aplicată din exterior. NEUROS Flow folosește lumină infraroșie la 810 nm, aplicată prin scalp.',
        'LED-urile sunt montate în interiorul căștii. Configurația aleasă stabilește câte zone poți activa în același protocol: 1, 4 sau 13.',
        'Casca și tehnologia sunt aceleași în toate configurațiile. Diferă doar numărul de zone.',
      ],
      image: cut(bfInterior, 'Interiorul căștii NEUROS Flow, cu LED-urile, lângă telecomandă'),
    },
    moments: [
      {
        title: 'În rutina zilei.',
        text: 'Ședințele se fac acasă, la ora aleasă de tine.',
        image: photo(bfBirou, 'Bărbat scriind la birou, lângă casca NEUROS Flow'),
      },
      {
        title: 'Începi cu un specialist.',
        text: 'Consultația de început stabilește protocolul. Îl revizuiți periodic, împreună.',
        image: photo(bfConsultatie, 'Consultație Biohack Tech: specialistul arată protocolul pe tabletă'),
      },
    ],
    specs: [
      { label: 'Tehnologie', value: 'Fotobiomodulare transcraniană (t-PBM)' },
      { label: 'Lungime de undă', value: '810 nm, infraroșu apropiat' },
      { label: 'Configurații', value: '1, 4 sau 13 zone selectabile' },
      { label: 'Parametri reglabili', value: 'Zone active, frecvență, durata ședinței' },
      { label: 'Control', value: 'Telecomandă inclusă' },
      { label: 'Alimentare', value: 'Baterie reîncărcabilă' },
      { label: 'Ghidaj', value: 'Consultație inițială pentru configurarea protocolului' },
      { label: 'Garanție', value: '2 ani' },
    ],
    faqs: [
      { q: 'Ce diferă între configurații?', a: 'Casca și tehnologia sunt aceleași. Diferă câte zone poți activa în același protocol: 1, 4 sau 13.' },
      { q: 'Cine stabilește protocolul?', a: 'Un specialist Biohack Tech, la consultația de început. Împreună alegeți zonele, durata și frecvența ședințelor.' },
      { q: 'Ce fel de produs este?', a: 'NEUROS Flow este un produs de wellness. Dacă ai o afecțiune sau urmezi un tratament, vorbește întâi cu medicul tău.' },
      { q: 'Pot să o returnez?', a: 'Da, în 14 zile de la primire, ca orice produs cumpărat online.' },
    ],
  },
}

/** The same pages in English, for /en. Same images, same facts, same limits on claims. */
export const productContentEn: Record<ProductId, ProductContent> = {
  'balance-wave': {
    seo: {
      title: 'NEUROS Calm, red light device for the neck and vagus nerve',
      description: 'NEUROS Calm is worn around the neck and shines red and infrared light over the vagus nerve area. A few minutes of relaxation at home. Free delivery in Romania.',
    },
    intro: 'The stress of the day builds up in the body. NEUROS Calm shines light on your neck. On the left side, 6 diodes at 810 nm light the vagus nerve area. A session lasts a few minutes.',
    highlights: [
      '6 diodes at 810 nm over the vagus nerve area',
      'Red light at 660 nm on the rest of the neck',
      'Sessions of a few minutes, switches off by itself',
      'A specialist helps you get started',
    ],
    benefits: [
      { title: 'Relaxation in a few minutes', text: 'A session lasts a few minutes.' },
      { title: 'Switches off by itself', text: 'You switch it on and relax.' },
      { title: 'Guidance included', text: 'A specialist helps you get started.' },
    ],
    scene: {
      title: 'A moment just for you.',
      text: 'Place it around your neck and switch it on. Then relax.',
      image: photo(bwCalm, 'Relaxed woman on a sofa, wearing NEUROS Calm around her neck'),
    },
    use: {
      title: 'How to use it',
      image: cut(bwSpate, 'NEUROS Calm from the back, with the power button'),
      steps: ['Place it around your neck.', 'Switch it on with its single button.', 'Relax. It switches off by itself.'],
    },
    explain: {
      title: 'Why the neck?',
      paragraphs: [
        'The vagus nerve runs through the neck. It is the longest nerve in the body. It links the brain to the heart, lungs and digestion.',
        'The vagus nerve plays a part in how the body moves from alert to rest.',
        'It is the most powerful device of its kind on the market. On the left side of the neck, 6 diodes give off 810 nm infrared light, which reaches deeper, towards the vagus nerve. The rest of the neck gets 660 nm red light.',
        'The light pulses 14 times a second, the rhythm of SMR brain waves, linked to a calm, balanced state. The method is called photobiomodulation.',
      ],
      image: photo(bwNervVag, 'Illustration: the vagus nerve starts in the brain and reaches the heart, lungs and digestion'),
    },
    moments: [
      {
        title: 'In the evening, before sleep.',
        text: 'A short session in the evening can help you wind down for sleep.',
        image: photo(bwSomn, 'Woman in bed in the evening, wearing NEUROS Calm'),
      },
    ],
    specs: [
      { label: 'Technology', value: 'Dual photobiomodulation: 660 nm and 810 nm' },
      { label: 'Left side', value: '6 diodes at 810 nm, over the vagus nerve area' },
      { label: 'Rest of the neck', value: '660 nm red light' },
      { label: 'Pulsed light', value: '14 Hz (SMR rhythm)' },
      { label: 'Switch off', value: 'Automatic' },
      { label: 'Warranty', value: '2 years' },
    ],
    faqs: [
      { q: 'Can I work while wearing it?', a: 'Yes. You can read, meditate or do light work during a session.' },
      { q: 'Will someone help me get started?', a: 'Yes. A Biohack Tech specialist suggests the routine that suits you.' },
      { q: 'What kind of product is it?', a: 'NEUROS Calm is a wellness product. If you have a medical condition, talk to your doctor first.' },
    ],
  },

  'brainlink-pro': {
    seo: {
      title: 'NEUROS Focus, EEG headband for focus and neurofeedback',
      description: 'NEUROS Focus is a light EEG headband with over 10 tablet games you control with your attention. Train your focus at home. Free delivery in Romania.',
    },
    intro: 'Attention slips away easily between notifications. Put on the headband and open the Neuros Game app on your tablet. The games respond to how focused you are.',
    highlights: [
      '3 EEG sensors, Bluetooth to a tablet',
      'Over 10 games and guided meditations',
      'Up to 4 hours on one charge',
      'A specialist recommends your programme',
    ],
    benefits: [
      { title: 'Train your focus', text: 'With short games on a tablet.' },
      { title: 'And your calm', text: 'Guided meditations with live feedback.' },
      { title: 'See your progress', text: 'Every session is saved.' },
    ],
    scene: {
      title: 'Focus, when you need it.',
      text: 'Training can help you get into focus faster. At work, while studying, anywhere.',
      image: photo(blFocus, 'Man at a desk, focused, wearing NEUROS Focus'),
    },
    use: {
      title: 'How to use it',
      image: cut(blLateral, 'NEUROS Focus from the side, with the ear sensor'),
      steps: ['Put on the headband and switch it on.', 'Connect it to your tablet by Bluetooth.', 'Choose a game or a meditation.'],
    },
    explain: {
      title: 'How does the headband know?',
      paragraphs: [
        'The brain gives off very faint electrical signals. The headband reads them through three small sensors (EEG).',
        'The app turns the signal into a game. When you pay attention, the game moves forward. Step by step, you learn to reach the right state more easily.',
        'The headband recognises states such as focus and relaxation. Your thoughts stay yours.',
        'The method comes from research on biofeedback. The studies below look at biofeedback as a method, in general.',
      ],
      image: photo(blComponente, 'Inside NEUROS Focus: the casing, circuit board, battery and speaker'),
      imageBg: '#f6f6f6',
      studies: [
        { label: 'Biofeedback and stress, Psychological Medicine (2017)', href: 'https://pubmed.ncbi.nlm.nih.gov/28349743/' },
        { label: 'Remote biofeedback, 18 studies (2025)', href: 'https://link.springer.com/article/10.1007/s10484-025-09750-w' },
        { label: 'Neurofeedback and attention, Imaging Neuroscience (2024)', href: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12224457/' },
        { label: 'Overview, NIH', href: 'https://www.ncbi.nlm.nih.gov/books/NBK279007/' },
      ],
    },
    moments: [
      {
        title: 'And for quiet moments.',
        text: 'The headband shows you live how relaxed you are. Meditation becomes easier to follow.',
        image: photo(blMeditatie, 'Woman meditating in a garden, wearing NEUROS Focus'),
      },
    ],
    specs: [
      { label: 'Sensors', value: '3 EEG sensors' },
      { label: 'App', value: 'Neuros Game: over 10 games and guided meditations' },
      { label: 'Connection', value: 'Bluetooth, to a tablet' },
      { label: 'Battery', value: 'Up to 4 hours, after one hour of charging' },
      { label: 'Certifications', value: 'CE, FCC' },
      { label: 'Hardware model', value: 'BrainLink Pro' },
      { label: 'Warranty', value: '2 years' },
    ],
    faqs: [
      { q: 'Do I need a tablet?', a: 'Yes. The Neuros Game app runs on a tablet, and the headband connects to it by Bluetooth.' },
      { q: 'What does the headband read?', a: 'States such as focus and relaxation. Your thoughts stay yours.' },
      { q: 'Will someone help me get started?', a: 'Yes. A specialist suggests the games and the routine that fit what you want to achieve.' },
    ],
  },

  'ochelari-biohack': {
    seo: {
      title: 'NEUROS Amber, blue light glasses with amber lenses',
      description: 'NEUROS Amber glasses have amber lenses that filter the blue light of screens. Cat eye or unisex square, in three colours. Free delivery in Romania.',
    },
    intro: 'Your eyes spend hours in the light of screens. The amber lenses filter blue light from monitors, phones and LED bulbs. The frame is light enough for all day.',
    highlights: [
      'Amber lenses that filter blue light',
      'For monitors, phones and LED bulbs',
      'A light frame, for all day',
      'Cat eye or unisex square, in three colours',
    ],
    benefits: [
      { title: 'Less blue light', text: 'At your desk, during your screen hours.' },
      { title: 'Calmer evenings', text: 'Screen light becomes softer.' },
      { title: 'Four frames', text: 'Cat eye or unisex square, in three colours.' },
    ],
    scene: {
      title: 'A frame you enjoy wearing.',
      text: 'Cat eye or unisex square, in black, beige or brown. The same filter in all of them.',
      image: photo(glTerasa, 'Woman on a terrace at sunset, wearing NEUROS Amber cat eye in beige'),
    },
    lookbook: {
      title: 'Four frames. One filter.',
      text: 'Choose the shape and the colour. The lenses are the same in every model.',
      image: photo(glToate, 'The four NEUROS Amber frames: cat eye in black and beige, unisex square in black and brown'),
    },
    moments: [
      {
        title: 'For long days at the desk.',
        text: 'The filter reduces the blue light of your monitor.',
        image: photo(glBirou, 'Man at a desk, focused, wearing NEUROS Amber'),
      },
      {
        title: 'And in the evening, phone in hand.',
        text: 'Screen light becomes softer before sleep.',
        image: photo(glSeara, 'Woman in bed in the evening, reading on a tablet with NEUROS Amber'),
      },
    ],
    specs: [
      { label: 'Models', value: 'Cat eye, unisex square' },
      { label: 'Colours', value: 'Cat eye: black, beige. Unisex square: black, brown' },
      { label: 'Lenses', value: 'Blue light filter, amber tint' },
      { label: 'Frame', value: 'Light, for everyday wear' },
      { label: 'Warranty', value: '2 years' },
    ],
    faqs: [
      { q: 'When do I wear them?', a: 'At your desk, in front of screens, and in the evening when you use your phone or laptop.' },
      { q: 'Can I return them?', a: 'Yes, within 14 days of delivery.' },
    ],
  },

  'brain-flow': {
    seo: {
      title: 'NEUROS Flow, 810 nm infrared light headset for home',
      description: 'NEUROS Flow is a photobiomodulation headset with 810 nm infrared light, with 1, 4 or 13 zones. Protocol set with a specialist. Free delivery in Romania.',
    },
    intro: 'Choose the configuration with 1, 4 or 13 zones. At the start, a Biohack Tech specialist sets the zones, session length and frequency with you.',
    highlights: [
      'Infrared light at 810 nm, through the scalp',
      '1, 4 or 13 zones, by configuration',
      'A protocol set with a specialist',
      'Rechargeable battery and remote included',
    ],
    benefits: [
      { title: 'Used at home', text: 'It runs on a rechargeable battery. Sit wherever you like.' },
      { title: 'Your protocol', text: 'Zones, length and frequency, set with a specialist.' },
      { title: 'Simple control', text: 'Remote included. The session stops by itself.' },
    ],
    scene: {
      title: 'Sessions at your own pace.',
      text: 'Put on the headset, confirm the zones on the remote and start the session. Relax until it ends.',
      image: photo(bfBarbat, 'Relaxed man on a sofa, wearing the NEUROS Flow headset'),
    },
    use: {
      title: 'How to use it',
      image: cut(bfTelecomanda, 'NEUROS Flow next to the included remote'),
      steps: ['Set your protocol with the specialist at the start.', 'Put on the headset and confirm the zones on the remote.', 'Start the session. The headset stops when the set time ends.'],
    },
    explain: {
      title: 'What is photobiomodulation?',
      paragraphs: [
        'Photobiomodulation means red or infrared light applied from outside. NEUROS Flow uses 810 nm infrared light, applied through the scalp.',
        'The LEDs sit inside the headset. The configuration you choose sets how many zones you can switch on in one protocol: 1, 4 or 13.',
        'The headset and the technology are the same in every configuration. Only the number of zones changes.',
      ],
      image: cut(bfInterior, 'Inside the NEUROS Flow headset, with its LEDs, next to the remote'),
    },
    moments: [
      {
        title: 'Part of your day.',
        text: 'Sessions happen at home, at a time you choose.',
        image: photo(bfBirou, 'Man writing at a desk, next to the NEUROS Flow headset'),
      },
      {
        title: 'You start with a specialist.',
        text: 'The first consultation sets your protocol. You review it together from time to time.',
        image: photo(bfConsultatie, 'Biohack Tech consultation: the specialist shows the protocol on a tablet'),
      },
    ],
    specs: [
      { label: 'Technology', value: 'Transcranial photobiomodulation (t-PBM)' },
      { label: 'Wavelength', value: '810 nm, near infrared' },
      { label: 'Configurations', value: '1, 4 or 13 selectable zones' },
      { label: 'Adjustable settings', value: 'Active zones, frequency, session length' },
      { label: 'Control', value: 'Remote included' },
      { label: 'Power', value: 'Rechargeable battery' },
      { label: 'Guidance', value: 'First consultation to set up your protocol' },
      { label: 'Warranty', value: '2 years' },
    ],
    faqs: [
      { q: 'What changes between configurations?', a: 'The headset and the technology are the same. What changes is how many zones you can switch on in one protocol: 1, 4 or 13.' },
      { q: 'Who sets the protocol?', a: 'A Biohack Tech specialist, at the first consultation. Together you choose the zones, session length and frequency.' },
      { q: 'What kind of product is it?', a: 'NEUROS Flow is a wellness product. If you have a medical condition or follow a course of care, talk to your doctor first.' },
      { q: 'Can I return it?', a: 'Yes, within 14 days of delivery, like anything bought online.' },
    ],
  },
}

/** A product page's content in the visitor's language. */
export function getProductContent(id: ProductId, locale: Locale = 'ro'): ProductContent {
  return (locale === 'en' ? productContentEn : productContent)[id]
}
