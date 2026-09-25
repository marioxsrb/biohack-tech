import { Idx } from '@/components/ui/Idx'
import { orderSteps } from '@/content/home'
import { terms } from '@/config/site'

export function HowToOrder() {
  return (
    <section className="sec on-dark bg-dark text-white" aria-labelledby="order-title">
      <div className="wrap">
        <div className="grid items-end gap-y-4 md:grid-cols-12 md:gap-x-6">
          <div className="md:col-span-7">
            <Idx n="03">Cum comanzi</Idx>
            <h2 id="order-title" className="h2 rev !text-white">
              De la comandă la prima ședință.
            </h2>
          </div>
        </div>

        <ol className="mt-14 grid gap-x-6 gap-y-8 max-md:mt-10 sm:grid-cols-2 lg:grid-cols-4">
          {orderSteps.map((s, i) => (
            <li key={s.title} className="rev border-t border-dark-line pt-5">
              <span className="font-mono text-[12px] tracking-[0.08em] text-cyan">0{i + 1}</span>
              <h3 className="mt-3 text-[19px] !text-white">{s.title}</h3>
              <p className="mt-2 text-[15.5px] text-dark-muted">{s.text}</p>
            </li>
          ))}
        </ol>

        <dl className="rev mt-16 grid grid-cols-2 gap-3 max-md:mt-12 md:grid-cols-4">
          {[
            ['Livrare', 'Gratuită în România'],
            ['Retur', `${terms.returnDays} zile de la primire`],
            ['Garanție', `${terms.warrantyYears} ani`],
            ['Plată', 'Card, prin Stripe'],
          ].map(([k, v]) => (
            <div key={k} className="rounded-[12px] bg-dark-2 px-4 pt-4 pb-4">
              <dt className="mono !text-[11px]">{k}</dt>
              <dd className="mt-1 font-medium text-white">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
