/** Homepage content, edited from the source copy. */
import type { ProductId } from './catalog'
import { terms } from '@/config/site'

/** Comparison rows. Each value comes from that product's source copy. */
export const compareRows: { label: string; values: Record<ProductId, string | null> }[] = [
  {
    label: 'Te ajută cu',
    values: {
      'balance-wave': 'Relaxare, stres, tensiune la gât, rutina de seară',
      'brainlink-pro': 'Focus, meditație, claritate mentală',
      'ochelari-biohack': 'Ore la ecran, lumina de seară',
    },
  },
  {
    label: 'Cum funcționează',
    values: {
      'balance-wave': 'Photobiomodulare duală, la gât',
      'brainlink-pro': 'Citire EEG și jocuri de feedback',
      'ochelari-biohack': 'Filtru pentru lumina albastră',
    },
  },
  {
    label: 'Cât durează',
    values: {
      'balance-wave': '5–20 minute pe ședință',
      'brainlink-pro': 'Sesiuni în Neuros Game, progres salvat',
      'ochelari-biohack': 'Îi porți cât stai la ecran',
    },
  },
  {
    label: 'Ai nevoie și de',
    values: {
      'balance-wave': null,
      'brainlink-pro': 'O tabletă, pentru aplicație',
      'ochelari-biohack': null,
    },
  },
  {
    label: 'Ghidaj de specialist',
    values: {
      'balance-wave': 'Consultație inițială',
      'brainlink-pro': 'Consultație inițială',
      'ochelari-biohack': null,
    },
  },
]

export const orderSteps = [
  { title: 'Alegi produsul', text: 'Îl adaugi în coș. Dacă nu știi ce ți se potrivește, te ajutăm să alegi.' },
  { title: 'Plătești online', text: 'Cu cardul, prin Stripe. Confirmarea vine pe email.' },
  {
    title: 'Primești acasă',
    text: `Pregătim comanda în ${terms.processingDays}, iar curierul o aduce în ${terms.transitDays}. Primești AWB pentru urmărire.`,
  },
  { title: 'Începi cu un specialist', text: 'Pentru Balance Wave și BrainLink Pro, o consultație inițială îți stabilește protocolul.' },
]

export const homeFaqs = [
  {
    q: 'Ce produse pot comanda?',
    a: 'Balance Wave, BrainLink Pro și Ochelarii Biohack. Plasezi comanda direct pe site și plătești online, cu cardul.',
  },
  {
    q: 'Livrarea este gratuită?',
    a: `Da, pentru toate comenzile livrate în România. Pregătim comanda în ${terms.processingDays}, iar transportul durează ${terms.transitDays}.`,
  },
  {
    q: 'Primesc ghidaj după achiziție?',
    a: 'Da. Pentru Balance Wave și BrainLink Pro recomandăm o consultație inițială, ca să stabilim protocolul potrivit obiectivului tău: somn, focus sau relaxare.',
  },
  {
    q: 'Ce garanție am și cum returnez un produs?',
    a: `Produsele au ${terms.warrantyYears} ani garanție comercială. Ai ${terms.returnDays} zile de la primire ca să renunți la comandă, conform politicii de retur.`,
  },
  {
    q: 'Plata este sigură?',
    a: 'Plata se face prin Stripe, pe o pagină securizată. Datele cardului nu ajung la noi.',
  },
  {
    q: 'Produsele înlocuiesc un tratament medical?',
    a: 'Nu. Sunt produse pentru starea generală de bine. Dacă ai o afecțiune sau urmezi un tratament, discută cu medicul înainte de utilizare.',
  },
]
