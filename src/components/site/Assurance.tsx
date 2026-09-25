import { terms } from '@/config/site'

const promises = [
  { title: 'Livrare gratuită', text: 'Oriunde în România, în 3–8 zile.' },
  { title: `Retur în ${terms.returnDays} zile`, text: 'Dacă te răzgândești, îl trimiți înapoi.' },
  { title: `Garanție ${terms.warrantyYears} ani`, text: 'Pentru fiecare produs.' },
]

/** Purchase reassurance as three quiet lines of type. */
export function Assurance() {
  return (
    <section aria-label="Livrare, retur și garanție" className="border-t border-mist-2">
      <ul className="wrap grid gap-y-8 py-16 sm:grid-cols-3 sm:gap-x-6 max-sm:py-12">
        {promises.map((p) => (
          <li key={p.title} className="rev">
            <p className="text-[22px] font-medium tracking-[-0.025em] text-ink">{p.title}</p>
            <p className="mt-1 text-[15.5px] text-muted">{p.text}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
