/**
 * Interface words shared by many components (buttons, the cart, the store promises). Text that belongs
 * to one component lives next to it, in a { ro, en } object. Romanian is the reference: English must
 * have every key (the type enforces it).
 */
import { terms } from '@/config/site'

const ro = {
  addToCart: 'Adaugă în coș',
  addedToCart: 'Adăugat în coș',
  askPrice: 'Întreabă de preț',
  pricePending: 'Preț în curând',
  from: 'de la ',
  details: 'Detalii',
  viewCart: 'Vezi coșul',
  checkout: 'Finalizează comanda',
  keepShopping: 'Continuă cumpărăturile',
  close: 'Închide',
  skipToContent: 'Sari la conținut',
  pieces: (n: number) => `${n} buc.`,
  freeDelivery: 'Livrare gratuită',
  freeDeliveryRo: 'Livrare gratuită în România',
  returns: `Retur în ${terms.returnDays} zile`,
  changeMind: `${terms.returnDays} zile să te răzgândești`,
  warranty: `Garanție ${terms.warrantyYears} ani`,
  replyTime: `Îți răspundem ${terms.responseTime}`,
  payment: 'Plată cu cardul sau prin transfer bancar',
  vat: terms.vat as string,
  wellness: 'Produse de wellness pentru uz zilnic. Pentru o afecțiune, cere întâi sfatul medicului.',
  language: { label: 'Limba', switchTo: 'Switch to English', short: 'EN' },
}

export type Ui = typeof ro

const en: Ui = {
  addToCart: 'Add to cart',
  addedToCart: 'Added to cart',
  askPrice: 'Ask for the price',
  pricePending: 'Price coming soon',
  from: 'from ',
  details: 'Details',
  viewCart: 'View cart',
  checkout: 'Check out',
  keepShopping: 'Keep shopping',
  close: 'Close',
  skipToContent: 'Skip to content',
  pieces: (n: number) => `${n} pcs`,
  freeDelivery: 'Free delivery',
  freeDeliveryRo: 'Free delivery in Romania',
  returns: `${terms.returnDays}-day returns`,
  changeMind: `${terms.returnDays} days to change your mind`,
  warranty: `${terms.warrantyYears}-year warranty`,
  replyTime: 'We reply within 24 hours',
  payment: 'Pay by card or bank transfer',
  vat: '21% VAT included',
  wellness: 'Wellness products for daily use. If you have a medical condition, ask your doctor first.',
  language: { label: 'Language', switchTo: 'Schimbă în română', short: 'RO' },
}

export const ui = { ro, en }
