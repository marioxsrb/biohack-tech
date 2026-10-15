import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Autentificare · Admin Biohack Tech', robots: { index: false, follow: false } }

const ERRORS: Record<string, string> = {
  invalid: 'Utilizator sau parolă greșite.',
  limit: 'Prea multe încercări. Încearcă din nou peste 15 minute.',
  expired: 'Sesiunea a expirat. Autentifică-te din nou.',
}

/** The admin login: user and password (ADMIN_USER / ADMIN_PASSWORD), a signed session for 7 days. */
export default async function AdminLogin({ searchParams }: PageProps<'/[lang]/admin/login'>) {
  const sp = await searchParams
  const next = typeof sp.next === 'string' && /^\/admin(\/[\w/-]*)?$/.test(sp.next) ? sp.next : '/admin'
  const error = typeof sp.e === 'string' ? ERRORS[sp.e] : undefined
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink px-4">
      <form action="/api/admin/login" method="post" className="w-full max-w-[380px] rounded-[22px] bg-paper p-7 shadow-[0_30px_80px_-20px_rgba(0,0,0,.6)]">
        <p className="text-[15px] font-extrabold tracking-[0.04em] text-ink">
          BIOHACK <span className="text-cyan-700">TECH</span>
        </p>
        <h1 className="mt-5 text-[26px] tracking-[-0.02em]">Autentificare admin</h1>
        <p className="mt-1 text-[14.5px] text-muted">Comenzi, trafic, leaduri și rapoarte.</p>
        {error && (
          <p role="alert" className="mt-4 rounded-[12px] bg-[#fdecec] px-3.5 py-2.5 text-[14px] text-red-deep">
            {error}
          </p>
        )}
        <input type="hidden" name="next" value={next} />
        <label className="mt-5 block text-[14px] font-medium text-ink" htmlFor="user">
          Utilizator
        </label>
        <input id="user" name="user" autoComplete="username" required className="field mt-1.5 w-full" />
        <label className="mt-4 block text-[14px] font-medium text-ink" htmlFor="password">
          Parolă
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="field mt-1.5 w-full" />
        <button className="cta mt-6 w-full">Intră în admin</button>
      </form>
    </div>
  )
}
