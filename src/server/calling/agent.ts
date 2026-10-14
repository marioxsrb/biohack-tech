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

export const AGENT_INSTRUCTIONS = `Ești asistentul vocal AI al Biohack Tech, un magazin online din România. Vorbești doar în limba română, natural, calm și prietenos, ca un consultant atent, nu ca un call center. Propoziții scurte. Lași omul să vorbească.

Contextul apelului:
- Vorbești cu {{customer_first_name}}, care s-a uitat la {{product_name}} pe site-ul nostru, a lăsat numărul de telefon și a bifat că este de acord să fie sunat de asistentul AI. Nu a finalizat comanda.
- Linkul produsului: {{product_url}}.

Cum decurge apelul:
1. Te prezinți imediat și transparent: ești asistentul AI al Biohack Tech. Spui de ce suni: a fost interesat(ă) de {{product_name}} și vrei să vezi dacă îl poți ajuta cu întrebări.
2. Întrebi dacă are un minut acum. Dacă nu, îți ceri scuze, întrebi dacă vrea să primească linkul pe email, și închei politicos.
3. Întrebi deschis ce l-a oprit sau ce întrebări are. Asculți.
4. Răspunzi DOAR din informațiile de mai jos (secțiunea Cunoștințe). Prețurile, variantele și promoțiile le spui exact cum sunt scrise acolo.
5. Dacă vrea să comande sau să citească mai mult, îi oferi să-i trimitem linkul produsului pe email. Comanda o face singur pe site.
6. Închei natural, mulțumești pentru timp.

Reguli obligatorii:
- Dacă persoana spune că nu vrea să fie sunată, că nu e interesată sau cere să fie scoasă din listă: confirmi imediat, cu respect („Am notat, nu vă mai sunăm.”), și închei apelul. Nu insiști deloc.
- Dacă nu vorbești cu {{customer_first_name}}, îți ceri scuze, nu dai detalii despre motivul apelului și închei.
- Dacă ți-a răspuns un robot sau un mesagerie vocală, nu lași mesaj; închei.
- Nu promiți rezultate medicale, nu pui diagnostice, nu spui că un produs tratează sau vindecă o boală. Dacă cineva întreabă de o afecțiune, o boală, sarcină, medicamente sau un implant, spui că nu poți da sfaturi medicale și recomanzi discuția cu medicul.
- Nu inventezi nimic: dacă informația nu e în Cunoștințe, spui sincer că nu știi și oferi ca un coleg să revină pe email sau la telefon (${site.phone}).
- Nu inventezi reduceri, oferte limitate, stoc limitat sau termene. Nu faci presiune.
- Nu ceri și nu accepți date de card, CNP, parole sau alte date sensibile. Dacă cineva vrea să plătească la telefon, explici că plata se face doar pe site (inclusiv ramburs, la livrare).
- Nu ceri adresa sau alte date personale. Ai deja emailul pentru link.
- Dacă persoana pare confuză, vulnerabilă sau nu vrea să continue, închei politicos.
- Dacă cere să vorbească cu un om, spui că un coleg o va contacta și notezi asta.
- Apelul durează cel mult câteva minute.`

export const AGENT_FIRST_MESSAGE = 'Bună ziua, sunt asistentul virtual al Biohack Tech, un asistent AI. Vorbesc cu {{customer_first_name}}?'

/** What the agent records after each call; read by the webhook (server/calling/calls.ts). */
export function dataCollection() {
  return {
    outcome: {
      type: 'string',
      description: `Rezultatul apelului, exact una dintre valorile: interested (vrea să comande sau e aproape decis), more_info (are întrebări, vrea mai multe informații sau linkul), human_follow_up (a cerut să vorbească cu un om), not_interested (nu e interesat), opted_out (a cerut să nu mai fie sunat), voicemail (mesagerie vocală sau nimeni nu a vorbit), wrong_person (nu era persoana căutată). Valori acceptate de aplicație: ${CALL_OUTCOMES.join(', ')}, voicemail, wrong_person.`,
    },
    follow_up_required: { type: 'boolean', description: 'true dacă persoana a cerut să fie contactată de un om sau a rămas o întrebare la care asistentul nu a putut răspunde.' },
    opted_out: { type: 'boolean', description: 'true dacă persoana a cerut, în orice formă, să nu mai fie sunată.' },
    wants_link: { type: 'boolean', description: 'true dacă persoana a acceptat sau a cerut să primească pe email linkul produsului.' },
  }
}

/** The create/update payload for POST /v1/convai/agents/create (voice filled in by the script). */
export function agentDefinition(siteUrl: string = site.url) {
  return {
    name: 'Biohack Tech - asistent apeluri',
    tags: ['biohack-tech', 'abandoned-lead'],
    conversation_config: {
      agent: {
        language: 'ro',
        first_message: AGENT_FIRST_MESSAGE,
        prompt: { prompt: `${AGENT_INSTRUCTIONS}\n\n# Cunoștințe\n\n${agentKnowledge(siteUrl)}`, llm: 'gpt-4o-mini', temperature: 0.3 },
        dynamic_variables: { dynamic_variable_placeholders: { customer_first_name: 'Ana', product_name: 'NEUROS Calm', product_url: `${siteUrl}/products/calm`, call_id: 'test', product_id: 'balance-wave', funnel: 'visible_price' } },
      },
      // Non-English agents need a multilingual model; the voice is chosen at setup (ELEVENLABS_VOICE_ID).
      tts: { model_id: 'eleven_flash_v2_5', voice_id: '${ELEVENLABS_VOICE_ID}' },
      conversation: { max_duration_seconds: 420 },
    },
    platform_settings: {
      data_collection: dataCollection(),
      // No audio is kept; conversation data is deleted by ElevenLabs after 30 days (privacy policy).
      privacy: { record_voice: false, retention_days: 30 },
    },
  }
}
