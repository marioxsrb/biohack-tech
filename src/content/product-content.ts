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

import carteAutoare from '@/assets/img/carte/diana-palotas.webp'
import { bookCopy } from './book'


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

/** The book's page has its own editorial sections (components/product/BookSections); this keeps the shared fields. */
function bookContent(locale: Locale): ProductContent {
  const b = bookCopy(locale)
  return {
    seo: b.seo,
    intro: b.intro,
    highlights: b.highlights,
    benefits: b.delivery.steps,
    scene: { title: b.author.name, text: b.author.bio, image: photo(carteAutoare, b.author.alt) },
    moments: [],
    specs: b.specs,
    faqs: b.faqs,
  }
}

export const productContent: Record<ProductId, ProductContent> = {
  'balance-wave': {
    seo: {
      title: 'NEUROS Calm, pentru liniște și somn mai lin',
      description: 'NEUROS Calm te ajută să lași stresul zilei în urmă. Susține calmul și un somn mai lin. Câteva minute, acasă. Livrare gratuită în România.',
    },
    intro: 'Te ajută să treci din agitația zilei într-o stare mai calmă. Susține mai puțin stres și un somn mai lin. O ședință ține câteva minute.',
    highlights: [
      'Te ajută să te liniștești în câteva minute',
      'Susține un somn mai lin',
      'Susține calmul, seara sau într-o pauză',
      'Pornești și te relaxezi. Se oprește singur',
    ],
    benefits: [
      { title: 'Mai puțin stres', text: 'Te ajută să lași ziua în urmă, în câteva minute.' },
      { title: 'Somn mai lin', text: 'Te ajută să adormi mai ușor după o ședință seara.' },
      { title: 'Un moment al tău', text: 'Pornești, respiri, te relaxezi. Se oprește singur.' },
    ],
    scene: {
      title: 'Un moment în care te liniștești.',
      text: 'Îl așezi, îl pornești și lași corpul să se așeze. Susține o liniște caldă, chiar din primele minute.',
      image: photo(bwCalm, 'Femeie relaxată pe canapea, purtând NEUROS Calm la gât'),
    },
    use: {
      title: 'Cum îl folosești',
      image: cut(bwSpate, 'NEUROS Calm văzut din spate, cu butonul de pornire'),
      steps: ['Îl așezi confortabil la gât.', 'Apeși un singur buton.', 'Te relaxezi. Se oprește singur.'],
    },
    explain: {
      title: 'Cum susține calmul',
      paragraphs: [
        'Te ajută în trecerea din alertă spre repaus. Pe gât trece nervul vag, un nerv lung care leagă creierul de inimă, plămâni și digestie.',
        'Nervul vag are un rol în felul în care corpul se liniștește.',
        'Pe partea stângă, 6 diode de 810 nm luminează zona nervului vag. Lumina infraroșie pătrunde mai adânc. Pe restul gâtului, lumină roșie de 660 nm. Este cel mai puternic dispozitiv de acest fel de pe piață.',
        'Lumina pulsează de 14 ori pe secundă, ritmul undelor cerebrale SMR, asociat cu o stare calmă. Metoda se numește fotobiomodulare.',
      ],
      image: photo(bwNervVag, 'Ilustrație: nervul vag pornește din creier și ajunge la inimă, plămâni și digestie'),
    },
    moments: [
      {
        title: 'Seara, spre un somn mai lin.',
        text: 'O ședință scurtă înainte de culcare te ajută să te liniștești. Te ajută să treci mai ușor spre somn.',
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
      { q: 'Pot să lucrez în timp ce îl port?', a: 'Da. Poți citi, medita sau lucra ușor, în timp ce te relaxezi.' },
      { q: 'Cum încep?', a: 'Îl încarci, îl așezi la gât și apeși butonul. Câteva minute de liniște, apoi se oprește singur. Dacă vrei să știi cum ți se potrivește, ne scrii sau ne suni.' },
      { q: 'Ce fel de produs este?', a: 'Un produs de wellness, pentru calm în fiecare zi. Susține relaxarea. Pentru o afecțiune, vorbește întâi cu medicul tău.' },
    ],
  },

  'brainlink-pro': {
    seo: {
      title: 'NEUROS Focus, pentru concentrare și claritate',
      description: 'NEUROS Focus te ajută să-ți aduni atenția. Susține focusul și energia la muncă și la studiu. Livrare gratuită.',
    },
    intro: 'Te ajută să-ți aduni atenția când mintea fuge. Susține focusul și o stare mai clară. Jocurile de pe tabletă răspund la cât de prezent ești.',
    highlights: [
      'Te ajută să intri mai ușor în concentrare',
      'Susține focusul',
      'Susține și calmul, prin meditații ghidate',
      'Îți vezi progresul, sesiune cu sesiune',
    ],
    benefits: [
      { title: 'Focus mai clar', text: 'Te ajută să rămâi la ce ai de făcut, prin jocuri scurte.' },
      { title: 'Mai multă energie', text: 'Susține energia pentru muncă și studiu.' },
      { title: 'Și liniște', text: 'Meditațiile ghidate te ajută să simți calmul, pe loc.' },
    ],
    scene: {
      title: 'Claritate, când ai nevoie de ea.',
      text: 'O sesiune scurtă te ajută să intri în focus. La muncă, la studiu, oriunde ai nevoie să fii prezent.',
      image: photo(blFocus, 'Bărbat la birou, concentrat, purtând NEUROS Focus'),
    },
    use: {
      title: 'Cum o folosești',
      image: cut(blLateral, 'NEUROS Focus văzută din lateral, cu senzorul de ureche'),
      steps: ['Pui casca și o pornești.', 'O legi de tabletă.', 'Alegi un joc sau o meditație.'],
    },
    explain: {
      title: 'Cum îți citește atenția',
      paragraphs: [
        'Te ajută să observi când ești atent și când mintea pleacă. Așa înveți să revii mai ușor la ce faci.',
        'Creierul produce semnale electrice foarte slabe. Casca le citește prin trei senzori EEG și le trimite aplicației prin Bluetooth.',
        'Neuros Game transformă semnalul în joc. Când ești atent, jocul înaintează. Sunt peste 10 jocuri și meditații ghidate, iar fiecare sesiune rămâne salvată. Bateria ține până la 4 ore.',
        'Casca recunoaște stări, precum concentrarea și relaxarea. Gândurile rămân ale tale. Metoda vine din cercetarea despre biofeedback. Studiile de mai jos privesc metoda, în general.',
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
        title: 'Și pentru liniștea de după.',
        text: 'Te ajută să vezi, pe loc, cât de relaxat ești. Te ajută să urmărești meditația mai ușor.',
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
      { q: 'Am nevoie de tabletă?', a: 'Da. Jocurile care îți antrenează atenția rulează în Neuros Game, pe tabletă. Casca se leagă prin Bluetooth, iar tu te concentrezi pe joc.' },
      { q: 'Ce citește casca?', a: 'Stări precum concentrarea și relaxarea, ca să te ajute să le recunoști. Gândurile rămân ale tale.' },
      { q: 'Cum încep?', a: 'Încarci casca, instalezi Neuros Game pe tabletă și o conectezi. Apoi alegi un joc scurt. Pentru întrebări, ne scrii sau ne suni.' },
    ],
  },

  'ochelari-biohack': {
    seo: {
      title: 'NEUROS Amber, pentru seri mai liniștite',
      description: 'NEUROS Amber te ajută să termini ziua mai calm. Lumina ecranelor se simte mai blândă, și susține ochi mai odihniți. Patru rame. Livrare gratuită.',
    },
    intro: 'Te ajută să stai la ecran cu o lumină mai blândă. Susține ochi mai odihniți și seri mai liniștite. Rama e ușoară, pentru toată ziua.',
    highlights: [
      'Te ajută să termini ziua mai calm',
      'Lumina ecranelor se simte mai blândă',
      'Susține ochi mai odihniți',
      'Patru rame, pe care le porți cu plăcere',
    ],
    benefits: [
      { title: 'Ochi mai odihniți', text: 'Te ajută în orele lungi de la birou, în fața ecranului.' },
      { title: 'Seri mai liniștite', text: 'Lumina telefonului și a laptopului devine mai blândă.' },
      { title: 'Un stil al tău', text: 'Patru rame. Alegi forma și culoarea care îți plac.' },
    ],
    scene: {
      title: 'O ramă pe care o porți cu plăcere.',
      text: 'Cat eye sau unisex pătrat, în negru, bej sau maro. Aceeași liniște în toate, seară de seară.',
      image: photo(glTerasa, 'Femeie pe o terasă, la apus, purtând NEUROS Amber cat eye bej'),
    },
    lookbook: {
      title: 'Patru rame. Aceeași liniște.',
      text: 'Alegi silueta și culoarea. În toate modelele, lumina ecranelor se simte mai blândă.',
      image: photo(glToate, 'Cele patru rame NEUROS Amber: cat eye negru și bej, unisex pătrat negru și maro'),
    },
    moments: [
      {
        title: 'Pentru zilele lungi la birou.',
        text: 'Te ajută să treci prin orele de ecran cu ochi mai odihniți. Filtrul ține lumina albastră mai departe.',
        image: photo(glBirou, 'Bărbat la birou, concentrat, purtând NEUROS Amber'),
      },
      {
        title: 'Și seara, cu telefonul în mână.',
        text: 'Lumina ecranelor devine mai blândă. Te ajută ca seara să se așeze mai ușor.',
        image: photo(glSeara, 'Femeie în pat, seara, citind pe tabletă cu NEUROS Amber'),
      },
    ],
    specs: [
      { label: 'Modele', value: 'Cat eye, unisex pătrat' },
      { label: 'Culori', value: 'Cat eye: negru, bej. Unisex pătrat: negru, maro' },
      { label: 'Lentile', value: 'Filtru pentru lumina albastră, nuanță chihlimbar' },
      { label: 'Dioptrie', value: 'Fără dioptrie. Nu se pot face pe rețetă sau cu lentile progresive' },
      { label: 'Ramă', value: 'Ușoară, pentru purtare zilnică' },
      { label: 'Garanție', value: '2 ani' },
    ],
    faqs: [
      { q: 'Când îi port?', a: 'Ziua, la birou, când vrei ochi mai odihniți. Seara, pe telefon sau laptop, când vrei o lumină mai blândă.' },
      {
        q: 'Se pot face cu dioptrie sau cu lentile progresive?',
        a: 'Din păcate, nu. NEUROS Amber vine doar cu lentilele lui chihlimbar, fără dioptrie, așa că nu le putem face după rețetă și nici cu lentile progresive. Dacă ai întrebări despre cum ți s-ar potrivi, scrie-ne și te ajutăm cu drag.',
      },
      { q: 'Pot să îi returnez?', a: 'Da, în 14 zile de la primire.' },
    ],
  },
  'carte-diana': bookContent('ro'),
}

/** The same pages in English, for /en. Same images, same facts, same limits on claims. */
export const productContentEn: Record<ProductId, ProductContent> = {
  'balance-wave': {
    seo: {
      title: 'NEUROS Calm, for calm and easier sleep',
      description: 'NEUROS Calm helps you leave the stress of the day behind. It supports a calmer state and easier sleep. A few minutes at home. Free worldwide delivery.',
    },
    intro: 'It helps you move from the rush of the day into a calmer state. It supports less stress and easier sleep. A session takes a few minutes.',
    highlights: [
      'Helps you unwind in a few minutes',
      'It supports easier sleep',
      'Supports calm, in the evening or on a break',
      'Switch it on and relax. It stops by itself',
    ],
    benefits: [
      { title: 'Less stress', text: 'It helps you leave the day behind, in a few minutes.' },
      { title: 'Easier sleep', text: 'It helps you fall asleep more easily after an evening session.' },
      { title: 'A moment of your own', text: 'Switch it on, breathe, relax. It stops by itself.' },
    ],
    scene: {
      title: 'A moment to unwind.',
      text: 'Place it, switch it on, and let your body settle. It supports a warm quiet, even in the first minutes.',
      image: photo(bwCalm, 'Relaxed woman on a sofa, wearing NEUROS Calm around her neck'),
    },
    use: {
      title: 'How to use it',
      image: cut(bwSpate, 'NEUROS Calm from the back, with the power button'),
      steps: ['Place it comfortably around your neck.', 'Press the single button.', 'Relax. It switches off by itself.'],
    },
    explain: {
      title: 'How it supports calm',
      paragraphs: [
        'It helps the shift from alert to rest. The vagus nerve runs through the neck. It is a long nerve that links the brain to the heart, lungs and digestion.',
        'The vagus nerve plays a part in how the body settles.',
        'On the left side, 6 diodes at 810 nm light the vagus nerve area. The infrared light reaches deeper. The rest of the neck gets 660 nm red light. It is the most powerful device of its kind on the market.',
        'The light pulses 14 times a second, the rhythm of SMR brain waves, linked to a calm state. The method is called photobiomodulation.',
      ],
      image: photo(bwNervVag, 'Illustration: the vagus nerve starts in the brain and reaches the heart, lungs and digestion'),
    },
    moments: [
      {
        title: 'In the evening, towards easier sleep.',
        text: 'A short session before bed helps you unwind. It helps you ease into sleep.',
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
      { q: 'Can I work while wearing it?', a: 'Yes. You can read, meditate or do light work while you relax.' },
      { q: 'How do I start?', a: 'Charge it, place it around your neck and press the button. A few quiet minutes, then it switches off by itself. If you want to know whether it suits you, write or call us.' },
      { q: 'What kind of product is it?', a: 'A wellness product, for everyday calm. It supports relaxation. If you have a medical condition, talk to your doctor first.' },
    ],
  },

  'brainlink-pro': {
    seo: {
      title: 'NEUROS Focus, for concentration and clarity',
      description: 'NEUROS Focus helps you gather your attention. It supports focus and energy at work and while studying. Free worldwide delivery.',
    },
    intro: 'It helps you gather your attention when your mind wanders. It supports focus and a clearer state. The games on your tablet respond to how present you are.',
    highlights: [
      'Helps you get into focus more easily',
      'It supports focus',
      'Also supports calm, with guided meditations',
      'See your progress, session by session',
    ],
    benefits: [
      { title: 'Clearer focus', text: 'It helps you stay with what you are doing, through short games.' },
      { title: 'More energy', text: 'It supports energy for work and study.' },
      { title: 'And quiet', text: 'Guided meditations help you feel the calm, right away.' },
    ],
    scene: {
      title: 'Clarity, when you need it.',
      text: 'A short session helps you get into focus. At work, while studying, wherever you need to be present.',
      image: photo(blFocus, 'Man at a desk, focused, wearing NEUROS Focus'),
    },
    use: {
      title: 'How to use it',
      image: cut(blLateral, 'NEUROS Focus from the side, with the ear sensor'),
      steps: ['Put on the headband and switch it on.', 'Connect it to your tablet.', 'Choose a game or a meditation.'],
    },
    explain: {
      title: 'How it reads your attention',
      paragraphs: [
        'It helps you notice when you are paying attention and when your mind drifts. That is how you learn to come back more easily.',
        'The brain gives off very faint electrical signals. The headband reads them through three EEG sensors and sends them to the app by Bluetooth.',
        'Neuros Game turns the signal into a game. When you pay attention, the game moves forward. There are over 10 games and guided meditations, and every session is saved. The battery lasts up to 4 hours.',
        'The headband recognises states such as focus and relaxation. Your thoughts stay yours. The method comes from research on biofeedback. The studies below look at the method, in general.',
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
        title: 'And for the quiet afterwards.',
        text: 'It helps you see, right away, how relaxed you are. It helps you follow the meditation more easily.',
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
      { q: 'Do I need a tablet?', a: 'Yes. The games that train your attention run in Neuros Game, on a tablet. The headband connects by Bluetooth, and you focus on the game.' },
      { q: 'What does the headband read?', a: 'States such as focus and relaxation, so it can help you recognise them. Your thoughts stay yours.' },
      { q: 'How do I start?', a: 'Charge the headband, install Neuros Game on your tablet and connect it. Then choose a short game. If you have questions, write or call us.' },
    ],
  },

  'ochelari-biohack': {
    seo: {
      title: 'NEUROS Amber, for calmer evenings',
      description: 'NEUROS Amber helps you end the day more calmly. Screen light feels softer, and it supports more rested eyes. Four frames. Free worldwide delivery.',
    },
    intro: 'It helps you stay at a screen in a softer light. It supports more rested eyes and calmer evenings. The frame is light enough for all day.',
    highlights: [
      'Helps you end the day more calmly',
      'Screen light feels softer',
      'It supports more rested eyes',
      'Four frames you enjoy wearing',
    ],
    benefits: [
      { title: 'More rested eyes', text: 'It helps through long hours at your desk, in front of the screen.' },
      { title: 'Calmer evenings', text: 'The light of your phone and laptop becomes softer.' },
      { title: 'A style of your own', text: 'Four frames. Choose the shape and colour you like.' },
    ],
    scene: {
      title: 'A frame you enjoy wearing.',
      text: 'Cat eye or unisex square, in black, beige or brown. The same calm in all of them, evening after evening.',
      image: photo(glTerasa, 'Woman on a terrace at sunset, wearing NEUROS Amber cat eye in beige'),
    },
    lookbook: {
      title: 'Four frames. The same calm.',
      text: 'Choose the shape and the colour. In every model, screen light feels softer.',
      image: photo(glToate, 'The four NEUROS Amber frames: cat eye in black and beige, unisex square in black and brown'),
    },
    moments: [
      {
        title: 'For long days at the desk.',
        text: 'It helps you get through screen hours with more rested eyes. The filter keeps blue light further away.',
        image: photo(glBirou, 'Man at a desk, focused, wearing NEUROS Amber'),
      },
      {
        title: 'And in the evening, phone in hand.',
        text: 'Screen light becomes softer. It helps the evening settle more easily.',
        image: photo(glSeara, 'Woman in bed in the evening, reading on a tablet with NEUROS Amber'),
      },
    ],
    specs: [
      { label: 'Models', value: 'Cat eye, unisex square' },
      { label: 'Colours', value: 'Cat eye: black, beige. Unisex square: black, brown' },
      { label: 'Lenses', value: 'Blue light filter, amber tint' },
      { label: 'Prescription', value: 'Non-prescription. Not available with prescription or progressive lenses' },
      { label: 'Frame', value: 'Light, for everyday wear' },
      { label: 'Warranty', value: '2 years' },
    ],
    faqs: [
      { q: 'When do I wear them?', a: 'In the daytime, at your desk, when you want more rested eyes. In the evening, on your phone or laptop, when you want a softer light.' },
      {
        q: 'Can they be made with a prescription or progressive lenses?',
        a: 'Unfortunately not. NEUROS Amber comes only with its own amber lenses, without a prescription, so we cannot make them to a prescription or with progressive lenses. If you are wondering whether they would suit you, write to us and we will gladly help.',
      },
      { q: 'Can I return them?', a: 'Yes, within 14 days of delivery.' },
    ],
  },
  'carte-diana': bookContent('en'),
}

/** A product page's content in the visitor's language. */
export function getProductContent(id: ProductId, locale: Locale = 'ro'): ProductContent {
  return (locale === 'en' ? productContentEn : productContent)[id]
}
