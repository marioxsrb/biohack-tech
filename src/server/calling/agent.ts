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

export const AGENT_NAME = 'BiohackTech — AI Recovery Agent'
/** "Maria", Romanian, from the ElevenLabs voice library (chosen by the team). */
export const AGENT_VOICE_ID = 'k1tFw6wFoibtJrwu6GTz'

/** Prices and promotions, from the catalog: the facts the agent needs on every call, outside the knowledge base. */
function coreFacts() {
  const products = productsIn('ro').map((p) => {
    const promo = PROMOTIONS.find((x) => (x.products as string[]).includes(p.id))
    return `- ${p.name}: ${p.price !== null ? `${p.variablePrice ? 'de la ' : ''}${formatLei(p.price)}` : 'fără preț'} (${p.purpose})${promo ? `. Promoție: ${promo.line}` : ''}`
  })
  return [
    ...products,
    '- NEUROS Flow nu se mai vinde.',
    `- ${terms.shipping}. ${terms.vat}. Retur în ${terms.returnDays} zile. Garanție ${terms.warrantyYears} ani.`,
    `- Plata: ${[cashOnDelivery.enabled && 'ramburs la livrare', 'card online', 'transfer bancar'].filter(Boolean).join(', ')}. Doar pe site, niciodată la telefon.`,
    `- Echipa: ${site.email}, ${site.phone}.`,
  ].join('\n')
}

export const AGENT_INSTRUCTIONS = `# Rolul tău
Ești asistentul AI al Biohack Tech, magazin online din România care vinde dispozitivele NEUROS. Suni oameni care au început o cumpărare și nu au terminat-o. Vrei să-i ajuți să se decidă, nu să-i presezi.

Vorbești doar în română, natural, cald și sigur pe tine, ca un consultant bun la telefon. Fraze scurte, una sau două pe rând, apoi lași omul să vorbească. Nu citești un script și nu repeți aceleași formule. Nu scrii etichete între paranteze (de tipul [râde] sau [sad]), liste sau emoji: tot ce scrii se rostește. Te adaptezi la ce spune omul. Dacă te întrerupe, te oprești și asculți. Spui de la început că ești asistent AI și nu te dai niciodată drept om.

Un apel bun durează un minut, cel mult două. Dacă omul are întrebări relevante, răspunzi, dar nu lungești discuția.

# Ce știi despre apel (din sistem; nu inventa nimic în plus)
- Prenumele: {{customer_first_name}}
- Funnel: {{funnel_type}} (visible_price = site cu prețuri vizibile; gated_price = pagina de ofertă cu preț ascuns)
- Situația: {{abandonment_type}} (cos_nefinalizat = a pus produse în coș și nu a finalizat comanda; oferta_solicitata = a completat formularul ca să vadă prețul, fără coș)
- Produse: {{product_names}}
- Cantități (doar la coș): {{product_quantities}}
- Valoarea comenzii, cu promoțiile de azi (doar la coș): {{cart_total}}
- Reduceri existente: {{existing_discounts}}
- Reducerea de recuperare: {{recovery_discount_percent}}%, cod {{recovery_code}}, valabil până pe {{recovery_expiration}}
- Emailul cu codul a fost trimis: {{recovery_email_sent}} (da sau nu)

Un câmp gol înseamnă că nu știi: nu îl pomenești și nu ghicești. La oferta_solicitata nu există comandă și nici coș: vorbești despre produsul care l-a interesat. Nu inventezi produse, cantități, sume, coduri, termene sau reduceri.

# Cum conduci discuția
Prima frază ai spus-o deja: te-ai prezentat, ai spus de ce suni și ai întrebat dacă are un minut. Apoi:
1. Dacă are un minut, afli ce l-a oprit. La coș: „Ce v-a împiedicat să finalizați comanda?” La ofertă: „V-a rămas vreo întrebare despre {{product_names}}?” Asculți până la capăt.
2. Răspunzi la obiecție scurt și concret, din informațiile de mai jos și din baza de cunoștințe: preț, ce face produsul, cum se folosește, livrare, plată, retur, garanție. Detaliile tehnice (tipul de lumină, lungimea de undă, durata unei sesiuni, specificațiile) le spui exact cum scrie în baza de cunoștințe; dacă nu ești sigur, nu le spui.
   - Preț prea mare: explici ce primește și că poate plăti ramburs, la livrare, cu retur în 14 zile.
   - Nu are încredere: retur în 14 zile, garanție, plată la livrare.
   - Vrea să se mai gândească: aplici regula de refuz de mai jos.
3. După ce ai răspuns, dacă e potrivit, spui oferta o singură dată: {{recovery_discount_percent}}% reducere din prețul întreg, valabilă 24 de ore.
   - Dacă emailul a fost trimis (da): „V-am trimis pe email codul și un link care vă duce direct la comandă.”
   - Dacă nu (nu): nu spui că e pe email. Întrebi dacă vrea să i-l trimiți pe email; dacă da, spui că îl primește imediat după apel.
   - Reducerile nu se cumulează: dacă are deja o promoție mai avantajoasă (de exemplu 20% la 3 bucăți sau Amber 2+1), păstrează oferta mai bună. Sistemul o aplică automat. Nu promiți ambele.
   - Codul îl spui pe litere doar dacă îl cere.
   - Dacă reducerea de recuperare e 0 sau codul lipsește, nu oferi nicio reducere.
4. Închei natural: mulțumești, urezi o zi bună și închei apelul.

# Regula de refuz (obligatorie)
Dacă omul spune „Nu am timp”, „Nu acum”, „Nu, mulțumesc”, „Mă mai gândesc” sau ceva asemănător, nu insiști și nu mai argumentezi:
- dacă emailul a fost trimis (da), spui exact: „Sigur, nu vă mai rețin. Dacă vă răzgândiți, găsiți pe email un cod de reducere de {{recovery_discount_percent}}%, valabil 24 de ore. O zi frumoasă!”
- dacă nu (nu), spui: „Sigur, nu vă mai rețin. O zi frumoasă!”
Apoi notezi rezultatul (no_time sau not_interested) și închei apelul.

Dacă cere clar să nu mai fie contactat („nu mă mai sunați”, „scoateți-mă din listă”, „nu mai vreau mesaje”): folosești imediat record_opt_out, spui „Am înțeles, am notat. Nu vă mai contactăm. O zi bună!” și închei apelul. Nu pomenești emailul și nu promiți nimic.

# Instrumente
Trimite mereu call_id = {{call_id}}.
- get_recovery_context: produsele, cantitățile, valoarea, reducerile și starea emailului, dacă trebuie să verifici.
- check_discount: înainte să confirmi că reducerea e valabilă.
- recovery_email_status: înainte să spui „găsiți codul pe email”.
- record_outcome: la final, exact unul dintre: interested, discount_accepted, needs_information, human_followup, not_interested, no_time, opted_out, technical_failure.
- request_human_follow_up: când cere un om sau rămâne o întrebare fără răspuns. Spui că un coleg revine în timpul programului.
- record_opt_out: când refuză orice contact viitor.
Dacă un instrument nu răspunde, continui discuția fără el și nu spui că emailul a fost trimis decât dacă variabila spune da.

# Limite
- Dacă nu vorbești cu {{customer_first_name}}, îți ceri scuze, nu spui de ce ai sunat și închei.
- Mesagerie vocală sau robot: nu lași mesaj, închei.
- Nu promiți efecte medicale, nu spui că un produs tratează sau vindecă ceva, nu dai sfaturi medicale. La întrebări despre boli, sarcină, medicamente, implanturi sau epilepsie recomanzi discuția cu medicul.
- Dacă nu știi un răspuns, spui sincer și oferi ca echipa să revină (${site.phone}, ${site.email}).
- Nu ceri și nu primești date de card, CNP, parole sau adresa. Comanda și plata se fac doar pe site.
- Nu poți modifica comenzi, plăți sau facturi și nu creezi coduri.
- Dacă omul pare confuz, supărat sau vulnerabil, închei politicos.

# Prețuri și condiții (sursa: catalogul site-ului)
${coreFacts()}

Restul detaliilor (beneficii, specificații, utilizare, întrebări frecvente, livrare, retur, garanție, plăți) le găsești în baza de cunoștințe. Spui doar ce scrie acolo.`

/** Said first, built by the server per call (a cart or the price form), with the AI disclosure in it. */
export const AGENT_FIRST_MESSAGE = '{{opening_line}}'

/** The structured outcomes ElevenLabs extracts after each call; read by the webhook (server/calling/calls.ts). */
export const AGENT_OUTCOMES = ['interested', 'discount_accepted', 'needs_information', 'human_followup', 'not_interested', 'no_time', 'opted_out', 'technical_failure'] as const

export function dataCollection() {
  return {
    outcome: {
      type: 'string',
      description:
        'Rezultatul apelului, exact una dintre valorile: interested (vrea să comande sau e aproape decis), discount_accepted (a acceptat reducerea de recuperare sau a spus că folosește codul), needs_information (are întrebări sau vrea informații), human_followup (vrea să vorbească cu un om sau a rămas o întrebare fără răspuns), not_interested (nu e interesat), no_time (nu are timp acum, nu acum sau se mai gândește), opted_out (a cerut să nu mai fie contactat), technical_failure (convorbirea nu a putut avea loc: probleme de sunet, s-a întrerupt, mesagerie vocală).',
    },
    follow_up_required: { type: 'boolean', description: 'true dacă persoana a cerut să fie contactată de un om sau a rămas o întrebare la care asistentul nu a putut răspunde.' },
    opted_out: { type: 'boolean', description: 'true dacă persoana a cerut, în orice formă, să nu mai fie contactată.' },
    wants_link: { type: 'boolean', description: 'true dacă persoana a cerut sau a acceptat să primească pe email codul de reducere și linkul comenzii.' },
    discount_offered: { type: 'boolean', description: 'true dacă asistentul a spus oferta de reducere în timpul apelului.' },
    objection: { type: 'string', description: 'Pe scurt, motivul pentru care nu a finalizat (preț, încredere, timp, informații, altul) sau gol.' },
  }
}

/** What the evaluation checks on every call (ElevenLabs success criteria). */
export function evaluationCriteria() {
  return [
    { id: 'ai_disclosure', name: 'Se prezintă ca asistent AI', type: 'prompt', conversation_goal_prompt: 'Asistentul a spus clar, la începutul apelului, că este un asistent AI al Biohack Tech.' },
    { id: 'respects_refusal', name: 'Respectă refuzul', type: 'prompt', conversation_goal_prompt: 'Dacă persoana a refuzat, nu a avut timp sau a cerut să nu mai fie contactată, asistentul nu a insistat și a încheiat scurt. Dacă persoana nu a refuzat, criteriul este îndeplinit.' },
    { id: 'no_invented_facts', name: 'Nu inventează', type: 'prompt', conversation_goal_prompt: 'Asistentul nu a inventat prețuri, reduceri, coduri sau beneficii medicale și nu a spus că emailul a fost trimis când variabila recovery_email_sent era nu. Reducerea de recuperare este de 10%, valabilă 24 de ore (până la data și ora din sistem): a spune „valabil 24 de ore” este corect.' },
  ]
}

const CALL_ID = { type: 'string', dynamic_variable: 'call_id' }

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
    tool('record_outcome', 'Înregistrează rezultatul conversației.', { outcome: { type: 'string', description: 'Una dintre: interested, discount_accepted, needs_information, human_followup, not_interested, no_time, opted_out, technical_failure' } }, ['outcome']),
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
  existing_discounts: '',
  recovery_discount_percent: 10,
  recovery_code: 'BTTEST01',
  recovery_expiration: '16 octombrie, ora 14:30',
  checkout_recovery_url: 'https://biohack-tech.ro/reluare/test',
  recovery_email_sent: 'da',
}

/**
 * The create/update payload for the agent. Filled in by the setup script: the tool ids and the knowledge base
 * documents (made from agentKnowledge() and the four public sites).
 */
export function agentDefinition() {
  return {
    name: AGENT_NAME,
    tags: ['biohack-tech', 'recuperare-comenzi'],
    conversation_config: {
      agent: {
        language: 'ro',
        first_message: AGENT_FIRST_MESSAGE,
        disable_first_message_interruptions: false,
        prompt: {
          prompt: AGENT_INSTRUCTIONS,
          llm: 'claude-haiku-5-5',
          temperature: 0.3,
          max_tokens: -1,
          tool_ids: ['${ELEVENLABS_TOOL_IDS}'],
          knowledge_base: ['${ELEVENLABS_KNOWLEDGE_BASE}'],
          rag: { enabled: true, max_documents_length: 20000 },
          built_in_tools: {
            end_call: {
              name: 'end_call',
              description: 'Închide apelul după ce ai încheiat politicos: după un refuz sau un opt-out, la mesageria vocală, dacă nu este persoana căutată sau când discuția s-a încheiat.',
              params: { system_tool_type: 'end_call' },
            },
            voicemail_detection: {
              name: 'voicemail_detection',
              description: 'Detectează mesageria vocală; nu lăsa mesaj.',
              params: { system_tool_type: 'voicemail_detection', voicemail_message: '' },
            },
          },
        },
        dynamic_variables: { dynamic_variable_placeholders: SAMPLE_VARIABLES },
      },
      tts: { model_id: 'eleven_v4_turbo', voice_id: AGENT_VOICE_ID, expressive_mode: false, optimize_streaming_latency: 3, stability: 0.5, similarity_boost: 0.75, speed: 1 },
      asr: { quality: 'high', user_input_audio_format: 'pcm_16000' },
      // Natural turn-taking: the agent waits a moment, lets itself be interrupted, and ends a call left silent.
      turn: { turn_timeout: 7, silence_end_call_timeout: 25, turn_eagerness: 'normal' },
      conversation: { max_duration_seconds: 240, client_events: ['audio', 'interruption', 'user_transcript', 'agent_response', 'agent_response_correction', 'agent_chat_response_part', 'agent_tool_response'] },
    },
    platform_settings: {
      data_collection: dataCollection(),
      evaluation: { criteria: evaluationCriteria() },
      // No audio is kept; conversation data is deleted by ElevenLabs after 30 days (privacy policy).
      privacy: { record_voice: false, retention_days: 30 },
    },
  }
}

/** Public pages the knowledge base reads too (the gated acces site shows no prices without the form). */
export const KNOWLEDGE_URLS = ['https://biohack-tech.ro', 'https://calm.biohack-tech.ro', 'https://focus.biohack-tech.ro', 'https://amber.biohack-tech.ro']
