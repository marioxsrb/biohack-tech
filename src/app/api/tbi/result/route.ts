import { NextResponse, type NextRequest } from 'next/server'

export const runtime = 'nodejs'

const page = (title: string, text: string) => `<!doctype html>
<html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>${title} · Biohack Tech</title>
<style>body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f2f5f6;color:#0b1316}
main{max-width:520px;margin:12vh auto;padding:32px 24px;background:#fff;border-radius:20px}
h1{font-size:26px;line-height:1.2;margin:0 0 12px}p{font-size:16px;line-height:1.6;margin:0 0 14px;color:#27343a}
a.btn{display:inline-block;margin-top:8px;padding:14px 22px;border-radius:12px;background:#000;color:#fff;text-decoration:none;font-weight:600}</style></head>
<body><main><h1>${title}</h1>${text}<a class="btn" href="https://biohack-tech.ro/">Înapoi la Biohack Tech</a></main></body></html>`

/**
 * GET /api/tbi/result?r=ok|fail: where TBI Fusion Pay sends the customer after the online application
 * (successRedirectURL / failRedirectURL). The decision itself comes from TBI's status update, not from this page.
 */
export function GET(req: NextRequest) {
  const ok = req.nextUrl.searchParams.get('r') === 'ok'
  const html = ok
    ? page('Mulțumim, cererea ta a ajuns la tbi bank', '<p>tbi bank analizează cererea și îți răspunde online. Când primim aprobarea, îți pregătim comanda și te anunțăm.</p><p>Ai întrebări? Sună-ne la 0767 978 707 sau scrie-ne la contact@biohack-tech.ro.</p>')
    : page('Cererea nu a fost finalizată', '<p>Cererea de rate la tbi bank nu a fost finalizată. Poți încerca din nou de pe pagina produsului sau poți comanda cu plata la livrare.</p><p>Te ajutăm la 0767 978 707 sau la contact@biohack-tech.ro.</p>')
  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' } })
}
