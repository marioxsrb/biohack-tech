/**
 * Product page content. Rewritten from the source copy for someone who sees the
 * product for the first time: what it is, what it does for you, how you use it.
 * Technology is explained once, lower on the page, in plain words.
 *
 * Claims stay within the source material and at "poate ajuta" strength.
 * See docs/CONTENT-DECISIONS.md for what was removed and why.
 */
import type { ProductId, ProductImage } from './catalog'

import glResFocus from '@/assets/img/glasses/result-focus.webp'
import glResSeara from '@/assets/img/glasses/result-seara.webp'
import glResStil from '@/assets/img/glasses/result-stil.webp'

import bwResCalm from '@/assets/img/balance-wave/result-calm.webp'
import bwResSomn from '@/assets/img/balance-wave/result-somn.webp'
import bwNervVag from '@/assets/img/balance-wave/pillar-nerv-vag.webp'

import blLucru from '@/assets/img/brainlink/audience-lucru.webp'
import blResMeditatie from '@/assets/img/brainlink/result-meditation.webp'
import blStudio from '@/assets/img/brainlink/casca-studio.webp'

type Story = { title: string; text: string; image: ProductImage }

export type ProductContent = {
  seo: { title: string; description: string }
  /** Buy box: two short sentences. */
  intro: string
  /** Three or four very short benefits, under the buy button. */
  benefits: string[]
  /** Large image + short text blocks, alternating. */
  stories: Story[]
  /** How you use it, three steps. */
  steps?: string[]
  /** One section for people who want to understand the technology. */
  detail?: {
    title: string
    paragraphs: string[]
    image: ProductImage
    studies?: { label: string; href: string }[]
  }
  specs: { label: string; value: string }[]
  faqs: { q: string; a: string }[]
}

const photo = (src: ProductImage['src'], alt: string): ProductImage => ({ src, alt, kind: 'photo' })

export const productContent: Record<ProductId, ProductContent> = {
  'balance-wave': {
    seo: {
      title: 'Balance Wave, pentru relaxare',
      description:
        'Balance Wave se poartă la gât: 5–20 de minute de lumină roșie în zona nervului vag, când vrei să te relaxezi. 1.210 EUR, livrare gratuită în România.',
    },
    intro:
      'Un dispozitiv mic, purtat la gât, care aplică lumină roșie în zona prin care trece nervul vag. O ședință durează 5–20 de minute, acasă sau la birou.',
    benefits: ['Te poate ajuta să te relaxezi', '5–20 de minute pe ședință', 'Se oprește singur', 'Ghidaj de la un specialist'],
    stories: [
      {
        title: 'Câteva minute doar pentru tine.',
        text: 'Îl așezi la gât, alegi durata și te relaxezi. Mulți utilizatori simt gâtul și umerii mai relaxați încă din primele ședințe.',
        image: photo(bwResCalm, 'Femeie relaxată pe canapea, purtând Balance Wave'),
      },
      {
        title: 'Seara, înainte de somn.',
        text: 'O ședință scurtă seara poate face trecerea spre somn mai ușoară.',
        image: photo(bwResSomn, 'Femeie în pat, seara, purtând Balance Wave'),
      },
    ],
    steps: ['Îl așezi la gât.', 'Alegi între 5 și 20 de minute.', 'Te relaxezi. Se oprește singur.'],
    detail: {
      title: 'De ce la gât?',
      paragraphs: [
        'Pe acolo trece nervul vag, cel mai lung nerv din corp. Leagă creierul de inimă, plămâni și digestie și are un rol în felul în care corpul trece din alertă în repaus.',
        'Balance Wave folosește photobiomodulare: lumină roșie aplicată pe piele, din ambele părți ale gâtului. Totul se întâmplă la suprafață.',
      ],
      image: photo(bwNervVag, 'Ilustrație: nervul vag pornește din creier și ajunge la inimă, plămâni și digestie'),
    },
    specs: [
      { label: 'Tehnologie', value: 'Photobiomodulare duală (lumină roșie)' },
      { label: 'Unde se aplică', value: 'La gât, în zona nervului vag' },
      { label: 'Durată', value: '5–20 minute, la alegere' },
      { label: 'Intensitate', value: 'Reglabilă pe trepte' },
      { label: 'Oprire', value: 'Automată' },
      { label: 'Garanție', value: '2 ani' },
    ],
    faqs: [
      { q: 'Pot să lucrez în timp ce îl port?', a: 'Da. Poți citi, medita sau lucra ușor în timpul ședinței.' },
      {
        q: 'Mă ajută cineva să încep?',
        a: 'Da. Un specialist Biohack Tech îți recomandă durata și programul potrivite pentru tine.',
      },
      {
        q: 'Înlocuiește un tratament medical?',
        a: 'Nu. E un produs de wellness. Dacă ai o afecțiune, vorbește întâi cu medicul tău.',
      },
    ],
  },

  'brainlink-pro': {
    seo: {
      title: 'BrainLink Pro, pentru focus',
      description:
        'BrainLink Pro: o cască ușoară și peste 10 jocuri pe tabletă pe care le controlezi cu atenția. Îți antrenezi focusul și calmul. 2.490 RON, livrare gratuită.',
    },
    intro:
      'Pui casca, deschizi aplicația pe tabletă și joci. Jocurile răspund la cât de concentrat sau de relaxat ești, așa că îți antrenezi focusul jucându-te.',
    benefits: ['Antrenează focusul și calmul', 'Peste 10 jocuri și meditații ghidate', 'Îți vezi progresul în timp', 'Până la 4 ore pe o încărcare'],
    stories: [
      {
        title: 'Focus, când ai nevoie de el.',
        text: 'Antrenamentul te poate ajuta să intri mai repede în concentrare și să ignori distragerile. La muncă, la studiu, oriunde.',
        image: photo(blLucru, 'Bărbat la laptop, concentrat, purtând BrainLink Pro'),
      },
      {
        title: 'Și pentru momentele de liniște.',
        text: 'Casca îți arată în timp real cât de relaxat ești. Meditația devine mai ușor de urmărit.',
        image: photo(blResMeditatie, 'Femeie meditând în grădină, purtând BrainLink Pro'),
      },
    ],
    steps: ['Pui casca și o pornești.', 'O conectezi la tabletă.', 'Alegi un joc sau o meditație.'],
    detail: {
      title: 'Cum știe casca?',
      paragraphs: [
        'Creierul produce semnale electrice foarte slabe. Casca le citește prin trei senzori mici (EEG). Recunoaște stări precum concentrarea și relaxarea, nu gânduri.',
        'Aplicația Neuros Game transformă semnalul în joc. Când ești atent, jocul înaintează. Așa înveți, treptat, să ajungi mai ușor în starea potrivită.',
        'Metoda vine din cercetarea despre biofeedback, adică învățarea cu ajutorul semnalelor propriului corp. Studiile de mai jos nu testează BrainLink Pro direct.',
      ],
      image: { src: blStudio, alt: 'Casca BrainLink Pro pe un birou, fotografiată în studio', kind: 'photo' },
      studies: [
        { label: 'Biofeedback și stres, Psychological Medicine (2017)', href: 'https://pubmed.ncbi.nlm.nih.gov/28349743/' },
        { label: 'Biofeedback la distanță, 18 studii (2025)', href: 'https://link.springer.com/article/10.1007/s10484-025-09750-w' },
        { label: 'Neurofeedback și atenție, Imaging Neuroscience (2024)', href: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12224457/' },
        { label: 'Prezentare generală, NIH', href: 'https://www.ncbi.nlm.nih.gov/books/NBK279007/' },
      ],
    },
    specs: [
      { label: 'Senzori', value: '3 senzori EEG' },
      { label: 'Aplicație', value: 'Neuros Game, peste 10 jocuri și meditații ghidate' },
      { label: 'Conectare', value: 'Bluetooth, la tabletă' },
      { label: 'Baterie', value: 'Până la 4 ore, după o oră de încărcare' },
      { label: 'Certificări', value: 'CE, FCC' },
      { label: 'Garanție', value: '2 ani' },
    ],
    faqs: [
      { q: 'Am nevoie de tabletă?', a: 'Da. Aplicația Neuros Game rulează pe tabletă, iar casca se conectează prin Bluetooth.' },
      { q: 'Casca îmi citește gândurile?', a: 'Nu. Recunoaște doar stări, precum concentrarea și relaxarea.' },
      { q: 'Mă ajută cineva să încep?', a: 'Da. Un specialist îți recomandă jocurile și programul potrivite pentru ce vrei să obții.' },
    ],
  },

  'ochelari-biohack': {
    seo: {
      title: 'Ochelari Biohack, pentru ecrane',
      description:
        'Ochelari cu filtru pentru lumina albastră a ecranelor. Cat eye sau unisex pătrat, în negru, bej sau maro. 60 EUR, livrare gratuită în România.',
    },
    intro:
      'Lentilele filtrează lumina albastră de la monitor, telefon și becuri LED. Rama e ușoară, așa că îi porți toată ziua.',
    benefits: ['Ochi mai odihniți la ecran', 'Lumină mai blândă seara', 'Ramă ușoară, patru modele'],
    stories: [
      {
        title: 'Pentru zilele lungi la birou.',
        text: 'Filtrul reduce lumina albastră a monitorului. Mulți utilizatori spun că ochii obosesc mai greu.',
        image: photo(glResFocus, 'Bărbat la birou, concentrat, purtând Ochelari Biohack'),
      },
      {
        title: 'Și pentru serile cu telefonul în mână.',
        text: 'Seara, lumina ecranelor devine mai blândă. Un obicei simplu înainte de somn.',
        image: photo(glResSeara, 'Femeie în pat, seara, citind pe tabletă cu Ochelari Biohack'),
      },
      {
        title: 'Un accesoriu pe care îl porți cu plăcere.',
        text: 'Cat eye sau unisex pătrat, în negru, bej sau maro.',
        image: photo(glResStil, 'Femeie purtând Ochelari Biohack cat eye bej, în lumină naturală'),
      },
    ],
    specs: [
      { label: 'Modele', value: 'Cat eye, unisex pătrat' },
      { label: 'Culori', value: 'Cat eye: negru, bej. Unisex pătrat: negru, maro' },
      { label: 'Lentile', value: 'Filtru pentru lumina albastră, nuanță galbenă' },
      { label: 'Ramă', value: 'Ușoară, pentru purtare zilnică' },
      { label: 'Garanție', value: '2 ani' },
    ],
    faqs: [
      { q: 'Când îi port?', a: 'La birou, în fața ecranelor, și seara, când folosești telefonul sau laptopul.' },
      { q: 'Pot să îi returnez?', a: 'Da. Ai 14 zile de la primire.' },
    ],
  },
}
