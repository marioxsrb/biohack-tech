/**
 * The Post-Purchase guides ({{product_first_steps}}, {{product_usage_tips}}), drafted 23.10.2026 for approval with the
 * emails. Every line comes from what the product pages already say (content/product-content.ts, amber-story.ts,
 * book.ts): no new technical instruction, no health claim. A customer with several products gets each product's
 * lines in one email (server/workflows/variables.ts productGuides).
 */
import type { ProductId } from '@/content/catalog'

export type ProductGuide = { firstSteps: string[]; usageTips: string[] }

export const PRODUCT_GUIDES: Partial<Record<ProductId, ProductGuide>> = {
  'balance-wave': {
    firstSteps: ['Încarcă NEUROS Calm.', 'Așază-l la gât și apasă butonul.', 'Câteva minute de liniște. Apoi se oprește singur.'],
    usageTips: ['Poți citi, medita sau lucra ușor cât îl porți.', 'Ai o afecțiune? Vorbește întâi cu medicul tău.'],
  },
  'brainlink-pro': {
    firstSteps: ['Încarcă casca. O oră de încărcare ține până la 4 ore.', 'Instalează Neuros Game pe tabletă.', 'Conectează casca prin Bluetooth și alege un joc scurt.'],
    usageTips: ['Începe cu jocuri scurte. Te concentrezi pe joc, casca citește concentrarea și relaxarea.', 'Ai peste 10 jocuri și meditații ghidate în Neuros Game.', 'Pentru întrebări, ne scrii sau ne suni.'],
  },
  'ochelari-biohack': {
    firstSteps: ['Poartă ochelarii seara, de la apus până te culci.', 'Folosește-i la laptop, la serial sau cu telefonul în pat.'],
    usageTips: ['Prin lentila galbenă culorile par mai calde. E normal.', 'Curăță lentilele cu apă călduță și o lavetă din microfibră.', 'Seara, la volan, conduci fără ei. Îi porți acasă.'],
  },
  'carte-diana': {
    firstSteps: ['Cartea fizică vine cu coletul.', 'Versiunea PDF o descarci din pagina comenzii. Linkul vine și pe email.'],
    usageTips: ['Linkul PDF a expirat? Deschide pagina comenzii pentru un link nou sau scrie-ne.'],
  },
}
