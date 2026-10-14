import { connection } from 'next/server'
import { getProduct, products } from '@/content/catalog'
import { formatLei } from '@/lib/money'
import { getDb } from '@/server/db'
import { promoCodes } from '@/server/promo'
import { togglePromoAction } from '../actions'
import { PromoForm } from './PromoForm'

const dt = (d: Date) => d.toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/**
 * Promo codes: create, see how much each one was used (orders that still stand) and what it cost, switch it
 * off. A code applies after the automatic promotions, for every payment method. Auth: the /admin Basic Auth.
 */
export default async function PromoCodesPage() {
  await connection()
  const list = await promoCodes.list(await getDb())
  const now = new Date()
  const state = (c: (typeof list)[number]) =>
    !c.active ? 'oprit' : c.endsAt && now >= c.endsAt ? 'expirat' : c.startsAt && now < c.startsAt ? 'programat' : c.maxUses != null && c.uses >= c.maxUses ? 'epuizat' : 'activ'

  return (
    <>
      <h1 className="mt-2 text-[34px] tracking-[-0.03em]">Coduri promoționale</h1>
      <p className="mt-2 max-w-[60em] text-[14.5px] text-muted">
        Clientul scrie codul în checkout. Reducerea se adună cu promoțiile automate: un cod de 10% înseamnă 10% din prețul întreg, deci 2 bucăți = 20%, 3+ = 30% (Amber: 2+1 plus 10%). Merge la orice metodă de plată și apare separat pe factură. O
        utilizare contează cât timp comanda e valabilă: o comandă anulată sau o plată cu cardul neterminată eliberează codul.
      </p>

      <h2 className="mt-8 text-[22px] tracking-[-0.02em]">Cod nou</h2>
      <PromoForm products={products.map((p) => ({ id: p.id, name: p.name }))} />

      <h2 className="mt-10 text-[22px] tracking-[-0.02em]">Coduri</h2>
      <ul className="mt-4 space-y-3">
        {list.map((c) => (
          <li key={c.code} className="rounded-[16px] bg-paper p-5 text-[14.5px]">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[18px] font-semibold tracking-[0.04em] text-ink">
                {c.code} <span className="ml-1 text-[14.5px] font-normal tracking-normal text-muted">· {c.kind === 'percent' ? `${c.value}%` : formatLei(c.value)} · {state(c)}</span>
              </p>
              <form action={togglePromoAction}>
                <input type="hidden" name="code" value={c.code} />
                <input type="hidden" name="active" value={String(!c.active)} />
                <button className="btn-secondary sm">{c.active ? 'Oprește codul' : 'Activează din nou'}</button>
              </form>
            </div>
            <dl className="mt-3 grid gap-x-6 gap-y-1 text-[13.5px] sm:grid-cols-2 lg:grid-cols-3">
              <Item k="Utilizări" v={`${c.uses}${c.maxUses != null ? ` din ${c.maxUses}` : ''}`} />
              <Item k="Reducere acordată" v={formatLei(c.discountMinor)} />
              <Item k="Valoare comenzi" v={formatLei(c.revenueMinor)} />
              <Item k="Produse" v={c.products ? c.products.map((p) => getProduct(p)?.name ?? p).join(', ') : 'toate'} />
              <Item k="Comandă minimă" v={c.minOrderMinor ? formatLei(c.minOrderMinor) : '–'} />
              <Item k="O dată pe client" v={c.oncePerEmail ? 'da' : 'nu'} />
              <Item k="Valabil" v={`${c.startsAt ? `de la ${dt(c.startsAt)}` : 'de acum'}${c.endsAt ? ` până la ${dt(c.endsAt)}` : ', fără dată de sfârșit'}`} />
              {c.note && <Item k="Notă" v={c.note} />}
              <Item k="Creat" v={dt(c.createdAt)} />
            </dl>
          </li>
        ))}
        {!list.length && <li className="rounded-[16px] bg-paper px-5 py-10 text-center text-muted">Niciun cod încă.</li>}
      </ul>
    </>
  )
}

function Item({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted">{k}:</dt>
      <dd className="text-ink">{v}</dd>
    </div>
  )
}
