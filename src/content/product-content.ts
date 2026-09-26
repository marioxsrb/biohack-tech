/**
 * Product page content, written for someone who sees the product for the first time:
 * what it is, what it does for you, how you use it. Technology is explained once, lower
 * on the page. Claims stay within the source material, at "poate ajuta" strength.
 * See docs/CONTENT-DECISIONS.md.
 */
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

export type Story = { title: string; text: string; image: ProductImage }

export type ProductContent = {
  seo: { title: string; description: string }
  /** Buy area: one or two short sentences under the price. */
  intro: string
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
      title: 'NEUROS Calm, pentru relaxare',
      description: 'NEUROS Calm se poartă la gât: 5-20 de minute de lumină roșie în zona nervului vag, apoi se oprește singur. Livrare gratuită în România.',
    },
    intro: 'Aplică lumină roșie în zona gâtului, pe unde trece nervul vag. O ședință durează între 5 și 20 de minute.',
    benefits: [
      { title: 'Câteva minute', text: 'O ședință durează între 5 și 20 de minute.' },
      { title: 'Se oprește singur', text: 'Alegi durata și te relaxezi.' },
      { title: 'Ghidaj inclus', text: 'Un specialist te ajută să începi.' },
    ],
    scene: {
      title: 'Un moment doar pentru tine.',
      text: 'Îl așezi la gât, alegi durata și te relaxezi. Mulți utilizatori simt gâtul și umerii mai relaxați încă din primele ședințe.',
      image: photo(bwCalm, 'Femeie relaxată pe canapea, purtând NEUROS Calm la gât'),
    },
    use: {
      title: 'Cum îl folosești',
      image: cut(bwSpate, 'NEUROS Calm văzut din spate, cu butonul de pornire'),
      steps: ['Îl așezi la gât.', 'Alegi durata, între 5 și 20 de minute.', 'Te relaxezi. Se oprește singur.'],
    },
    explain: {
      title: 'De ce la gât?',
      paragraphs: [
        'Pe acolo trece nervul vag, cel mai lung nerv din corp. Leagă creierul de inimă, plămâni și digestie.',
        'Nervul vag are un rol în felul în care corpul trece din alertă în repaus.',
        'NEUROS Calm folosește photobiomodulare: lumină roșie aplicată pe piele, din ambele părți ale gâtului.',
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
      { label: 'Tehnologie', value: 'Photobiomodulare duală (lumină roșie)' },
      { label: 'Unde se aplică', value: 'La gât, în zona nervului vag' },
      { label: 'Durată', value: '5-20 de minute, la alegere' },
      { label: 'Intensitate', value: 'Reglabilă pe trepte' },
      { label: 'Oprire', value: 'Automată' },
      { label: 'Garanție', value: '2 ani' },
    ],
    faqs: [
      { q: 'Pot să lucrez în timp ce îl port?', a: 'Da. Poți citi, medita sau lucra ușor în timpul ședinței.' },
      { q: 'Mă ajută cineva să încep?', a: 'Da. Un specialist Biohack Tech îți recomandă durata și programul potrivite pentru tine.' },
      { q: 'Este un tratament medical?', a: 'NEUROS Calm este un produs de wellness. Pentru o afecțiune, vorbește întâi cu medicul tău.' },
    ],
  },

  'brainlink-pro': {
    seo: {
      title: 'NEUROS Focus, pentru focus',
      description: 'NEUROS Focus: o cască ușoară și peste 10 jocuri pe tabletă, pe care le controlezi prin atenție. Livrare gratuită în România.',
    },
    intro: 'Pui casca și deschizi aplicația Neuros Game pe tabletă. Jocurile răspund la cât de atent ești.',
    benefits: [
      { title: 'Antrenezi focusul', text: 'Prin jocuri scurte, pe tabletă.' },
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
        'Metoda vine din cercetarea despre biofeedback. Studiile de mai jos privesc metoda în general, nu acest produs.',
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
      title: 'NEUROS Amber, ochelari pentru ecrane',
      description: 'Ochelari cu filtru pentru lumina albastră a ecranelor. Cat eye sau unisex pătrat, în negru, bej sau maro. Livrare gratuită în România.',
    },
    intro: 'Lentilele de culoarea chihlimbarului filtrează lumina albastră de la monitor, telefon și becuri LED. Rama e ușoară, pentru toată ziua.',
    benefits: [
      { title: 'Ochi mai odihniți', text: 'La birou, după ore în fața ecranului.' },
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
        text: 'Filtrul reduce lumina albastră a monitorului. Mulți utilizatori spun că ochii obosesc mai greu.',
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
}
