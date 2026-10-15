/**
 * The shop's legal pages. They state only facts about how this site works and what the law provides;
 * nothing is invented (no return-cost policy, no delivery promises beyond the stated terms, no
 * commercial guarantee). Company identification comes from src/config/company.ts and is shown only
 * when set. Points that still need a decision or a lawyer are listed in docs/OPEN-POINTS.md.
 *
 * Text blocks: a paragraph (links as [text](/path)), a list, or a table.
 */
import { company, companyLine } from '@/config/company'
import { site, terms } from '@/config/site'
import { COMMUNICATIONS_CONSENT_TEXT } from '@/lib/consent/communications'
import { CONSENT_MAX_AGE_DAYS } from '@/lib/consent/cookies'
import { configuredVendors } from '@/lib/consent/vendors'

export type LegalBlock = string | { list: string[] } | { table: { head: string[]; rows: string[][] } }
export type LegalSection = { heading: string; id?: string; body: LegalBlock[] }
export type LegalPage = { slug: string; title: string; shortTitle: string; description: string; updated: string; sections: LegalSection[] }

const UPDATED = '14 octombrie 2026'
const contactLine = `Scrie-ne la ${site.email} sau sună la ${site.phone}. Răspundem ${terms.responseTime}.`

const identity = (): LegalSection => ({
  heading: 'Cine suntem',
  body: [
    company.legalName
      ? `Site-ul ${site.url.replace(/^https?:\/\//, '')} este operat de ${companyLine()}.`
      : `Site-ul ${site.url.replace(/^https?:\/\//, '')} este magazinul online Biohack Tech.`,
    ...(company.returnAddress ? [`Adresa pentru retururi: ${company.returnAddress}.`] : []),
    `Contact: ${site.email}, ${site.phone}.`,
  ],
})

const contact: LegalSection = { heading: 'Contact', body: [contactLine] }

/** Optional tools actually configured, for the cookie table. */
function optionalRows(): string[][] {
  const rows: Record<string, string[][]> = {
    ga4: [
      ['_ga, _ga_*', 'Google Analytics 4', 'Analiză', 'Deosebește vizitele pentru statistici', '2 ani'],
    ],
    clarity: [
      ['_clck', 'Microsoft Clarity', 'Analiză', 'Recunoaște browserul între vizite', '1 an'],
      ['_clsk', 'Microsoft Clarity', 'Analiză', 'Leagă paginile unei vizite', '1 zi'],
    ],
    meta: [
      ['_fbp', 'Meta Pixel', 'Marketing', 'Măsoară reclamele Biohack Tech', '3 luni'],
      ['_fbc', 'Meta Pixel', 'Marketing', 'Reține clicul pe o reclamă', '3 luni'],
    ],
  }
  return configuredVendors().flatMap((v) => rows[v.id] ?? [])
}

export const legalPages: LegalPage[] = [
  {
    slug: 'terms-of-service',
    title: 'Termeni și condiții',
    shortTitle: 'Termeni și condiții',
    description: 'Termenii și condițiile magazinului Biohack Tech: cum comanzi, prețuri, plată, livrare, retragere, garanție și reclamații.',
    updated: UPDATED,
    sections: [
      identity(),
      {
        heading: 'Cum comanzi',
        body: [
          {
            list: [
              'Alegi produsele și le pui în coș. În coș poți schimba cantitatea sau poți scoate produse.',
              'La finalizarea comenzii completezi datele de contact, facturare și livrare și alegi metoda de plată.',
              'Înainte de a trimite comanda vezi produsele, prețul fiecăruia, livrarea și totalul. Poți corecta orice câmp.',
              'Bifezi acordul cu acești termeni (obligatoriu) și, dacă vrei, acordul pentru comunicări (opțional), apoi trimiți comanda cu butonul de plată sau „Comandă cu obligație de plată”.',
              'Primești pe email confirmarea comenzii.',
            ],
          },
          'Poți comanda ca persoană fizică sau ca firmă. Contractul se încheie în limba română.',
        ],
      },
      {
        heading: 'Când se încheie contractul',
        body: [
          'La plata cu cardul, contractul se încheie când plata este confirmată și îți trimitem confirmarea pe email.',
          'La transfer bancar, contractul se încheie când îți trimitem pe email confirmarea comenzii cu datele pentru plată. Pregătim coletul după ce suma ajunge în cont.',
          'La plata ramburs (la livrare), contractul se încheie când îți trimitem pe email confirmarea comenzii. Plătești suma totală curierului, când primești coletul.',
          'Păstrăm comanda în evidențele noastre. O copie o ai în emailul de confirmare și pe pagina comenzii.',
        ],
      },
      {
        heading: 'Prețuri',
        body: [`Prețurile sunt în lei și includ TVA 21%. ${terms.shipping}. Totalul de plată apare înainte să trimiți comanda.`],
      },
      {
        heading: 'Plată, livrare, retragere și garanție',
        body: [
          'Detaliile sunt în paginile dedicate: [Plăți](/plati), [Livrare](/politica-livrare), [Retur și drept de retragere](/politica-retur), [Garanție și reclamații](/garantie).',
          'Poți renunța online la o comandă din pagina [Retragere din contract](/retragere).',
        ],
      },
      {
        heading: 'Despre produse',
        body: [
          'Produsele Biohack Tech sunt destinate stării generale de bine. Nu înlocuiesc sfatul medicului.',
          'Dacă ai o afecțiune sau urmezi un tratament, discută cu medicul înainte de utilizare. Rezultatele variază de la o persoană la alta.',
        ],
      },
      {
        heading: 'Comunicări comerciale',
        id: 'comunicari',
        body: [
          `Îți trimitem comunicări comerciale doar dacă bifezi, în formularul de preț sau la finalizarea comenzii, căsuța: „${COMMUNICATIONS_CONSENT_TEXT}” Bifa este opțională și nu este bifată dinainte. Fără ea vezi prețurile și comanzi la fel. Acceptarea acestor termeni nu înseamnă acord pentru comunicări.`,
          'Bifa acoperă două canale, pe care le înregistrăm separat (textul, data și pagina), pentru adresa de email și pentru numărul de telefon:',
          {
            list: [
              'Emailuri: noutăți, oferte și recomandări despre produsele Biohack Tech.',
              'Recuperarea comenzilor nefinalizate: dacă ai început o comandă sau ai cerut prețul și nu ai finalizat, îți putem trimite cel mult două emailuri de reamintire, cu linkul către produs sau coș. Ele se opresc imediat ce comanzi, te dezabonezi sau retragi acordul.',
              'Apeluri de la asistentul AI: te poate suna un asistent AI al Biohack Tech, un sistem automat, despre produsul ales, dacă nu ai finalizat comanda. Îți spune de la început că este un asistent AI. Sună doar la un număr românesc, în zilele lucrătoare, între orele 8 și 21, de cel mult trei ori pentru aceeași comandă nefinalizată (dacă nu răspunzi: o dată după o oră, apoi a doua zi). Nu înregistrăm apelul și nu îți cere date de card.',
            ],
          },
          'Poți retrage acordul oricând, gratuit: din linkul de dezabonare din fiecare email de marketing (oprește și apelurile), spunându-i asistentului în timpul apelului că nu mai vrei să fii sunat (oprește apelurile) sau scriindu-ne. După retragere nu te mai contactăm în scop comercial. Emailurile despre comenzi (confirmare, plată, factură, livrare, rambursare) vin în continuare, pentru că sunt necesare comenzii.',
          'Detalii despre cum folosim datele: [Politica de confidențialitate](/privacy-policy#marketing).',
        ],
      },
      {
        heading: 'Date personale',
        body: ['Folosim datele tale ca să procesăm, să facturăm și să livrăm comanda. Detaliile sunt în [Politica de confidențialitate](/privacy-policy) și în [Politica de cookies](/politica-cookies).'],
      },
      {
        heading: 'Reclamații și litigii',
        body: [
          `Pentru orice problemă, scrie-ne la ${site.email}. Căutăm împreună o soluție.`,
          'Dacă nu ajungem la o înțelegere, te poți adresa Autorității Naționale pentru Protecția Consumatorilor ([anpc.ro](https://anpc.ro)) sau poți depune o reclamație pentru soluționarea alternativă a litigiilor pe [reclamatiisal.anpc.ro](https://reclamatiisal.anpc.ro).',
          'Contractului i se aplică legea română.',
        ],
      },
      contact,
    ],
  },
  {
    slug: 'privacy-policy',
    title: 'Politica de confidențialitate',
    shortTitle: 'Confidențialitate',
    description: 'Ce date personale folosește Biohack Tech, de ce, cât timp, cu cine le împarte și ce drepturi ai.',
    updated: UPDATED,
    sections: [
      {
        heading: 'Cine răspunde de datele tale',
        body: [
          `${company.legalName ? companyLine() : 'Biohack Tech'} este operatorul datelor tale. Pentru orice întrebare despre date ne scrii la ${site.email}.`,
        ],
      },
      {
        heading: 'Ce date folosim și de ce',
        body: [
          {
            table: {
              head: ['Ce facem', 'Ce date', 'Temeiul'],
              rows: [
                ['Procesăm, livrăm și îți scriem despre comandă', 'Nume, email, telefon, adresă de livrare și facturare, produsele comandate, observații', 'Contractul (art. 6 alin. 1 lit. b GDPR)'],
                ['Facturăm și ținem evidența contabilă', 'Datele de facturare; pentru firme, denumirea, CUI și nr. Reg. Com.', 'Obligație legală (art. 6 alin. 1 lit. c)'],
                ['Încasăm plata și prevenim frauda', 'Rezultatul plății de la Stripe; la transfer, datele din extrasul de cont', 'Contractul și interesul legitim de a preveni frauda (lit. b și f)'],
                ['Îți arătăm prețul și oferta, pe acces.biohack-tech.ro, după formularul scurt', 'Nume, email, telefon, produsul ales, sursa vizitei (de ex. reclama din care ai venit)', 'Pași înaintea unui contract, la cererea ta (lit. b)'],
                ['Recunoaștem dispozitivul cu care ai completat formularul de preț, ca să nu ți-l cerem din nou (alt browser, fereastră privată, cookie șters); fără formular completat nu păstrăm nimic', 'Un cod derivat din caracteristici ale dispozitivului (ecran, fus orar, limbă, sistem) și din adresa de rețea, păstrat doar ca valoare criptografică; nu păstrăm adresa IP și nu îl folosim la altceva', 'Pași înaintea unui contract, la cererea ta (lit. b); strict necesar pentru serviciul cerut'],
                ['Păstrăm ce ai scris în pasul de contact al comenzii înainte să o trimiți, ca să știm câte comenzi rămân neterminate și să îți putem reface coșul', 'Nume, email, telefon, produsele din coș', 'Interesul nostru legitim de a înțelege și îmbunătăți comanda (lit. f)'],
                ['Îți trimitem noutăți, oferte, recomandări și un memento pentru o comandă sau o ofertă nefinalizată', 'Email, nume, produsele de care ai fost interesat', 'Consimțământul tău, dat prin bifă (lit. a)'],
                ['Te sună asistentul nostru AI despre produsul ales, dacă nu ai finalizat comanda', 'Telefon, prenume, produsul ales, rezultatul apelului', 'Consimțământul tău separat pentru apeluri, dat prin bifă (lit. a)'],
                ['Răspundem la întrebări, reclamații și cereri de retragere', 'Ce ne scrii și datele comenzii', 'Contractul și obligația legală'],
                ['Statistici și reclame, doar dacă accepți', 'Date despre folosirea site-ului, fără date de contact', 'Consimțământul tău (lit. a)'],
              ],
            },
          },
          'Fără datele de comandă nu putem procesa și livra comanda. Emailurile de marketing sunt opționale: comanda funcționează la fel și fără ele.',
          'Datele din formularul de preț nu sunt folosite pentru reclame și nu te sunăm pe baza lor. Un email de reamintire primești doar dacă ai bifat acordul pentru emailuri de marketing. Telefonul îl folosim doar pentru întrebări despre o comandă pe care o plasezi.',
          'Nu luăm decizii automate cu efecte juridice asupra ta.',
        ],
      },
      {
        heading: 'Emailuri de marketing',
        id: 'marketing',
        body: [
          `Îți trimitem emailuri de marketing doar dacă bifezi, la comandă sau în formularul de preț, căsuța opțională: „${COMMUNICATIONS_CONSENT_TEXT}” Condițiile sunt în [Termeni și condiții, Comunicări comerciale](/terms-of-service#comunicari). Acceptarea termenilor de vânzare nu înseamnă acord pentru marketing.`,
          'Păstrăm dovada acordului: textul pe care l-ai văzut, data și comanda sau formularul în care l-ai dat.',
          'Dacă nu finalizezi o comandă sau o ofertă și ai bifat acordul, îți putem trimite cel mult două emailuri de reamintire, fără reduceri inventate. Ele se opresc imediat ce comanzi, te dezabonezi sau retragi acordul.',
          'Te poți dezabona oricând din linkul din fiecare email de marketing sau scriindu-ne. Emailurile despre comenzi (confirmare, plată, factură, livrare, rambursare) vin în continuare, pentru că sunt necesare comenzii.',
        ],
      },
      {
        heading: 'Apeluri de la asistentul AI',
        id: 'apeluri',
        body: [
          `Te putem suna cu un asistent AI doar dacă bifezi căsuța care numește explicit apelurile: „${COMMUNICATIONS_CONSENT_TEXT}” Bifa este opțională și nu este necesară pentru a vedea prețul sau pentru a comanda. Acordul pentru apeluri este înregistrat separat, pentru numărul tău de telefon. Un acord mai vechi, dat doar pentru emailuri, nu înseamnă acord pentru apeluri.`,
          'Asistentul îți spune de la început că este un asistent AI al Biohack Tech. Te sună doar la un număr românesc, în zilele lucrătoare, între orele 8 și 21, de cel mult trei ori pentru aceeași comandă nefinalizată (dacă nu răspunzi: o dată după o oră, apoi a doua zi). Nu îți cere date de card și nu face recomandări medicale.',
          'Nu înregistrăm apelul. Păstrăm doar data, durata și rezultatul (de exemplu „vrea mai multe informații” sau „nu mai dorește apeluri”), legate de solicitarea ta. Dacă ceri, îți trimitem pe email linkul către produs.',
          'Poți refuza oricând: spune-i asistentului că nu mai vrei să fii sunat, dezabonează-te din orice email sau scrie-ne. Nu te mai sunăm după ce comanzi.',
        ],
      },
      {
        heading: 'Cine mai primește datele',
        body: [
          'Fiecare furnizor primește doar datele necesare pentru rolul lui:',
          {
            list: [
              'Stripe: plata cu cardul. Datele cardului merg direct la Stripe; noi nu le vedem. După o plată cu cardul, Stripe păstrează cardul asociat comenzii cel mult 30 de minute, pentru oferta opțională de după plată; se încasează doar dacă o accepți explicit. Apoi cardul este dezasociat.',
              'FGO: emiterea facturilor.',
              'GoHighLevel (platforma LeadConnector): evidența clienților și trimiterea emailurilor.',
              'ElevenLabs (vocea și conversația asistentului AI) și Twilio (rețeaua telefonică), doar dacă ai acceptat apelurile. Datele conversației sunt păstrate de furnizor cel mult 30 de zile.',
              'Firma de curierat: livrarea coletului.',
              'Furnizorul de găzduire al site-ului și al bazei de date.',
              'Autorități, doar când legea ne obligă.',
            ],
          },
          'Stripe, GoHighLevel, ElevenLabs și Twilio pot prelucra date și în afara Spațiului Economic European. În acest caz, transferul se face doar cu garanțiile cerute de GDPR (art. 44-46).',
        ],
      },
      {
        heading: 'Cât timp păstrăm datele',
        body: [
          {
            list: [
              'Comenzile și facturile: cât cer legile contabile și fiscale.',
              'Acordul pentru marketing și dezabonarea: cât timp primești emailuri și apoi cât ne pot fi cerute ca dovadă.',
              'Mesajele și cererile tale: cât durează rezolvarea și termenul în care ne pot fi cerute ca dovadă.',
              'Datele din formularul de preț și din pasul de contact al unei comenzi netrimise: cel mult 12 luni de la ultima ta activitate, apoi le ștergem automat. Dacă plasezi o comandă, rămân legate de comandă.',
              'Acordul pentru apeluri și refuzul lui: cât timp ne pot fi cerute ca dovadă. Rezultatele apelurilor: împreună cu solicitarea de care țin.',
            ],
          },
        ],
      },
      {
        heading: 'Ce stocăm în browserul tău',
        body: ['Coșul, formularul de comandă neterminat, alegerea privind cookie-urile și, pe acces.biohack-tech.ro, faptul că ai completat formularul de preț (inclusiv recunoașterea dispozitivului). Detaliile sunt în [Politica de cookies](/politica-cookies).'],
      },
      {
        heading: 'Drepturile tale',
        body: [
          'Poți cere acces la datele tale, corectarea sau ștergerea lor, restricționarea prelucrării și portabilitatea datelor. Te poți opune prelucrării bazate pe interes legitim și, oricând, marketingului direct.',
          'Îți poți retrage oricând consimțământul. Retragerea nu afectează ce s-a făcut înainte.',
          `Scrie-ne la ${site.email}. Îți răspundem în cel mult o lună.`,
          'Poți depune o plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal ([dataprotection.ro](https://www.dataprotection.ro)).',
        ],
      },
    ],
  },
  {
    slug: 'politica-cookies',
    title: 'Politica de cookies',
    shortTitle: 'Cookies',
    description: 'Ce stochează site-ul Biohack Tech în browserul tău, de ce și cum îți schimbi alegerea.',
    updated: UPDATED,
    sections: [
      {
        heading: 'Pe scurt',
        body: [
          'Site-ul folosește doar ce este necesar ca să meargă coșul, comanda și plata. Orice instrument de analiză sau marketing pornește doar după ce îl accepți.',
          'Îți schimbi alegerea oricând din „Setări cookies”, jos în orice pagină. Alegerea este valabilă 12 luni, apoi te întrebăm din nou.',
        ],
      },
      {
        heading: 'Necesare (mereu active)',
        body: [
          {
            table: {
              head: ['Nume', 'Tip', 'Rol', 'Durată'],
              rows: [
                ['biohack-cart-v1', 'Stocare locală', 'Ține minte produsele din coș', 'Până golești coșul'],
                ['biohack-checkout-draft', 'Stocare de sesiune', 'Păstrează ce ai completat în formularul de comandă', 'Până închizi fila'],
                ['bt-cart-cleared-*', 'Stocare locală', 'Ține minte că produsele unei comenzi au fost scoase din coș', 'Până ștergi datele site-ului'],
                ['bt-consent-v1', 'Stocare locală', 'Ține minte alegerea ta privind cookie-urile', `${Math.round(CONSENT_MAX_AGE_DAYS / 30)} luni`],
                ['bt_vid', 'Cookie (doar după un formular)', 'Un cod aleator care leagă formularul de preț sau pasul de contact de comanda plasată din același browser, ca să nu apară de două ori', '90 de zile'],
                ['bt_gate2', 'Cookie, pe acces.biohack-tech.ro', 'Ține minte că ai completat formularul de preț, ca să nu ți-l cerem din nou', '90 de zile'],
                ['bt-gate2', 'Stocare locală, pe acces.biohack-tech.ro', 'Aceeași informație, dacă cookie-ul se șterge', '90 de zile (verificat de server)'],
                ['bt-gate-checked', 'Stocare de sesiune', 'Verificăm o singură dată pe sesiune dacă dispozitivul a mai completat formularul', 'Până închizi fila'],
                ['Recunoașterea dispozitivului', 'Citirea unor caracteristici ale dispozitivului (ecran, fus orar, limbă, sistem)', 'Când deschizi acces.biohack-tech.ro fără cookie, verificăm o dată dacă dispozitivul a completat deja formularul de preț, ca să nu ți-l cerem din nou. Trimitem doar un cod criptografic, nu caracteristicile; dacă nu ai completat formularul, nu păstrăm nimic', '90 de zile'],
                ['bt-visit', 'Stocare de sesiune', 'Numără vizita o singură dată pe sesiune, pentru statisticile noastre agregate; nu trimite niciun identificator', 'Până închizi fila'],
                ['bt-interest-*', 'Stocare de sesiune', 'Ține minte produsele deja văzute în sesiunea curentă pe acces.biohack-tech.ro', 'Până închizi fila'],
                ['__stripe_mid, __stripe_sid', 'Cookie Stripe, doar pe pagina de plată', 'Securitatea plății și prevenirea fraudei', '1 an, respectiv 30 de minute'],
              ],
            },
          },
          'Stripe poate folosi și cookie-uri pe propriile domenii, în formularul de card. Detalii: [stripe.com/cookie-settings](https://stripe.com/cookie-settings).',
        ],
      },
      {
        heading: 'Analiză și marketing (doar cu acordul tău)',
        body: optionalRows().length
          ? [
              { table: { head: ['Nume', 'Serviciu', 'Categorie', 'Rol', 'Durată'], rows: optionalRows() } },
              'Când ai acceptat, reținem în browser și comenzile deja raportate (bt-purchase-*, bt-placed-*), ca să nu le numărăm de două ori.',
              'Aceste servicii nu primesc numele, emailul, telefonul sau adresa ta.',
            ]
          : ['În prezent nu folosim instrumente de analiză sau de marketing. Dacă le vom adăuga, apar aici și pornesc doar după ce le accepți.'],
      },
      {
        heading: 'Cum îți schimbi alegerea',
        body: [
          'Din „Setări cookies”, jos în pagină. Dacă retragi un acord, ștergem cookie-urile acelui serviciu de pe site și reîncărcăm pagina fără el.',
          'Poți șterge oricând cookie-urile și datele site-ului din setările browserului. Atunci coșul se golește și te întrebăm din nou.',
          'Emailurile de marketing au un acord separat, dat la comandă. Acordul pentru cookie-uri de marketing nu înseamnă acord pentru emailuri.',
        ],
      },
      {
        heading: 'Dovada alegerii',
        body: ['Când alegi, salvăm pe serverul nostru alegerea, data, versiunea acestei politici și un cod aleator din browserul tău. Nu salvăm adresa IP și nici alte date care te identifică.'],
      },
      contact,
    ],
  },
  {
    slug: 'politica-livrare',
    title: 'Politica de livrare',
    shortTitle: 'Livrare',
    description: 'Livrare gratuită în România prin curier: procesare în 1-3 zile, transport în 2-5 zile, număr AWB pe email.',
    updated: UPDATED,
    sections: [
      { heading: 'Unde livrăm', body: ['Livrăm în toată România, prin curier, la adresa din comandă.'] },
      {
        heading: 'Termene',
        body: [
          `Pregătim comanda în ${terms.processingDays} de la confirmarea plății. Transportul durează de obicei ${terms.transitDays}.`,
          'Când predăm coletul curierului, primești pe email numele firmei de curierat și numărul AWB.',
          'Dacă apare o întârziere, te anunțăm.',
        ],
      },
      { heading: 'Cost', body: [`${terms.shipping}. Prețurile includ TVA 21%.`] },
      {
        heading: 'La primire',
        body: ['Verifică coletul în fața curierului. Dacă este deteriorat, notează asta în documentul curierului și scrie-ne.'],
      },
      contact,
    ],
  },
  {
    slug: 'politica-retur',
    title: 'Retur și drept de retragere',
    shortTitle: 'Retur și retragere',
    description: 'Dreptul de retragere în 14 zile pentru persoane fizice: cum renunți la comandă, cum trimiți produsele, cum primești banii.',
    updated: UPDATED,
    sections: [
      {
        heading: 'Dreptul de retragere',
        body: [
          `Dacă ai cumpărat ca persoană fizică, poți renunța la comandă în ${terms.returnDays} zile de la ziua în care tu, sau cineva desemnat de tine, primiți produsele. Nu trebuie să ne spui motivul.`,
          'Dacă ai comandat mai multe produse livrate separat, termenul curge de la primirea ultimului produs.',
        ],
      },
      {
        heading: 'Cum renunți',
        body: [
          'Cel mai simplu: pagina [Retragere din contract](/retragere). Primești pe email confirmarea, cu data și ora.',
          `Poți trimite și formularul de mai jos sau orice declarație clară la ${site.email}. E suficient să ne trimiți declarația înainte să expire cele ${terms.returnDays} zile.`,
        ],
      },
      {
        heading: 'Cum trimiți produsele',
        body: [
          `Trimite-ne produsele în cel mult ${terms.returnDays} zile de la cererea de retragere.${company.returnAddress ? ` Adresa de retur: ${company.returnAddress}.` : ' Îți scriem adresa de retur și pașii după ce primim cererea.'}`,
          'Poți verifica produsul cum ai face-o într-un magazin. Dacă produsul a fost folosit mai mult decât atât, poți răspunde pentru diminuarea valorii lui.',
        ],
      },
      {
        heading: 'Cum primești banii',
        body: [
          `Îți returnăm toate sumele plătite, inclusiv livrarea standard, în cel mult ${terms.returnDays} zile de la data la care ne-ai anunțat retragerea.`,
          'Folosim aceeași metodă de plată: pe card pentru plata cu cardul, în cont pentru transfer. Pentru plata ramburs, prin transfer bancar, în contul pe care ni-l indici.',
          'Putem amâna rambursarea până primim produsele sau dovada că le-ai trimis.',
        ],
      },
      {
        heading: 'Formular de retragere',
        id: 'formular',
        body: [
          'Completează și trimite acest formular doar dacă vrei să renunți la contract:',
          {
            list: [
              `Către: ${company.legalName ? `${company.legalName}${company.returnAddress || company.address ? `, ${company.returnAddress ?? company.address}` : ''}` : 'Biohack Tech'}, ${site.email}`,
              'Vă informez prin prezenta cu privire la retragerea mea din contractul referitor la vânzarea următoarelor produse: ...',
              'Comandate la data ... / primite la data ...',
              'Numărul comenzii: ...',
              'Numele consumatorului: ...',
              'Adresa consumatorului: ...',
              'Semnătura consumatorului (doar dacă formularul este trimis pe hârtie)',
              'Data: ...',
            ],
          },
        ],
      },
      {
        heading: 'Produse defecte',
        body: ['Retragerea este separată de garanție. Dacă un produs nu funcționează corect, vezi [Garanție și reclamații](/garantie).'],
      },
      contact,
    ],
  },
  {
    slug: 'garantie',
    title: 'Garanție și reclamații',
    shortTitle: 'Garanție',
    description: 'Garanția legală de conformitate de 2 ani pentru produsele Biohack Tech și cum depui o reclamație.',
    updated: UPDATED,
    sections: [
      {
        heading: 'Garanția legală de conformitate',
        body: [
          `Răspundem pentru orice lipsă de conformitate a produsului care apare în ${terms.warrantyYears} ani de la livrare. Aceasta este garanția legală, prevăzută de OUG 140/2021.`,
          'Dacă problema apare în primul an de la livrare, se presupune că exista la livrare. Nu trebuie să dovedești tu asta.',
          'Ai dreptul ca produsul să fie reparat sau înlocuit gratuit, într-un termen rezonabil de cel mult 15 zile de la data la care ni l-ai adus sau trimis. Dacă asta nu e posibil, ai dreptul la o reducere de preț sau la încetarea contractului.',
          'Garanția legală se aplică la cumpărarea ca persoană fizică.',
        ],
      },
      {
        heading: 'Cum depui o reclamație',
        body: [
          `Scrie-ne la ${site.email} sau sună la ${site.phone}. Spune-ne numărul comenzii, produsul și ce nu funcționează. Ajută și o fotografie sau un video scurt.`,
          'Îți spunem pașii pentru trimiterea produsului și te ținem la curent până la rezolvare.',
        ],
      },
      {
        heading: 'Dacă nu ajungem la o soluție',
        body: [
          'Te poți adresa Autorității Naționale pentru Protecția Consumatorilor ([anpc.ro](https://anpc.ro)).',
          'Poți depune și o reclamație pentru soluționarea alternativă a litigiilor pe [reclamatiisal.anpc.ro](https://reclamatiisal.anpc.ro).',
        ],
      },
      contact,
    ],
  },
  {
    slug: 'plati',
    title: 'Plăți',
    shortTitle: 'Plăți',
    description: 'Cum plătești la Biohack Tech: ramburs la livrare, card bancar prin Stripe sau transfer bancar. Prețuri în lei, cu TVA inclus.',
    updated: UPDATED,
    sections: [
      {
        heading: 'Card bancar',
        body: [
          'Plătești online, prin Stripe, procesatorul nostru de plăți. Datele cardului merg direct la Stripe. Noi nu le vedem și nu le păstrăm.',
          'Banca ta poate cere o confirmare suplimentară (3-D Secure), în aplicația băncii sau prin SMS.',
          'Comanda este confirmată când Stripe confirmă plata. Dacă plata nu reușește, nu ți se retrage nimic și poți încerca din nou.',
          'După o plată cu cardul îți putem propune, o singură dată, un produs opțional. Se plătește cu același card doar dacă apeși „Adaugă la comandă” și confirmi suma. Devine o comandă separată, cu factură separată; prima comandă rămâne plătită și confirmată oricum. Dacă banca cere confirmarea, se deschide pasul de verificare al băncii.',
        ],
      },
      {
        heading: 'Ramburs (plata la livrare)',
        body: [
          'Plătești curierului suma totală a comenzii, când primești coletul. Nu plătești nimic online.',
          'Comanda se confirmă imediat, pe email. Pregătim coletul și ți-l trimitem ca pe orice comandă. Suma de plată apare în email și pe pagina comenzii.',
          'Reducerile de pachet se aplică la fel, în totalul comenzii.',
        ],
      },
      {
        heading: 'Transfer bancar',
        body: [
          'După comandă primești datele pentru plată pe pagina comenzii și pe email: beneficiarul, IBAN-ul, banca și suma exactă.',
          'Scrie numărul comenzii la detaliile plății. Așa potrivim transferul cu comanda.',
          'Pregătim coletul după ce suma ajunge în cont. Îți scriem când primim plata.',
        ],
      },
      {
        heading: 'Promoții',
        body: [
          'La NEUROS Calm și NEUROS Focus, reducerea se calculează separat pentru fiecare produs. Când comanda are 2 bucăți din același produs primești 10% reducere la acele bucăți, iar de la 3 bucăți primești 20%. Bucățile din produse diferite nu se adună, iar reducerea nu se aplică restului comenzii. Pentru un produs, cele două reduceri nu se cumulează: se aplică doar cea mai mare atinsă. La NEUROS Amber, din fiecare 3 perechi din aceeași comandă, una este gratuită (cea mai ieftină, dacă prețurile diferă). NEUROS Amber nu intră în această reducere și nu primește 10% sau 20%. Reducerile se calculează automat în coș, pe prețurile afișate, și apar separat în comandă și pe factură. Se aplică atât timp cât sunt afișate pe site.',
          'Promoțiile se aplică la fel indiferent de metoda de plată: card, ramburs sau transfer.',
        ],
      },
      {
        heading: 'Prețuri și factură',
        body: [
          'Prețurile sunt în lei și includ TVA 21%. Totalul de plată apare înainte să trimiți comanda.',
          'Factura o primești pe email după confirmarea plății. La ramburs, factura se emite când predăm coletul curierului.',
        ],
      },
      {
        heading: 'Rambursări',
        body: ['Returnăm banii pe aceeași cale prin care ai plătit: pe card sau în contul din care ai făcut transferul. Pentru o comandă plătită ramburs, prin transfer bancar, în contul pe care ni-l indici.'],
      },
      contact,
    ],
  },
]

export function getLegalPage(slug: string) {
  return legalPages.find((p) => p.slug === slug)
}
