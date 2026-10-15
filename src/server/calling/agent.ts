/**
 * The ElevenLabs agent for Biohack Tech: its instructions, its knowledge and the answers it records after
 * each call. Built from the same sources as the website (catalog and prices, approved product content,
 * promotions, commercial terms and legal pages), so the agent can never quote another price, invent a
 * delivery time or a guarantee. A test keeps docs/ai-calling/agent.json in sync with this file; the script
 * scripts/elevenlabs-agent.mjs sends that JSON to ElevenLabs (create or update).
 */
import { productsIn, unitPrice, variantLabel } from '@/content/catalog'
import { getProductContent } from '@/content/product-content'
import { legalPages, type LegalBlock } from '@/content/legal'
import { PROMOTIONS } from '@/config/promotions'
import { cashOnDelivery } from '@/config/payments'
import { site, terms } from '@/config/site'
import { formatLei } from '@/lib/money'
import { CALL_OUTCOMES } from './calls'
import { openingLine } from './offer'

export { openingLine }

/** Paragraphs, lists and tables of a legal page as plain lines (links lose their URL). */
function plain(blocks: LegalBlock[]): string[] {
  const strip = (t: string) => t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  return blocks.flatMap((b) => (typeof b === 'string' ? [strip(b)] : 'list' in b ? b.list.map((l) => `- ${strip(l)}`) : b.table.rows.map((r) => `- ${r.map(strip).join(' | ')}`)))
}

function legalSection(slug: string, title: string) {
  const page = legalPages.find((p) => p.slug === slug)
  if (!page) return ''
  const body = page.sections.filter((s) => s.heading !== 'Contact').flatMap((s) => [`${s.heading}:`, ...plain(s.body)])
  return `## ${title}\n${body.join('\n')}`
}

/** Everything the agent may say about the products and the shop, in Romanian. */
export function agentKnowledge(siteUrl: string = site.url): string {
  const products = productsIn('ro').map((p) => {
    const c = getProductContent(p.id, 'ro')
    const variants = (p.variants ?? []).map((v) => `- ${variantLabel(p, v)}: ${formatLei(unitPrice(p, v) ?? p.price ?? 0)}`)
    const promo = PROMOTIONS.find((x) => (x.products as string[]).includes(p.id))
    return [
      `## ${p.name} (${p.kind})`,
      `Pentru ce este: ${p.purpose}. ${p.tagline}`,
      `Preț: ${p.price !== null ? `${p.variablePrice ? 'de la ' : ''}${formatLei(p.price)}` : 'nu are încă preț'} (${terms.vat}, ${terms.shipping.toLowerCase()}).`,
      ...(variants.length ? ['Variante:', ...variants] : []),
      ...(promo ? [`Promoție: ${promo.line}`] : []),
      `Pagina produsului: ${siteUrl}/products/${p.slug}`,
      `Pe scurt: ${c.intro}`,
      'Ce oferă:',
      ...c.highlights.map((h) => `- ${h}`),
      ...c.benefits.map((b) => `- ${b.title}: ${b.text}`),
      ...(c.use ? ['Cum se folosește:', ...c.use.steps.map((s, i) => `${i + 1}. ${s}`)] : []),
      ...(c.explain ? ['Cum funcționează:', ...c.explain.paragraphs] : []),
      'Specificații:',
      ...c.specs.map((s) => `- ${s.label}: ${s.value}`),
      ...(p.guidance ? ['Include o discuție de inițiere cu un specialist, care recomandă programul de folosire.'] : []),
      'Întrebări frecvente:',
      ...c.faqs.flatMap((f) => [`Î: ${f.q}`, `R: ${f.a}`]),
    ].join('\n')
  })
  return [
    `# Biohack Tech`,
    `Magazin online din România care vinde dispozitivele NEUROS. Site: ${siteUrl}. Email: ${site.email}. Telefon: ${site.phone}. Răspundem ${terms.responseTime}.`,
    `Produse vândute acum: ${productsIn('ro').map((p) => p.name).join(', ')}. NEUROS Flow nu se mai vinde.`,
    ...products,
    `## Plată\nMetode: ${[cashOnDelivery.enabled && 'ramburs (plata la livrare, curierului)', 'card bancar online prin Stripe', 'transfer bancar'].filter(Boolean).join(', ')}. Datele cardului se introduc doar pe site, niciodată la telefon.`,
    legalSection('plati', 'Plăți (detalii)'),
    legalSection('politica-livrare', 'Livrare'),
    legalSection('politica-retur', 'Retur și drept de retragere'),
    legalSection('garantie', 'Garanție și reclamații'),
  ]
    .filter(Boolean)
    .join('\n\n')
}

export const AGENT_NAME = 'BiohackTech — Recuperare Comenzi'

export const AGENT_INSTRUCTIONS = `# Cine ești
Ești asistentul vocal AI al Biohack Tech, magazin online din România care vinde dispozitivele NEUROS. Vorbești doar în română, natural, cald și profesionist, ca un consultant atent care chiar vrea să ajute. Nu citești un script. Propoziții scurte, pauze firești, lași omul să vorbească și nu îl întrerupi. Spui de la început că ești asistent AI și nu te prezinți niciodată ca om.

Un apel bun durează între un minut și două. Răspunzi la întrebări relevante, dar nu lungești discuția.

# Contextul acestui apel (din sistem, nu îl inventa)
- Persoana: {{customer_first_name}}
- Situația: {{abandonment_type}} (cos_nefinalizat = a început o comandă pe site și nu a terminat-o; oferta_solicitata = a cerut prețul pe pagina de ofertă, fără coș)
- Produse: {{product_names}}
- Cantități (doar la coș): {{product_quantities}}
- Totalul coșului (doar la coș, cu promoțiile de azi): {{cart_total}}
- Reducerea pregătită de sistem: {{recovery_discount_percent}}%, codul {{recovery_code}}, valabil până pe {{recovery_expiration}}
- Emailul cu codul a fost trimis: {{recovery_email_sent}} (da sau nu)

Dacă codul de reducere e gol (procent 0), nu oferi nicio reducere și nu pomeni emailul cu codul.

Pentru oferta_solicitata nu există coș și nici comandă: vorbești despre produsul care l-a interesat, nu spui că a lăsat ceva în coș. Nu inventezi produse, cantități, totaluri, prețuri sau termene. Dacă un câmp e gol, nu îl pomenești. Dacă ai nevoie să verifici ceva, folosește instrumentele.

# Cum decurge apelul
1. Primul mesaj l-ai spus deja: te-ai prezentat ca asistent AI, ai spus de ce suni și ai întrebat dacă are un minut.
2. Dacă are un minut, întrebi deschis ce l-a oprit sau dacă are vreo întrebare. Asculți până la capăt.
3. Răspunzi scurt și concret, doar din secțiunea Cunoștințe: preț, ce face produsul, cum se folosește, livrare, plată (inclusiv ramburs), retur în 14 zile, garanție.
4. Când e potrivit, după ce ai răspuns la obiecție, spui oferta: o reducere de {{recovery_discount_percent}}% din prețul întreg, valabilă 24 de ore, până pe {{recovery_expiration}}. Spui o singură dată, fără presiune.
   - Dacă emailul a fost trimis (da): „V-am trimis pe email codul și linkul care vă duce direct înapoi la comandă.”
   - Dacă nu (nu): nu spui că e pe email. Întrebi dacă vrea să i-l trimiți pe email. Dacă da, confirmi că îl primește după apel.
   - Codul nu se cumulează cu promoțiile din coș (10% la 2 bucăți, 20% la 3 sau mai multe, Amber 2+1). Sistemul aplică automat varianta mai avantajoasă. Dacă întreabă, explici asta simplu. Nu promiți ambele reduceri.
   - Codul îl spui pe litere doar dacă îl cere.
5. Închei politicos, îi mulțumești pentru timp și închei apelul.

# Când omul nu vrea să vorbească
Dacă spune „Nu am timp”, „Nu, mulțumesc”, „Nu mă interesează acum” sau ceva asemănător:
- dacă emailul a fost trimis (da), spui doar: „Sigur, nu vă mai rețin. Dacă vă răzgândiți, găsiți pe email un cod de reducere de {{recovery_discount_percent}}%, valabil 24 de ore. O zi frumoasă!”
- dacă nu (nu), spui doar: „Sigur, nu vă mai rețin. O zi frumoasă!”
Apoi folosești record_outcome cu not_interested și închei apelul. Nu insiști, nu mai faci încă o ofertă.

Dacă cere clar să nu mai fie contactat („nu mă mai sunați”, „ștergeți-mi numărul”, „nu mai vreau mesaje”): folosești imediat record_opt_out, spui „Am înțeles, am notat. Nu vă mai contactăm. O zi bună!” și închei apelul. Nu pomenești emailul și nu promiți nimic altceva.

# Instrumente
- get_recovery_context: produsele, cantitățile, totalul, reducerea și starea emailului, dacă ai nevoie să verifici.
- check_discount: dacă reducerea mai este valabilă înainte să o confirmi.
- recovery_email_status: dacă emailul cu codul a plecat, înainte să spui „găsiți pe email”.
- record_outcome: la final, rezultatul: interested, more_info, human_follow_up, not_interested sau opted_out.
- request_human_follow_up: când cere un om sau rămâne o întrebare la care nu ai răspuns. Spui că un coleg revine în timpul programului.
- record_opt_out: când refuză orice contact viitor.
Pentru fiecare instrument trimiți call_id = {{call_id}}.

# Reguli
- Dacă nu vorbești cu {{customer_first_name}}, îți ceri scuze, nu spui de ce ai sunat și închei.
- Dacă răspunde un robot sau mesageria vocală, nu lași mesaj și închei.
- Nu promiți rezultate medicale, nu dai diagnostice, nu spui că un produs tratează o boală. La întrebări despre boli, sarcină, medicamente sau implanturi spui că nu poți da sfaturi medicale și recomanzi discuția cu medicul.
- Dacă nu știi ceva, spui sincer și propui ca un coleg să revină (${site.phone}).
- Nu inventezi alte reduceri, stoc limitat sau termene. Singura ofertă este codul de mai sus.
- Nu ceri și nu primești date de card, CNP, parole sau adresa. Comanda și plata se fac doar pe site, inclusiv rambursul la livrare.
- Nu poți modifica comenzi, plăți sau facturi și nu poți crea coduri. Dacă cineva cere asta, propui un coleg.
- Dacă persoana pare confuză sau vulnerabilă, închei politicos.`

/** Said first, built by the server per call (a cart or the price form), with the AI disclosure in it. */
export const AGENT_FIRST_MESSAGE = '{{opening_line}}'

/** What the agent records after each call; read by the webhook (server/calling/calls.ts). */
export function dataCollection() {
  return {
    outcome: {
      type: 'string',
      description: `Rezultatul apelului, exact una dintre valorile: interested (vrea să comande sau e aproape decis), more_info (are întrebări sau vrea mai multe informații), human_follow_up (a cerut să vorbească cu un om), not_interested (nu e interesat sau nu are timp), opted_out (a cerut să nu mai fie contactat), voicemail (mesagerie vocală sau nimeni nu a vorbit), wrong_person (nu era persoana căutată). Valori acceptate de aplicație: ${CALL_OUTCOMES.join(', ')}, voicemail, wrong_person.`,
    },
    follow_up_required: { type: 'boolean', description: 'true dacă persoana a cerut să fie contactată de un om sau a rămas o întrebare la care asistentul nu a putut răspunde.' },
    opted_out: { type: 'boolean', description: 'true dacă persoana a cerut, în orice formă, să nu mai fie contactată.' },
    wants_link: { type: 'boolean', description: 'true dacă persoana a cerut sau a acceptat să primească pe email codul de reducere și linkul comenzii.' },
    discount_offered: { type: 'boolean', description: 'true dacă asistentul a spus oferta de reducere în timpul apelului.' },
  }
}

const CALL_ID = { type: 'string', description: 'Identificatorul apelului', dynamic_variable: 'call_id' }

/**
 * The server tools (webhooks to /api/calling/tools/<name>); the secret header is added by the setup script from a
 * workspace secret, so it never sits in this file or in the prompt.
 */
export function agentTools(siteUrl: string = site.url) {
  const tool = (name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []) => ({
    type: 'webhook',
    name,
    description,
    response_timeout_secs: 10,
    api_schema: {
      url: `${siteUrl}/api/calling/tools/${name}`,
      method: 'POST',
      request_body_schema: { type: 'object', description: 'Datele apelului', properties: { call_id: CALL_ID, ...properties }, required: ['call_id', ...required] },
    },
  })
  return [
    tool('get_recovery_context', 'Citește contextul aprobat al apelului: prenumele, produsele, cantitățile, totalul coșului, reducerea și starea emailului.'),
    tool('check_discount', 'Verifică dacă reducerea de recuperare mai este valabilă (procent, cod, expirare). Codul nu se cumulează cu promoțiile.'),
    tool('recovery_email_status', 'Verifică dacă emailul cu codul de reducere a fost acceptat pentru livrare. Folosește-l înainte să spui că persoana găsește codul pe email.'),
    tool('record_outcome', 'Înregistrează rezultatul conversației.', { outcome: { type: 'string', description: 'Una dintre: interested, more_info, human_follow_up, not_interested, opted_out' } }, ['outcome']),
    tool('request_human_follow_up', 'Cere ca un coleg să contacteze persoana.', { reason: { type: 'string', description: 'Pe scurt, de ce (fără date sensibile)' } }, ['reason']),
    tool('record_opt_out', 'Înregistrează imediat că persoana nu mai vrea să fie contactată (apeluri și emailuri comerciale).'),
  ]
}

export const SAMPLE_VARIABLES = {
  call_id: 'test',
  opening_line: openingLine({ firstName: 'Ana', cart: true, productNames: 'NEUROS Calm' }),
  customer_first_name: 'Ana',
  funnel_type: 'visible_price',
  abandonment_type: 'cos_nefinalizat',
  product_names: 'NEUROS Calm',
  product_quantities: '1 × NEUROS Calm',
  cart_total: '6.380 lei',
  recovery_discount_percent: 10,
  recovery_code: 'BTTEST01',
  recovery_expiration: '16 octombrie, ora 14:30',
  checkout_recovery_url: 'https://biohack-tech.ro/reluare/test',
  recovery_email_sent: 'da',
}

/** The create/update payload for the agent (voice and tool ids filled in by the setup script). */
export function agentDefinition(siteUrl: string = site.url) {
  return {
    name: AGENT_NAME,
    tags: ['biohack-tech', 'recuperare-comenzi'],
    conversation_config: {
      agent: {
        language: 'ro',
        first_message: AGENT_FIRST_MESSAGE,
        prompt: {
          prompt: `${AGENT_INSTRUCTIONS}\n\n# Cunoștințe\n\n${agentKnowledge(siteUrl)}`,
          llm: 'gemini-2.5-flash',
          temperature: 0.4,
          tool_ids: ['${ELEVENLABS_TOOL_IDS}'],
          built_in_tools: {
            end_call: { name: 'end_call', description: 'Închide apelul după ce ai încheiat politicos, după un refuz, la mesageria vocală sau dacă nu este persoana căutată.', params: { system_tool_type: 'end_call' } },
          },
        },
        dynamic_variables: { dynamic_variable_placeholders: SAMPLE_VARIABLES },
      },
      // Romanian needs a multilingual model; the voice is the one selected in ElevenLabs (ELEVENLABS_VOICE_ID).
      tts: { model_id: 'eleven_flash_v2_5', voice_id: '${ELEVENLABS_VOICE_ID}' },
      turn: { turn_timeout: 7 },
      conversation: { max_duration_seconds: 240 },
    },
    platform_settings: {
      data_collection: dataCollection(),
      // No audio is kept; conversation data is deleted by ElevenLabs after 30 days (privacy policy).
      privacy: { record_voice: false, retention_days: 30 },
    },
  }
}
