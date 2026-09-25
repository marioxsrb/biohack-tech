/**
 * Product page content, edited from the source copy.
 *
 * Editing rules applied (see docs/CONTENT-DECISIONS.md for the full list):
 * - Health wording stays at "poate susține / poate contribui". No diagnosis, treatment or cure.
 * - Superlatives without a source ("de ultimă generație", "unul dintre cele mai mici") were removed.
 * - The glasses' cortisol / melatonin claim was removed pending substantiation.
 * - The "Dovedit științific" badge was removed: no study in the material tests these products.
 */
import type { ProductId, ProductImage } from './catalog'

import glBirou from '@/assets/img/glasses/audience-birou.webp'
import glSeara from '@/assets/img/glasses/audience-seara.webp'
import glStil from '@/assets/img/glasses/audience-stil.webp'
import glResFocus from '@/assets/img/glasses/result-focus.webp'
import glResSeara from '@/assets/img/glasses/result-seara.webp'
import glResStil from '@/assets/img/glasses/result-stil.webp'

import bwStres from '@/assets/img/balance-wave/audience-stres.webp'
import bwBirou from '@/assets/img/balance-wave/audience-birou.webp'
import bwSomn from '@/assets/img/balance-wave/audience-somn.webp'
import bwNervVag from '@/assets/img/balance-wave/pillar-nerv-vag.webp'
import bwCalm from '@/assets/img/balance-wave/pillar-calm.webp'
import bwResCalm from '@/assets/img/balance-wave/result-calm.webp'
import bwResSomn from '@/assets/img/balance-wave/result-somn.webp'
import bwResEchilibru from '@/assets/img/balance-wave/result-echilibru.webp'

import blMeditatie from '@/assets/img/brainlink/audience-meditatie.webp'
import blLucru from '@/assets/img/brainlink/audience-lucru.webp'
import blGames from '@/assets/img/brainlink/pillar-games.webp'
import blStudio from '@/assets/img/brainlink/casca-studio.webp'
import blEmolight from '@/assets/img/brainlink/pillar-emolight.webp'
import blComponente from '@/assets/img/brainlink/componente.webp'
import blResFocus from '@/assets/img/brainlink/result-focus.webp'
import blResMeditatie from '@/assets/img/brainlink/result-meditation.webp'
import blResEnergie from '@/assets/img/brainlink/result-energy.webp'

type Item = { title: string; text: string; image?: ProductImage }
type Block = { heading: string; intro?: string; items: Item[] }

export type Study = { period: string; topic: string; title: string; text: string; links: { label: string; href: string }[] }

export type ProductContent = {
  seo: { title: string; description: string }
  /** Heading of the overview section. */
  overviewHeading: string
  /** Overview paragraph. */
  about: string
  /** Three to four bullets in the buy box. */
  highlights: string[]
  /** Short facts for listings and the comparison table. */
  facts: { label: string; value: string }[]
  audience: Block
  explainer?: Block
  steps?: Block
  results: Block & { note?: string }
  studies?: { heading: string; intro: string; items: Study[] }
  specs: { label: string; value: string }[]
  specImage?: ProductImage
  faqs: { q: string; a: string }[]
}

const photo = (src: ProductImage['src'], alt: string): ProductImage => ({ src, alt, kind: 'photo' })

export const productContent: Record<ProductId, ProductContent> = {
  'balance-wave': {
    seo: {
      title: 'Balance Wave, stimularea nervului vag',
      description:
        'Balance Wave: photobiomodulare duală în zona nervului vag, ședințe de 5–20 de minute. 1.210 EUR, livrare gratuită în România, garanție 2 ani.',
    },
    overviewHeading: 'Reglezi legătura dintre corp și minte.',
    about:
      'Balance Wave folosește photobiomodulare duală în zona cervicală, pe unde trece nervul vag. Poate susține relaxarea, confortul zilnic și rutina de seară. O ședință durează între 5 și 20 de minute, acasă sau la birou.',
    highlights: [
      'Photobiomodulare duală, pe traseul nervului vag',
      'Ședințe de 5–20 de minute, cu oprire automată',
      'Poate susține relaxarea și confortul cervical',
    ],
    facts: [
      { label: 'Tehnologie', value: 'Photobiomodulare duală' },
      { label: 'Ședință', value: '5–20 minute' },
      { label: 'Unde', value: 'La gât, zona cervicală' },
    ],
    audience: {
      heading: 'Pentru cine este',
      items: [
        {
          title: 'Zile încărcate',
          text: 'Pentru agitația de seară, umerii încordați și senzația că ești mereu în alertă.',
          image: photo(bwStres, 'Femeie relaxată seara pe canapea, cu Balance Wave pe masă'),
        },
        {
          title: 'Ore la birou',
          text: 'Pentru pauze scurte de recuperare și tensiunea din zona gâtului.',
          image: photo(bwBirou, 'Femeie la birou cu mâna pe ceafă, Balance Wave lângă laptop'),
        },
        {
          title: 'Rutina de seară',
          text: 'O ședință scurtă înainte de culcare poate susține relaxarea.',
          image: photo(bwSomn, 'Femeie citind în pat, Balance Wave pe noptieră'),
        },
      ],
    },
    explainer: {
      heading: 'Nervul vag, pe scurt',
      intro:
        'Nervul vag este cel mai lung nerv cranian. Leagă creierul de inimă, plămâni și sistemul digestiv, iar o parte din traseul lui trece prin zona gâtului.',
      items: [
        {
          title: 'De ce la gât',
          text: 'Zona cervicală este un punct de legătură între creier și corp. Acolo se așază Balance Wave.',
          image: photo(bwNervVag, 'Ilustrație: nervul vag leagă creierul de inimă, plămâni și digestie'),
        },
        {
          title: 'De la tensiune la calm',
          text: 'Photobiomodularea duală poate contribui la confortul local și poate susține trecerea sistemului nervos din alertă spre relaxare.',
          image: photo(bwCalm, 'Ilustrație: tensiunea din zona cervicală, apoi relaxare'),
        },
        {
          title: 'Răspunsul de relaxare',
          text: 'Stimularea din apropierea nervului vag poate susține răspunsul parasimpatic, asociat cu odihna și recuperarea.',
        },
      ],
    },
    steps: {
      heading: '5–20 de minute pe ședință',
      items: [
        { title: 'Așezi dispozitivul', text: 'Îl poziționezi confortabil la gât, în zona cervicală.' },
        { title: 'Alegi durata', text: 'Între 5 și 20 de minute. Intensitatea se reglează pe trepte.' },
        { title: 'Te relaxezi', text: 'Poți citi, medita sau lucra ușor. Dispozitivul se oprește singur la final.' },
      ],
    },
    results: {
      heading: 'Ce spun utilizatorii',
      note: 'Experiențe descrise de utilizatori. Rezultatele variază de la o persoană la alta.',
      items: [
        {
          title: 'Calm, din primele ședințe',
          text: 'Mulți utilizatori simt gâtul și umerii mai relaxați încă de la început.',
          image: photo(bwResCalm, 'Femeie relaxată pe canapea, purtând Balance Wave cu lumina roșie activă'),
        },
        {
          title: 'Seri mai liniștite',
          text: 'Folosit seara, constant, poate susține o adormire mai ușoară.',
          image: photo(bwResSomn, 'Femeie în pat, seara, purtând Balance Wave'),
        },
        {
          title: 'Echilibru pe termen lung',
          text: 'Cu timpul, poate contribui la o stare de calm și la o recuperare mai bună.',
          image: photo(bwResEchilibru, 'Femeie cu expresie calmă, purtând Balance Wave'),
        },
      ],
    },
    specs: [
      { label: 'Tehnologie', value: 'Photobiomodulare duală' },
      { label: 'Zonă de aplicare', value: 'Gât, zona cervicală, pe traseul nervului vag' },
      { label: 'Durata unei ședințe', value: '5–20 minute, la alegere' },
      { label: 'Intensitate', value: 'Reglabilă pe trepte' },
      { label: 'Oprire', value: 'Automată, la finalul ședinței' },
      { label: 'Utilizare', value: 'Externă, non-invazivă' },
      { label: 'Ghidaj', value: 'Consultație inițială cu un specialist, recomandată' },
    ],
    faqs: [
      {
        q: 'Cât durează o ședință?',
        a: 'Între 5 și 20 de minute. Poți face o pauză scurtă în timpul zilei sau o ședință completă seara.',
      },
      { q: 'Pot să îl folosesc în timp ce lucrez?', a: 'Da. În timpul ședinței poți citi, medita sau lucra ușor.' },
      {
        q: 'Primesc ghidaj după achiziție?',
        a: 'Da. Recomandăm o consultație inițială cu un specialist Biohack Tech, ca să stabilim durata și protocolul potrivite pentru tine.',
      },
      {
        q: 'Înlocuiește un tratament medical?',
        a: 'Nu. Balance Wave este un dispozitiv de wellness. Dacă ai o afecțiune sau urmezi un tratament, discută cu medicul tău înainte de utilizare.',
      },
    ],
  },

  'brainlink-pro': {
    seo: {
      title: 'BrainLink Pro, cască EEG pentru antrenament mental',
      description:
        'BrainLink Pro: cască EEG cu 3 electrozi, peste 10 jocuri în Neuros Game și meditație ghidată. 2.490 RON, livrare gratuită în România, garanție 2 ani.',
    },
    overviewHeading: 'Agilitate mentală, antrenată acasă.',
    about:
      'BrainLink Pro citește activitatea creierului prin 3 electrozi EEG și o trimite prin Bluetooth în aplicația Neuros Game, pe tabletă. Antrenezi focusul, calmul și claritatea prin jocuri, meditație ghidată și rapoarte de sesiune.',
    highlights: [
      '3 electrozi EEG: detectează focusul, relaxarea și alte stări mentale',
      'Peste 10 jocuri de antrenament în Neuros Game',
      'Conectare Bluetooth la tabletă',
      'Certificări CE și FCC',
    ],
    facts: [
      { label: 'Tehnologie', value: 'EEG, 3 electrozi' },
      { label: 'Aplicație', value: 'Neuros Game, pe tabletă' },
      { label: 'Autonomie', value: 'Până la 4 ore' },
    ],
    audience: {
      heading: 'Pentru cine este',
      items: [
        {
          title: 'Antrenament zilnic',
          text: 'Un mod practic de a-ți antrena focusul acasă, ca o sală de sport pentru minte.',
          image: photo(blLucru, 'Bărbat la laptop, concentrat, purtând BrainLink Pro'),
        },
        {
          title: 'Meditație și calm',
          text: 'Feedback în timp real despre activitatea creierului, pentru sesiuni de meditație mai profunde.',
          image: photo(blMeditatie, 'Femeie meditând în living, purtând BrainLink Pro'),
        },
        {
          title: 'Jocuri interactive',
          text: 'Controlezi obiecte din joc cu atenția ta. Antrenamentul rămâne captivant.',
          image: photo(blGames, 'Tânăr cu BrainLink Pro jucând Neuros Game pe tabletă'),
        },
      ],
    },
    explainer: {
      heading: 'Cum funcționează',
      intro:
        'Casca măsoară activitatea electrică a creierului. Aplicația transformă semnalul în feedback: vezi când ești concentrat sau relaxat și înveți să ajungi mai ușor acolo.',
      items: [
        {
          title: 'Trei electrozi EEG',
          text: 'Fără echipament de laborator. Casca detectează focusul, relaxarea și alte stări mentale, nu gânduri.',
          image: { src: blStudio, alt: 'Casca BrainLink Pro, fotografiată în studio', kind: 'photo' },
        },
        {
          title: 'EmoLight',
          text: 'Lumina multicoloră a căștii reflectă starea ta mentală. Nivelul bateriei apare în Neuros Game.',
          image: photo(blEmolight, 'Bărbat relaxat în fotoliu, purtând BrainLink Pro'),
        },
        {
          title: 'Neuros Game',
          text: 'Peste 10 jocuri antrenează 7 abilități mentale, printre care focusul, meditația, gestionarea stresului și calmul.',
        },
      ],
    },
    steps: {
      // Non-breaking hyphens keep "conecteaz-o" from splitting across lines.
      heading: 'Pune\u2011o, conecteaz\u2011o, antrenează\u2011te',
      items: [
        { title: 'Pui casca', text: 'Așezi banda confortabil pe cap. Designul ergonomic e gândit pentru purtare zilnică.' },
        { title: 'O pornești', text: 'Apeși butonul de pornire. Configurarea durează câteva secunde.' },
        { title: 'Deschizi Neuros Game', text: 'Asociezi casca cu tableta prin Bluetooth și vezi în timp real datele despre starea ta mentală.' },
        { title: 'Te antrenezi', text: 'Alegi meditație ghidată, antrenament de focus sau jocuri. Progresul se păstrează de la o sesiune la alta.' },
      ],
    },
    results: {
      heading: '7 abilități mentale, prin peste 10 jocuri',
      note: 'Experiențe descrise de utilizatori, nu efecte clinice măsurate. Rezultatele variază de la o persoană la alta.',
      items: [
        {
          title: 'Focus',
          text: 'Antrenamentul poate susține capacitatea de a intra rapid în concentrare și de a ignora distragerile.',
          image: photo(blResFocus, 'Bărbat la birou, concentrat, purtând BrainLink Pro'),
        },
        {
          title: 'Meditație',
          text: 'Feedbackul EEG poate contribui la sesiuni de relaxare mai profunde.',
          image: photo(blResMeditatie, 'Femeie meditând în grădină, purtând BrainLink Pro'),
        },
        {
          title: 'Energie în rutina zilnică',
          text: 'Mulți utilizatori descriu mai multă claritate în timpul zilei, pe măsură ce stresul scade.',
          image: photo(blResEnergie, 'Bărbat lucrând la laptop, purtând BrainLink Pro'),
        },
      ],
    },
    studies: {
      heading: 'Ce spune literatura științifică',
      intro:
        'Studii publicate despre biofeedback HRV și neuromodulare EEG, domeniile din care vine această tehnologie. Sunt relevante pentru rutine de wellness, nu pentru tratament medical, și nu testează BrainLink Pro în mod direct.',
      items: [
        {
          period: '2021–2025',
          topic: 'Calm și HRV',
          title: 'Meta-analize recente despre biofeedback HRV',
          text: 'Meta-analize pe studii randomizate raportează efecte medii asupra stării de calm și a indicatorilor legați de stres.',
          links: [
            { label: 'Remote HRV-biofeedback (2025), 18 studii, 1.352 participanți', href: 'https://link.springer.com/article/10.1007/s10484-025-09750-w' },
            { label: 'Scientific Reports (2021), 14 studii randomizate', href: 'https://www.nature.com/articles/s41598-021-86149-7' },
          ],
        },
        {
          period: '2017',
          topic: 'Stres și anxietate',
          title: 'Goessl et al., Psychological Medicine',
          text: 'Pe 24 de studii și 484 de participanți, biofeedbackul HRV a fost asociat cu scăderea stresului și a anxietății raportate de participanți.',
          links: [{ label: 'Meta-analiza pe PubMed', href: 'https://pubmed.ncbi.nlm.nih.gov/28349743/' }],
        },
        {
          period: '2022–2024',
          topic: 'Atenție și EEG',
          title: 'Meta-analize despre neuromodularea EEG',
          text: 'Neuromodularea EEG este studiată pentru atenție. Rezultatele trebuie citite cu prudență: unele comparații cu procedura placebo nu arată diferențe semnificative.',
          links: [
            { label: 'Adulți sănătoși, Imaging Neuroscience (2024)', href: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12224457/' },
            { label: 'Atenție și ADHD, meta-analiză (2022), 14 studii', href: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9764556/' },
          ],
        },
        {
          period: 'Referință',
          topic: 'Mecanism',
          title: 'Neuromodulare și autoreglare',
          text: 'Activitatea creierului este urmărită în timp real prin EEG, iar feedbackul vizual sau sonor te ajută să înveți să îți reglezi anumite tipare.',
          links: [{ label: 'Prezentare generală, NIH', href: 'https://www.ncbi.nlm.nih.gov/books/NBK279007/' }],
        },
      ],
    },
    specs: [
      { label: 'Senzori', value: '3 electrozi EEG' },
      { label: 'Conectare', value: 'Bluetooth, către tabletă' },
      { label: 'Aplicație', value: 'Neuros Game: peste 10 jocuri, 7 abilități mentale, meditație ghidată' },
      { label: 'Baterie', value: 'O oră de încărcare, până la 4 ore de utilizare' },
      { label: 'Indicatori', value: 'LED de conectivitate, lumină EmoLight' },
      { label: 'Componente', value: 'Cip bio-senzorial, conector integrat, buzzer cu consum redus, baterie certificată' },
      { label: 'Firmware', value: 'Actualizabil' },
      { label: 'Certificări', value: 'CE, FCC' },
    ],
    specImage: {
      src: blComponente,
      alt: 'BrainLink Pro, vedere explodată: carcasă, placă electronică, baterie și buzzer, cu etichete pentru fiecare componentă',
      kind: 'photo',
    },
    faqs: [
      { q: 'Am nevoie de tabletă?', a: 'Da. Casca se conectează prin Bluetooth la o tabletă, pe care rulează aplicația Neuros Game.' },
      { q: 'Casca îmi citește gândurile?', a: 'Nu. Detectează stări mentale precum focusul și relaxarea, nu gânduri.' },
      { q: 'Cât ține bateria?', a: 'O oră de încărcare oferă până la 4 ore de utilizare.' },
      {
        q: 'Primesc ghidaj după achiziție?',
        a: 'Da. Recomandăm o consultație inițială cu un specialist Biohack Tech, ca să alegi jocurile și programul potrivite obiectivelor tale.',
      },
    ],
  },

  'ochelari-biohack': {
    seo: {
      title: 'Ochelari Biohack, filtru pentru lumina albastră',
      description:
        'Ochelari Biohack cu filtru pentru lumina albastră: unisex pătrat sau cat eye, în negru, bej sau maro. 60 EUR, livrare gratuită în România.',
    },
    overviewHeading: 'Protecție vizuală, în modelul tău.',
    about:
      'Ochelarii Biohack filtrează lumina albastră de la ecrane și becurile LED. Rama e ușoară, gândită pentru purtare zilnică. Alegi între unisex pătrat și cat eye, în negru, bej sau maro.',
    highlights: [
      'Filtru pentru lumina albastră de la ecrane și LED',
      'Ramă ușoară, confortabilă toată ziua',
      'Patru modele: unisex pătrat și cat eye',
    ],
    facts: [
      { label: 'Tehnologie', value: 'Filtru lumină albastră' },
      { label: 'Modele', value: 'Unisex pătrat, cat eye' },
      { label: 'Când', value: 'La ecran și seara' },
    ],
    audience: {
      heading: 'Pentru cine sunt',
      items: [
        {
          title: 'Ore în fața ecranului',
          text: 'Filtrul reduce lumina albastră de la monitor, ca ochii să obosească mai greu.',
          image: photo(glBirou, 'Ochelari Biohack pe birou, lângă tastatură și monitor'),
        },
        {
          title: 'Seara, înainte de somn',
          text: 'Lumină mai blândă când folosești telefonul sau laptopul după apus.',
          image: photo(glSeara, 'Ochelari Biohack pe noptieră, lângă laptop, seara'),
        },
        {
          title: 'Stil și funcție',
          text: 'Patru variante de ramă. Alegi silueta și culoarea care ți se potrivesc.',
          image: photo(glStil, 'Cele patru modele de Ochelari Biohack, așezate pe o masă'),
        },
      ],
    },
    results: {
      heading: 'Ochi mai odihniți, un look care te reprezintă',
      note: 'Experiențe descrise de utilizatori. Rezultatele variază de la o persoană la alta.',
      items: [
        {
          title: 'Mai puțină oboseală',
          text: 'Mulți utilizatori simt ochii mai odihniți după zile lungi la ecran.',
          image: photo(glResFocus, 'Bărbat la birou, concentrat, purtând Ochelari Biohack'),
        },
        {
          title: 'Seri mai liniștite',
          text: 'Lumina puternică a ecranelor se estompează, iar seara devine mai calmă.',
          image: photo(glResSeara, 'Femeie în pat, seara, citind pe tabletă cu Ochelari Biohack'),
        },
        {
          title: 'Un accesoriu pe care îl porți',
          text: 'Nu doar protecție: o ramă potrivită cu ținuta ta.',
          image: photo(glResStil, 'Femeie purtând Ochelari Biohack cat eye bej, în lumină naturală'),
        },
      ],
    },
    specs: [
      { label: 'Modele', value: 'Unisex pătrat, cat eye' },
      { label: 'Culori', value: 'Cat eye: negru, bej. Unisex pătrat: negru, maro' },
      { label: 'Lentile', value: 'Filtru pentru lumina albastră, nuanță galbenă' },
      { label: 'Pentru', value: 'Ecrane și iluminat LED' },
      { label: 'Ramă', value: 'Ușoară, pentru purtare zilnică' },
    ],
    faqs: [
      { q: 'Ce modele pot alege?', a: 'Cat eye, în negru sau bej, și unisex pătrat, în negru sau maro. Toate au filtru pentru lumina albastră.' },
      { q: 'Când îi port?', a: 'La birou, în fața ecranelor, și seara, când folosești telefonul sau laptopul înainte de somn.' },
      { q: 'Pot returna ochelarii?', a: 'Da. Ai 14 zile de la primire, conform politicii de retur.' },
    ],
  },
}
