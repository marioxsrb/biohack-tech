import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { site } from '@/config/site'
import { getDb } from '@/server/db'
import { buildReport, period, reportMarkdown } from '@/server/report'

export const metadata: Metadata = { title: 'Raport zilnic (AI)' }

const PERIODS = [
  { key: 'ieri', label: 'Ieri' },
  { key: 'azi', label: 'Azi' },
  { key: '7', label: '7 zile' },
  { key: '30', label: '30 de zile' },
]

/** The daily report as an AI assistant receives it, and how to connect one. */
export default async function ReportPage({ searchParams }: PageProps<'/[lang]/admin/raport'>) {
  await connection()
  const sp = await searchParams
  const key = typeof sp.p === 'string' ? sp.p : 'ieri'
  const text = reportMarkdown(await buildReport(await getDb(), period(key)))
  const configured = (process.env.ADMIN_API_TOKEN ?? '').length >= 32
  const endpoint = `${site.url}/api/admin/report`
  return (
    <div className="mx-auto max-w-[1000px]">
      <h1 className="text-[30px] tracking-[-0.03em]">Raport zilnic (AI)</h1>
      <p className="mt-1 max-w-[70ch] text-[15px] text-text">
        Un asistent AI poate citi în fiecare dimineață acest raport (trafic, leaduri, comenzi, produse, plăți, apeluri AI, coduri, ce e de rezolvat) și să-ți scrie un rezumat. Datele vin doar din baza de date a magazinului.
      </p>

      <section className="mt-5 rounded-[18px] bg-paper p-5">
        <h2 className="text-[16px] font-semibold text-ink">Conectarea unui asistent AI</h2>
        <p className="mt-2 text-[14px] text-text">
          Token: {configured ? <span className="font-medium text-[#167a4a]">configurat (ADMIN_API_TOKEN, în Vercel și în .env.local)</span> : <span className="font-medium text-red-deep">lipsește ADMIN_API_TOKEN (minim 32 de caractere)</span>}. Tokenul dă acces doar la acest raport, doar pentru citire.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-[12px] bg-ink p-4 text-[13px] leading-relaxed text-white">{`GET ${endpoint}?perioada=ieri&format=md
Authorization: Bearer <ADMIN_API_TOKEN>

perioada: ieri (implicit) | azi | 7 | 30 | AAAA-LL-ZZ
format:   md (text, în română) | json (implicit, pentru automatizări)`}</pre>
        <p className="mt-3 text-[14px] text-text">
          Exemplu de instrucțiune pentru asistent: „În fiecare zi la 9:00, citește raportul de ieri și trimite-mi pe scurt: vânzări, comenzi, trafic și surse, ce s-a vândut, apelurile AI și ce trebuie rezolvat azi.”
        </p>
      </section>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Perioada" className="flex gap-1 rounded-[12px] bg-paper p-1 text-[14px]">
          {PERIODS.map((x) => (
            <Link key={x.key} href={`/admin/raport?p=${x.key}`} aria-current={key === x.key ? 'page' : undefined} className={`rounded-[9px] px-3.5 py-1.5 ${key === x.key ? 'bg-ink text-white' : 'text-ink hover:bg-mist'}`}>
              {x.label}
            </Link>
          ))}
        </nav>
        <a href={`/api/admin/report?perioada=${key}`} target="_blank" className="text-[14px] text-muted underline underline-offset-4">
          Vezi JSON
        </a>
      </div>
      <pre className="mt-3 overflow-x-auto rounded-[18px] bg-paper p-5 text-[13.5px] leading-relaxed whitespace-pre-wrap text-ink">{text}</pre>
    </div>
  )
}
