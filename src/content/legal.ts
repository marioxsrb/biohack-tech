/**
 * Legal pages. The source material only lists these pages' headings, not their text.
 * Each page states only facts found in the material (or facts about how this site works),
 * and says clearly that the full legal text is still to be published.
 * See docs/OPEN-POINTS.md: the full texts and company details are required before launch.
 */
import { site, terms } from '@/config/site'

export type LegalPage = {
  slug: string
  title: string
  shortTitle: string
  description: string
  sections: { heading: string; body: string[] }[]
}

const contact = {
  heading: 'Contact',
  body: [`Pentru orice întrebare, scrie-ne la ${site.email} sau sună la ${site.phone}. Răspundem ${terms.responseTime}.`],
}

export const legalPages: LegalPage[] = [
  {
    slug: 'politica-livrare',
    title: 'Politica de livrare',
    shortTitle: 'Livrare',
    description:
      'Politica de livrare Biohack Tech: livrare gratuită în România, procesare în 1-3 zile, transport în 2-5 zile, urmărire prin AWB.',
    sections: [
      { heading: 'Zona de livrare', body: ['Livrăm în toată România.'] },
      {
        heading: 'Termene',
        body: [
          `Comanda se procesează în ${terms.processingDays} de la confirmarea plății. Transportul durează ${terms.transitDays}.`,
          'După expediere primești numărul AWB, ca să poți urmări coletul.',
          'În perioadele aglomerate, termenele pot fi puțin mai lungi. Te anunțăm dacă se întâmplă.',
        ],
      },
      {
        heading: 'Costuri',
        body: ['Livrarea este gratuită. Prețurile afișate includ TVA 21%.'],
      },
      contact,
    ],
  },
  {
    slug: 'politica-retur',
    title: 'Politica de retur și rambursare',
    shortTitle: 'Retur și rambursare',
    description:
      'Politica de retur Biohack Tech: drept de retragere în 14 zile de la primire, garanție comercială de 2 ani, contact pentru returnări.',
    sections: [
      {
        heading: 'Dreptul de retragere',
        body: [
          `Dacă ai cumpărat ca persoană fizică, poți renunța la comandă în ${terms.returnDays} zile de la primirea produsului, fără să motivezi decizia.`,
        ],
      },
      {
        heading: 'Cum inițiezi un retur',
        body: [`Scrie-ne la ${site.email} cu numărul comenzii. Îți trimitem pașii pentru returnare.`],
      },
      {
        heading: 'Produse defecte sau neconforme',
        body: [
          `Produsele au ${terms.warrantyYears} ani garanție comercială. Dacă un produs nu funcționează corect, scrie-ne și rezolvăm situația conform garanției.`,
        ],
      },
      contact,
    ],
  },
  {
    slug: 'privacy-policy',
    title: 'Politica de confidențialitate',
    shortTitle: 'Confidențialitate',
    description:
      'Politica de confidențialitate Biohack Tech: ce date colectăm la comandă, cum le folosim, ce stocăm în browser și ce drepturi ai.',
    sections: [
      {
        heading: 'Ce date colectăm',
        body: [
          'La comandă ne dai numele, adresa de email, telefonul, adresa de facturare și, dacă e alta, adresa de livrare. Pentru firme, și denumirea, codul fiscal și numărul de înregistrare. Le folosim ca să procesăm, să facturăm, să livrăm și să te informăm despre comandă.',
        ],
      },
      {
        heading: 'Plata',
        body: ['Plata cu cardul este procesată de Stripe. Datele cardului nu ajung la noi. La plata prin transfer bancar, vedem doar informațiile din extrasul de cont: numele plătitorului, suma și detaliile plății.'],
      },
      {
        heading: 'Ce stocăm în browser',
        body: [
          'Site-ul păstrează conținutul coșului în memoria browserului tău (localStorage), ca să nu se piardă la reîncărcarea paginii. Nu folosim cookie-uri de marketing sau de analiză.',
        ],
      },
      {
        heading: 'Drepturile tale',
        body: [
          'Ai dreptul să ceri accesul la datele tale, corectarea sau ștergerea lor și să te opui prelucrării. Poți depune o plângere la ANSPDCP (dataprotection.ro).',
        ],
      },
      contact,
    ],
  },
  {
    slug: 'terms-of-service',
    title: 'Termeni și condiții',
    shortTitle: 'Termeni și condiții',
    description:
      'Termenii și condițiile biohack-tech.ro: comenzi online, plata cu cardul sau prin transfer bancar, livrare, retur, garanție și informații despre utilizarea produselor.',
    sections: [
      {
        heading: 'Comenzi și plăți',
        body: [
          'Comanda se plasează pe site, ca persoană fizică sau juridică. Plătești cu cardul, prin Stripe, sau prin transfer bancar. La plata cu cardul, comanda este confirmată când plata reușește. La transfer bancar, comanda rămâne în așteptarea plății și o pregătim după ce suma ajunge în cont.',
        ],
      },
      {
        heading: 'Livrare, retur și garanție',
        body: [
          `Livrarea este gratuită în România. Ai drept de retragere în ${terms.returnDays} zile de la primire și ${terms.warrantyYears} ani garanție comercială. Detaliile sunt în politicile de livrare și de retur.`,
        ],
      },
      {
        heading: 'Informații despre produse',
        body: [
          'Produsele Biohack Tech sunt destinate stării generale de bine. Informațiile de pe site au caracter general și nu înlocuiesc sfatul medicului. Dacă ai o afecțiune sau urmezi un tratament, discută cu medicul înainte de utilizare. Rezultatele variază de la o persoană la alta.',
        ],
      },
      contact,
    ],
  },
]

export function getLegalPage(slug: string) {
  return legalPages.find((p) => p.slug === slug)
}
