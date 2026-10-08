/**
 * Real customer reviews, published with each customer's consent (confirmed by the business on 08.10.2026,
 * together with the texts, names, ratings and months, exactly as the customers gave them). THE ONLY PLACE they live.
 *
 * The homepage shows all of them; a product page and its landing show only that product's. A product without
 * reviews (NEUROS Focus today) shows no review section. Add a review only with the customer's written consent;
 * never edit a customer's words. These are a selection: the average rating shown is the store's own
 * (config/social-proof.ts), and no review count is shown.
 */
import type { ProductId } from './catalog'

export type Review = {
  name: string
  /** Whole stars, 1-5, as the customer gave them. */
  rating: 1 | 2 | 3 | 4 | 5
  productId: ProductId
  /** Month of the review, YYYY-MM. */
  month: string
  quote: string
}

export const REVIEWS_CONSENT = { confirmedAt: '2026-10-08', source: 'Recenzii furnizate de business, cu acordul clienților' } as const

export const reviews: Review[] = [
  { name: 'Andrei M.', rating: 5, productId: 'brain-flow', month: '2026-10', quote: 'Îmi place că îl pot folosi acasă, fără să-mi complic programul. Designul e foarte reușit, iar utilizarea e simplă.' },
  { name: 'Cristina P.', rating: 5, productId: 'balance-wave', month: '2026-09', quote: 'A devenit parte din rutina mea de seară. Îmi place să am câteva minute dedicate relaxării după o zi aglomerată.' },
  { name: 'Mihai D.', rating: 5, productId: 'brain-flow', month: '2026-09', quote: 'Materialele sunt plăcute, iar produsul arată foarte bine. Instrucțiunile sunt ușor de urmărit.' },
  { name: 'Elena R.', rating: 4, productId: 'ochelari-biohack', month: '2026-08', quote: 'O experiență plăcută per total. Mi-ar fi plăcut să existe mai multe explicații în pachet, dar produsul este simplu de utilizat.' },
  { name: 'Vlad T.', rating: 5, productId: 'brain-flow', month: '2026-10', quote: 'L-am integrat în rutina de dimineață. Îmi place că pot dedica un interval scurt unei activități pentru mine.' },
  { name: 'Alexandra B.', rating: 5, productId: 'balance-wave', month: '2026-07', quote: 'Design minimalist, ușor de folosit și de depozitat. Exact genul de produs pe care îl prefer acasă.' },
  { name: 'Radu C.', rating: 5, productId: 'brain-flow', month: '2026-09', quote: 'Am apreciat în special cât de simplu este de pregătit pentru utilizare. Nu trebuie să pierd timp cu setări complicate.' },
  { name: 'Ioana S.', rating: 4, productId: 'ochelari-biohack', month: '2026-06', quote: 'Produsul este compact și practic. Ambalajul putea fi puțin mai bine organizat, dar experiența generală este bună.' },
  { name: 'Gabriel N.', rating: 5, productId: 'balance-wave', month: '2026-10', quote: 'Îmi place să-l folosesc după muncă, atunci când vreau să mă deconectez puțin de la ecrane și de la agitația zilei.' },
  { name: 'Maria L.', rating: 5, productId: 'brain-flow', month: '2026-08', quote: 'Aspectul produsului este foarte bine gândit. Se vede atenția acordată detaliilor.' },
  { name: 'Ștefan A.', rating: 5, productId: 'ochelari-biohack', month: '2026-09', quote: 'Un produs ușor de inclus în activitățile zilnice. Îmi place că nu ocupă mult spațiu.' },
  { name: 'Diana V.', rating: 5, productId: 'balance-wave', month: '2026-08', quote: 'Am căutat ceva simplu pentru momentele în care vreau să mă relaxez. Experiența de utilizare este foarte plăcută.' },
  { name: 'Robert F.', rating: 4, productId: 'brain-flow', month: '2026-07', quote: 'Produsul este bine realizat. Mi-a luat puțin timp să mă obișnuiesc cu rutina, dar acum îl folosesc fără dificultate.' },
  { name: 'Bianca G.', rating: 5, productId: 'ochelari-biohack', month: '2026-10', quote: 'Îmi place foarte mult designul. Este discret, compact și se potrivește cu restul lucrurilor pe care le folosesc zilnic.' },
  { name: 'Daniel H.', rating: 5, productId: 'brain-flow', month: '2026-09', quote: 'Comanda a fost simplă, iar prezentarea produsului m-a ajutat să înțeleg ce primesc. O experiență bună de cumpărare.' },
  { name: 'Ana-Maria I.', rating: 5, productId: 'balance-wave', month: '2026-08', quote: 'Îmi place ideea de a avea un mic ritual de relaxare seara. Produsul este intuitiv și ușor de folosit.' },
  { name: 'Cătălin O.', rating: 4, productId: 'brain-flow', month: '2026-06', quote: 'Calitatea construcției mi-a făcut o impresie bună. Aș fi preferat un ghid de utilizare ceva mai detaliat.' },
  { name: 'Laura E.', rating: 5, productId: 'ochelari-biohack', month: '2026-09', quote: 'Un produs practic, cu un design foarte plăcut. Mi-a fost ușor să îl includ în rutina mea.' },
  { name: 'Florin U.', rating: 5, productId: 'balance-wave', month: '2026-10', quote: 'Apreciez produsele care nu necesită prea multe pregătiri. Îl pot utiliza atunci când am câteva minute libere.' },
  { name: 'Patricia Z.', rating: 5, productId: 'brain-flow', month: '2026-07', quote: 'Îmi place combinația dintre tehnologie și design. Produsul are un aspect premium și este simplu de utilizat.' },
  { name: 'Bogdan M.', rating: 5, productId: 'ochelari-biohack', month: '2026-08', quote: 'L-am ales pentru dimensiunile compacte. Este ușor de păstrat la îndemână și de folosit atunci când am nevoie.' },
  { name: 'Oana C.', rating: 4, productId: 'balance-wave', month: '2026-09', quote: 'Experiența este plăcută, iar produsul arată bine. Mi-ar fi fost utile câteva exemple suplimentare de rutine de utilizare.' },
  { name: 'Victor P.', rating: 5, productId: 'brain-flow', month: '2026-10', quote: 'Mi-a plăcut că informațiile despre produs au fost prezentate simplu. Știam la ce să mă aștept când am făcut comanda.' },
  { name: 'Simona D.', rating: 5, productId: 'balance-wave', month: '2026-08', quote: 'Îl folosesc ca parte din momentele mele de liniște de la finalul zilei. Este ușor de integrat într-un program încărcat.' },
  { name: 'Adrian R.', rating: 5, productId: 'ochelari-biohack', month: '2026-09', quote: 'Un produs cu un design reușit și o utilizare intuitivă. Îmi place că este compact și nu necesită mult spațiu.' },
]

/** The reviews of one product, or all of them. */
export const reviewsFor = (productId?: ProductId) => (productId ? reviews.filter((r) => r.productId === productId) : reviews)

