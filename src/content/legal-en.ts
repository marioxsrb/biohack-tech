/**
 * English translation of src/content/legal.ts (same pages, slugs, section ids and block structure).
 * The Romanian version prevails in case of any discrepancy. Keep both files in sync: any change to
 * legal.ts must be mirrored here.
 */
import { company, companyLine } from '@/config/company'
import { AD_CONSENT_TEXT } from '@/config/review'
import { site, terms } from '@/config/site'
import { GIFT_SHIPPING_RON, VOUCHER_VALIDITY_DAYS, VOUCHER_VALUE } from '@/config/vouchers'
import { formatLei } from '@/lib/money'
import { COMMUNICATIONS_CONSENT_TEXT_EN, EMAIL_ONLY_CONSENT_TEXT_EN } from '@/lib/consent/communications'
import { CONSENT_MAX_AGE_DAYS } from '@/lib/consent/cookies'
import { configuredVendors } from '@/lib/consent/vendors'
import type { LegalPage, LegalSection } from './legal'

const UPDATED = '23 octombrie 2026'
const processingDays = terms.processingDays.replace(' zile', ' days')
const transitDays = terms.transitDays.replace(' zile', ' days')
const contactLine = `Write to us at ${site.email} or call ${site.phone}. We reply within 24 hours.`
const internationalNote = `On the international site (biohack-tech.net) the box covers email only and reads: “${EMAIL_ONLY_CONSENT_TEXT_EN}” Customers of the international site do not receive calls from the AI assistant.`

const identity = (): LegalSection => ({
  heading: 'Who we are',
  body: [
    company.legalName
      ? `The website ${site.url.replace(/^https?:\/\//, '')} is operated by ${companyLine()}.`
      : `The website ${site.url.replace(/^https?:\/\//, '')} is the Biohack Tech online store.`,
    ...(company.returnAddress ? [`Address for returns: ${company.returnAddress}.`] : []),
    `Contact: ${site.email}, ${site.phone}.`,
  ],
})

const contact: LegalSection = { heading: 'Contact', body: [contactLine] }

/** Optional tools actually configured, for the cookie table. */
function optionalRows(): string[][] {
  const rows: Record<string, string[][]> = {
    ga4: [
      ['_ga, _ga_*', 'Google Analytics 4', 'Analytics', 'Distinguishes visits for statistics', '2 years'],
    ],
    clarity: [
      ['_clck', 'Microsoft Clarity', 'Analytics', 'Recognises the browser between visits', '1 year'],
      ['_clsk', 'Microsoft Clarity', 'Analytics', 'Links the pages of one visit', '1 day'],
    ],
    meta: [
      ['_fbp', 'Meta Pixel', 'Marketing', 'Measures Biohack Tech ads', '3 months'],
      ['_fbc', 'Meta Pixel', 'Marketing', 'Remembers the click on an ad', '3 months'],
    ],
  }
  return configuredVendors().flatMap((v) => rows[v.id] ?? [])
}

export const legalPagesEn: LegalPage[] = [
  {
    slug: 'terms-of-service',
    title: 'Terms and Conditions',
    shortTitle: 'Terms and Conditions',
    description: 'The terms and conditions of the Biohack Tech store: how to order, prices, payment, delivery, withdrawal, warranty and complaints.',
    updated: UPDATED,
    sections: [
      identity(),
      {
        heading: 'How to order',
        body: [
          {
            list: [
              'You choose the products and add them to the cart. In the cart you can change the quantity or remove products.',
              'At checkout you fill in your contact, billing and delivery details and choose the payment method.',
              'Before you submit the order you see the products, the price of each, the delivery and the total. You can correct any field.',
              'You tick your agreement to these terms (mandatory) and, if you wish, your consent to communications (optional), then submit the order with the payment button or “Order with obligation to pay”.',
              'You receive the order confirmation by email.',
            ],
          },
          'You can order as an individual or as a company. The contract is concluded in Romanian.',
        ],
      },
      {
        heading: 'When the contract is concluded',
        body: [
          'For card payments, the contract is concluded when the payment is confirmed and we send you the confirmation by email.',
          'For bank transfers, the contract is concluded when we send you by email the order confirmation with the payment details. We prepare the parcel once the amount reaches our account.',
          'For cash on delivery, the contract is concluded when we send you the order confirmation by email. You pay the full amount to the courier when you receive the parcel.',
          'We keep the order in our records. You have a copy in the confirmation email and on the order page.',
        ],
      },
      {
        heading: 'Prices',
        body: [
          'Prices are in lei and include 21% VAT. On biohack-tech.net they are shown and charged in euros or US dollars, converted from lei at the National Bank of Romania exchange rate and rounded to the unit. Free delivery, except for orders that contain Diana L. Palotaș’s book, which pay one delivery fee per order. The total to pay, in the order currency, is shown before you submit the order.',
        ],
      },
      {
        heading: 'Payment, delivery, withdrawal and warranty',
        body: [
          'The details are on the dedicated pages: [Payments](/plati), [Delivery](/politica-livrare), [Returns and right of withdrawal](/politica-retur), [Warranty and complaints](/garantie).',
          'You can withdraw from an order online on the [Withdrawal from the contract](/retragere) page.',
        ],
      },
      {
        heading: 'About the products',
        body: [
          'Biohack Tech products are intended for general well-being. They do not replace medical advice.',
          'If you have a medical condition or are following a treatment, talk to your doctor before use. Results vary from person to person.',
        ],
      },
      {
        heading: 'Commercial communications',
        id: 'comunicari',
        body: [
          `We send you commercial communications only if you tick, at checkout, the box: “${COMMUNICATIONS_CONSENT_TEXT_EN}” The box is optional and is not pre-ticked. Without it you see the prices and order in the same way. Accepting these terms does not mean consent to communications.`,
          'The box covers two channels, which we record separately (the text, the date and the page), for the email address and for the phone number:',
          {
            list: [
              'Emails: news, offers and recommendations about Biohack Tech products.',
              'Recovery of unfinished orders: if you started an order or asked for the price and did not finish, we may send you at most two reminder emails, with the link to the product or the cart. They stop as soon as you order, unsubscribe or withdraw your consent.',
              'Calls from the AI assistant: a Biohack Tech AI assistant, an automated system, may call you about the product you chose if you did not finish your order. It tells you from the start that it is an AI assistant and that the call is recorded. It calls only a Romanian number, on working days, between 8:00 and 21:00, at most three times for the same unfinished order (if you do not answer: once after one hour, then the next day). Calls with the AI assistant are recorded and analysed to check the quality of our service; the recording is deleted automatically after 30 days (details in the [Privacy policy, Calls from the AI assistant](/privacy-policy#apeluri)). The assistant does not ask for your card details.',
            ],
          },
          internationalNote,
          'You can withdraw your consent at any time, free of charge: from the unsubscribe link in every marketing email (this also stops the calls), by telling the assistant during the call that you no longer want to be called (this stops the calls) or by writing to us. After withdrawal we no longer contact you for commercial purposes. Emails about orders (confirmation, payment, invoice, delivery, refund) continue, because they are necessary for the order.',
          'Details on how we use your data: [Privacy Policy](/privacy-policy#marketing).',
        ],
      },
      {
        heading: 'Vouchers, gifts and rewards',
        id: 'vouchere',
        body: [
          {
            list: [
              `Personal vouchers: ${formatLei(VOUCHER_VALUE['balance-wave'])} for NEUROS Calm, ${formatLei(VOUCHER_VALUE['brainlink-pro'])} for NEUROS Focus and ${formatLei(VOUCHER_VALUE['ochelari-biohack'])} for each paid pair of Amber glasses.`,
              `A voucher is valid for ${VOUCHER_VALIDITY_DAYS.admin} days from issue. You use it once, on the product it was issued for, with the email address it was sent to.`,
              'Enter the voucher in the code field at checkout. Its value is deducted from the product price. Any unused remainder is not paid out in cash.',
              'If an order paid with a voucher is cancelled or fully refunded, the voucher becomes available again until its expiry date.',
              `A gift is the chosen product, free of charge. You pay only the delivery, ${formatLei(GIFT_SHIPPING_RON)} per order, however many gifts and products it contains.`,
              'Rewards for a video review, for referrals and for VIP status are chosen from your account, through the link you receive by email.',
            ],
          },
          'The conditions for the video review are on the [Video review conditions](/conditii-review-video) page.',
        ],
      },
      {
        heading: 'Personal data',
        body: ['We use your data to process, invoice and deliver the order. The details are in the [Privacy Policy](/privacy-policy) and the [Cookie Policy](/politica-cookies).'],
      },
      {
        heading: 'Complaints and disputes',
        body: [
          `For any problem, write to us at ${site.email}. We will look for a solution together.`,
          'If we do not reach an agreement, you can contact the National Authority for Consumer Protection (ANPC) ([anpc.ro](https://anpc.ro)) or file a complaint for alternative dispute resolution at [reclamatiisal.anpc.ro](https://reclamatiisal.anpc.ro).',
          'The contract is governed by Romanian law.',
        ],
      },
      contact,
    ],
  },
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    shortTitle: 'Privacy',
    description: 'What personal data Biohack Tech uses, why, for how long, who it shares it with and what rights you have.',
    updated: UPDATED,
    sections: [
      {
        heading: 'Who is responsible for your data',
        body: [
          `${company.legalName ? companyLine() : 'Biohack Tech'} is the controller of your data. For any question about your data, write to us at ${site.email}.`,
        ],
      },
      {
        heading: 'What data we use and why',
        body: [
          {
            table: {
              head: ['What we do', 'What data', 'Legal basis'],
              rows: [
                ['We process and deliver the order and write to you about it', 'Name, email, phone, delivery and billing address, the products ordered, notes', 'The contract (Art. 6(1)(b) GDPR)'],
                ['We invoice and keep the accounting records', 'Billing details; for companies, the name, tax ID (CUI) and Trade Register number', 'Legal obligation (Art. 6(1)(c))'],
                ['We collect payment and prevent fraud', 'The payment result from Stripe; for transfers, the details in the bank statement; for fraud prevention, the signals described below', 'The contract and the legitimate interest in preventing fraud (points b and f)'],
                ['We keep what you wrote in the contact step of the order before you submit it, so we know how many orders remain unfinished and can restore your cart', 'Name, email, phone, the products in the cart', 'Our legitimate interest in understanding and improving the ordering process (point f)'],
                ['We send you news, offers, recommendations and a reminder about an unfinished order or offer', 'Email, name, the products you were interested in', 'Your consent, given by ticking the box (point a)'],
                ['Our AI assistant calls you about the chosen product, if you did not finish your order', 'Phone, first name, the chosen product, the outcome of the call', 'Your separate consent to calls, given by ticking the box (point a)'],
                ['We record and analyse the AI assistant calls, to check the quality of our service and to be able to prove what was agreed (for example that you asked not to be contacted again)', 'Your voice, the transcript of the conversation, the phone number, the date and duration of the call', 'Our legitimate interest in checking and improving call quality and in proving what was agreed (point f); we tell you at the start of the call and you can object at any time'],
                ['We answer questions, complaints and withdrawal requests', 'What you write to us and the order details', 'The contract and legal obligation'],
                ['Statistics and ads, only if you accept analytics or marketing cookies', 'Data about how the site is used. Details in the Meta ads section', 'Your consent (point a)'],
                ['We measure the orders that come from Meta ads, only if you accepted marketing cookies', 'Your email and phone in encrypted form (hash), the IP address, the browser, the _fbp and _fbc identifiers, the order number, its products and its value', 'Your consent (point a)'],
                ['We issue and check vouchers, gifts and rewards', 'Email, the voucher code, the product, the value, the dates of issue, use and expiry, the order in which you used it', 'The contract (point b) and the legitimate interest in preventing double use (point f)'],
                ['We receive your video review and use it in Biohack Tech materials, only with your agreement', 'The video, your image and voice, the optional rating, the order, the time and version of the agreement', 'Your licence agreement, given with a separate tick box (points a and b); you can withdraw it at any time'],
              ],
            },
          },
          'Without the order data we cannot process and deliver the order. Marketing emails are optional: ordering works the same without them.',
          'We do not make automated decisions with legal effects on you.',
        ],
      },
      {
        heading: 'Payment fraud prevention',
        id: 'frauda',
        body: [
          'To protect our customers and the shop from payments with stolen cards and fake orders, we check every order when it is placed. We look at a few signals: whether the email address is a temporary one, how many card payments recently failed for the same contact details, the same browser or the same network, whether the same contact details appear with different names, and how many orders come from the same source in a short time.',
          'For this we keep, with the order, two pseudonymised identifiers: a cryptographic fingerprint of the IP address (not the IP address itself; the address cannot be rebuilt from the fingerprint) and the random identifier of the necessary cart cookie. We do not keep card details: they go directly to Stripe, which also runs its own fraud checks.',
          'What happens: an order with several risk signals is put under review. A team member may call you to confirm it, and until then the order is not prepared and you receive no reminder emails or automated calls. The decision is always made by a person, never by the system alone; the order is not cancelled automatically. After several failed card payments in one day, card payment is paused for the same details, while cash on delivery, bank transfer and phone orders remain available. When paying by card, your bank may ask you to confirm with 3D Secure.',
          'The legal basis is our legitimate interest, and that of our customers, in preventing fraud (Art. 6(1)(f) GDPR).',
          'Retention and access: the pseudonymised identifiers are deleted automatically 90 days after the order. The outcome of the check (the score, the reasons and who confirmed the order) stays in the order history for as long as we keep the order. Only team members with administrator access can see this information; it never appears on the website, in emails or with marketing providers.',
          'You can object to this processing, ask for access to it, or ask for a person to look again at an order put under review, by writing to us at the address in the Contact section.',
        ],
      },
      {
        heading: 'Marketing emails',
        id: 'marketing',
        body: [
          `We send you marketing emails only if you tick, when ordering, the optional box: “${COMMUNICATIONS_CONSENT_TEXT_EN}” The conditions are in the [Terms and Conditions, Commercial communications](/terms-of-service#comunicari). Accepting the terms of sale does not mean consent to marketing.`,
          internationalNote,
          'We keep proof of consent: the text you saw, the date and the order or form in which you gave it.',
          'If you do not finish an order or an offer and you ticked the consent box, we may send you at most two reminder emails, without invented discounts. They stop as soon as you order, unsubscribe or withdraw your consent.',
          'You can unsubscribe at any time from the link in every marketing email or by writing to us. Emails about orders (confirmation, payment, invoice, delivery, refund) continue, because they are necessary for the order.',
        ],
      },
      {
        heading: 'Calls from the AI assistant',
        id: 'apeluri',
        body: [
          `We may call you with an AI assistant only if you tick the box that explicitly names the calls: “${COMMUNICATIONS_CONSENT_TEXT_EN}” The box is optional and is not required to see the price or to order. Consent to calls is recorded separately, for your phone number. Older consent given only for emails does not mean consent to calls. The international site (biohack-tech.net) does not make AI assistant calls.`,
          'The assistant tells you from the start that it is a Biohack Tech AI assistant and that the call is recorded. It calls only a Romanian number, on working days, between 8:00 and 21:00, at most three times for the same unfinished order (if you do not answer: once after one hour, then the next day). It does not ask for your card details and does not give medical advice.',
          'Call recording. Calls with the AI assistant are recorded and transcribed, and the conversation is analysed automatically (summary, outcome), to check the quality of our service and to be able to prove what was agreed, for example that you asked not to be called again. The legal basis is our legitimate interest (Art. 6(1)(f) GDPR), not the consent to calls; the assistant tells you at the start of every call that it is recorded. Calls made before 19 October 2026 were not recorded.',
          'Retention and access. The recording, the transcript and the analysis are kept by our provider ElevenLabs for 30 days and then deleted automatically. Only Biohack Tech team members with access to the company ElevenLabs account can listen to them, to check quality and to handle your requests. We do not copy them to other systems, publish them or use them to train AI models. In our database we keep only the date, the duration and the outcome of the call (for example “wants more information” or “no longer wants calls”), linked to your request. If you ask, we email you the link to the product.',
          'Your rights and deletion. You can object to the recording at any time: tell the assistant you do not want to be recorded (the assistant ends the call) or write to contact@biohack-tech.ro. We delete the recording and the transcript of the call within 3 working days of your request and confirm by email. You can also ask for a copy of the recording while it exists (30 days). We keep only the proof that you refused the calls or the recording, without audio.',
          'You can refuse at any time: tell the assistant you no longer want to be called, unsubscribe from any email or write to us. We stop calling you once you order.',
        ],
      },
      {
        heading: 'Meta ads',
        id: 'meta',
        body: [
          'We use the Meta Pixel and the Conversions API to know which Biohack Tech ads bring orders. We turn them on only if you accept marketing cookies. Without that consent, Meta receives no data from us.',
          'With your consent, Meta receives the pages you visit, the products you view, additions to the cart, the start of checkout and the paid order. For the paid order we also send your email and phone, irreversibly encrypted (SHA-256 hash), the IP address, the browser and the _fbp and _fbc identifiers. This lets Meta link the order to the ad and count it only once.',
          'Meta Platforms Ireland Ltd. receives this data as a joint controller for ad measurement. You can withdraw your consent at any time from the cookie settings in the footer of the site.',
        ],
      },
      {
        heading: 'Video review',
        id: 'review-video',
        body: [
          'When you send a video review, we keep it in private storage. Only the Biohack Tech team can see it, through temporary links.',
          'We use the video on the site, on social networks and in ads only if you ticked the separate agreement box. We keep the text of the agreement, its version and the time you gave it.',
          'You can withdraw your agreement at any time, from your account or by writing to us. We remove the video from our materials within 7 working days. If you ask, we also delete the file.',
          'All the conditions are on the [Video review conditions](/conditii-review-video) page.',
        ],
      },
      {
        heading: 'Who else receives the data',
        body: [
          'Each provider receives only the data necessary for its role:',
          {
            list: [
              'Stripe: card payment. Card details go directly to Stripe; we do not see them. After a card payment, Stripe keeps the card associated with the order for at most 30 minutes, for the optional post-payment offer; it is charged only if you explicitly accept it. The card is then detached.',
              'FGO: issuing invoices.',
              'GoHighLevel (the LeadConnector platform): customer records and sending emails.',
              'ElevenLabs (the voice, the conversation, the recording and the transcript of the AI assistant calls) and Twilio (the telephone network), only if you accepted calls. The recording, transcript and analysis of a call are kept by ElevenLabs for 30 days, then deleted automatically.',
              'The courier company: delivering the parcel.',
              'Meta (Meta Platforms Ireland Ltd.): ad measurement, only with consent to marketing cookies. It also receives the video reviews used in ads, only with your licence agreement.',
              'The hosting provider of the website, the database and the storage for video reviews (Vercel, Supabase).',
              'Authorities, only when the law requires us to.',
            ],
          },
          'Stripe, GoHighLevel, ElevenLabs, Twilio and Meta may also process data outside the European Economic Area. In that case, the transfer takes place only with the safeguards required by the GDPR (Art. 44-46).',
        ],
      },
      {
        heading: 'How long we keep the data',
        body: [
          {
            list: [
              'Orders and invoices: as long as accounting and tax laws require.',
              'The pseudonymised identifiers used for fraud prevention (the IP address fingerprint and the cart cookie identifier): 90 days from the order, then deleted automatically.',
              'Marketing consent and unsubscription: as long as you receive emails and afterwards for as long as they may be requested from us as proof.',
              'Vouchers and rewards: for as long as we keep the order they relate to. An unused voucher stays on record after expiry, as proof.',
              'The video review: for as long as we use it with your agreement. Proof of the agreement and of its withdrawal: for as long as it may be requested from us. We delete the file on request, within 30 days.',
              'Your messages and requests: for as long as the resolution takes and the period during which they may be requested from us as proof.',
              'The data in the contact step of an unsubmitted order (and in the price form on acces.biohack-tech.ro, used until 20 October 2026): at most 12 months from your last activity, after which we delete it automatically. If you place an order, it remains linked to the order.',
              'Consent to calls and its refusal: for as long as they may be requested from us as proof. Call outcomes: together with the request they relate to. The audio recording, transcript and analysis of a call: 30 days, at ElevenLabs, then deleted automatically.',
            ],
          },
        ],
      },
      {
        heading: 'What we store in your browser',
        body: ['The cart, the unfinished order form and your cookie choice. The details are in the [Cookie Policy](/politica-cookies).'],
      },
      {
        heading: 'Your rights',
        body: [
          'You can request access to your data, its rectification or erasure, restriction of processing and data portability. You can object to processing based on legitimate interest and, at any time, to direct marketing.',
          'You can withdraw your consent at any time. Withdrawal does not affect what was done before.',
          `Write to us at ${site.email}. We reply within one month at most.`,
          'You can lodge a complaint with the National Supervisory Authority for Personal Data Processing (ANSPDCP) ([dataprotection.ro](https://www.dataprotection.ro)).',
        ],
      },
    ],
  },
  {
    slug: 'politica-cookies',
    title: 'Cookie Policy',
    shortTitle: 'Cookies',
    description: 'What the Biohack Tech website stores in your browser, why, and how to change your choice.',
    updated: UPDATED,
    sections: [
      {
        heading: 'In short',
        body: [
          'The website uses only what is necessary for the cart, the order and the payment to work. Any analytics or marketing tool starts only after you accept it.',
          'You can change your choice at any time from “Cookie settings”, at the bottom of any page. Your choice is valid for 12 months, after which we ask you again.',
        ],
      },
      {
        heading: 'Necessary (always active)',
        body: [
          {
            table: {
              head: ['Name', 'Type', 'Purpose', 'Duration'],
              rows: [
                ['biohack-cart-v1', 'Local storage', 'Remembers the products in the cart', 'Until you empty the cart'],
                ['biohack-checkout-draft', 'Session storage', 'Keeps what you filled in on the order form', 'Until you close the tab'],
                ['bt-cart-cleared-*', 'Local storage', 'Remembers that the products of an order were removed from the cart', 'Until you delete the site data'],
                ['bt-consent-v1', 'Local storage', 'Remembers your cookie choice', `${Math.round(CONSENT_MAX_AGE_DAYS / 30)} months`],
                ['bt_vid', 'Cookie (only after a form)', 'A random code that links the contact step to the order placed from the same browser, so it does not appear twice', '90 days'],
                ['bt-visit', 'Session storage', 'Counts the visit only once per session, for our aggregate statistics; it does not send any identifier', 'Until you close the tab'],
                ['__stripe_mid, __stripe_sid', 'Stripe cookie, only on the payment page', 'Payment security and fraud prevention', '1 year and 30 minutes, respectively'],
              ],
            },
          },
          'Stripe may also use cookies on its own domains, in the card form. Details: [stripe.com/cookie-settings](https://stripe.com/cookie-settings).',
        ],
      },
      {
        heading: 'Analytics and marketing (only with your consent)',
        body: optionalRows().length
          ? [
              { table: { head: ['Name', 'Service', 'Category', 'Purpose', 'Duration'], rows: optionalRows() } },
              'Once you have accepted, we also keep in the browser the orders already reported (bt-purchase-*, bt-placed-*), so we do not count them twice.',
              'These services do not receive your name, email, phone or address.',
            ]
          : ['We currently do not use any analytics or marketing tools. If we add them, they will appear here and start only after you accept them.'],
      },
      {
        heading: 'How to change your choice',
        body: [
          'From “Cookie settings”, at the bottom of the page. If you withdraw a consent, we delete that service’s cookies from the site and reload the page without it.',
          'You can delete the cookies and site data at any time from your browser settings. The cart is then emptied and we ask you again.',
          'Marketing emails have a separate consent, given when ordering. Consent to marketing cookies does not mean consent to emails.',
        ],
      },
      {
        heading: 'Proof of your choice',
        body: ['When you choose, we save on our server your choice, the date, the version of this policy and a random code from your browser. We do not save the IP address or any other data that identifies you.'],
      },
      contact,
    ],
  },
  {
    slug: 'politica-livrare',
    title: 'Delivery Policy',
    shortTitle: 'Delivery',
    description: 'Free courier delivery, in Romania and abroad: processing within 1-3 days, tracking (AWB) number by email.',
    updated: UPDATED,
    sections: [
      {
        heading: 'Where we deliver',
        body: [
          'We deliver throughout Romania and abroad, by courier, to the address in the order.',
          'Orders delivered outside Romania and orders paid in euros or dollars are paid by card. Cash on delivery and bank transfer are available for orders in lei with delivery in Romania.',
        ],
      },
      {
        heading: 'Timeframes',
        body: [
          `We prepare the order within ${processingDays} of payment confirmation. In Romania, shipping usually takes ${transitDays}; abroad, the timeframe depends on the country and the courier.`,
          'When we hand the parcel to the courier, you receive by email the name of the courier company and the tracking (AWB) number.',
          'If there is a delay, we will let you know.',
        ],
      },
      {
        heading: 'Cost',
        body: [
          'Delivery is free, in Romania and abroad. Prices include 21% VAT.',
          'Exception: an order that contains the book “Știu. Vreau. DE CE NU POT?” by Diana L. Palotaș pays one delivery fee per order, 12.10 lei (10 lei + 21% VAT; in euros or dollars converted like the prices), however many books or other products it contains. The fee is shown separately in the cart and at checkout, before you place the order, and is never discounted.',
          'The PDF edition of the book is sent by email once your card payment is confirmed, and can also be downloaded straight away from your order page. Download links are personal and expire for security.',
          'For deliveries outside the European Union, customs or import duties may apply in the destination country.',
        ],
      },
      {
        heading: 'On receipt',
        body: ['Check the parcel in front of the courier. If it is damaged, note this on the courier’s document and write to us.'],
      },
      contact,
    ],
  },
  {
    slug: 'politica-retur',
    title: 'Returns and Right of Withdrawal',
    shortTitle: 'Returns and withdrawal',
    description: 'The 14-day right of withdrawal for individuals: how to withdraw from an order, how to send the products back and how you get your money back.',
    updated: UPDATED,
    sections: [
      {
        heading: 'The right of withdrawal',
        body: [
          `If you bought as an individual, you can withdraw from the order within ${terms.returnDays} days from the day on which you, or someone designated by you, receive the products. You do not have to tell us the reason.`,
          'If you ordered several products delivered separately, the period runs from the receipt of the last product.',
        ],
      },
      {
        heading: 'How to withdraw',
        body: [
          'The simplest way: the [Withdrawal from the contract](/retragere) page. You receive a confirmation by email, with the date and time.',
          `You can also send the form below or any clear statement to ${site.email}. It is enough to send us the statement before the ${terms.returnDays} days expire.`,
        ],
      },
      {
        heading: 'How to send the products back',
        body: [
          `Send us the products within ${terms.returnDays} days at most of your withdrawal request.${company.returnAddress ? ` Return address: ${company.returnAddress}.` : ' We will write to you with the return address and the steps after we receive your request.'}`,
          'You may examine the product as you would in a shop. If the product was used beyond that, you may be liable for the diminished value of the product.',
        ],
      },
      {
        heading: 'How you get your money back',
        body: [
          `We refund all amounts paid, including standard delivery, within ${terms.returnDays} days at most from the date you notified us of your withdrawal.`,
          'We use the same payment method: to the card for card payments, to the account for transfers. For cash on delivery, by bank transfer, to the account you indicate to us.',
          'We may withhold the refund until we receive the products or proof that you have sent them.',
        ],
      },
      {
        heading: 'Withdrawal form',
        id: 'formular',
        body: [
          'Complete and return this form only if you wish to withdraw from the contract:',
          {
            list: [
              `To: ${company.legalName ? `${company.legalName}${company.returnAddress || company.address ? `, ${company.returnAddress ?? company.address}` : ''}` : 'Biohack Tech'}, ${site.email}`,
              'I hereby give notice that I withdraw from my contract of sale of the following goods: ...',
              'Ordered on ... / received on ...',
              'Order number: ...',
              'Name of consumer: ...',
              'Address of consumer: ...',
              'Signature of consumer (only if this form is notified on paper)',
              'Date: ...',
            ],
          },
        ],
      },
      {
        heading: 'Defective products',
        body: ['Withdrawal is separate from the warranty. If a product does not work properly, see [Warranty and complaints](/garantie).'],
      },
      contact,
    ],
  },
  {
    slug: 'garantie',
    title: 'Warranty and Complaints',
    shortTitle: 'Warranty',
    description: 'The 2-year legal guarantee of conformity for Biohack Tech products and how to file a complaint.',
    updated: UPDATED,
    sections: [
      {
        heading: 'The legal guarantee of conformity',
        body: [
          `We are liable for any lack of conformity of the product that becomes apparent within ${terms.warrantyYears} years of delivery. This is the legal guarantee provided by Government Emergency Ordinance (OUG) 140/2021.`,
          'If the problem appears within the first year of delivery, it is presumed to have existed at delivery. You do not have to prove it.',
          'You are entitled to have the product repaired or replaced free of charge, within a reasonable period of at most 15 days from the date you brought or sent it to us. If that is not possible, you are entitled to a price reduction or to terminate the contract.',
          'The legal guarantee applies to purchases made as an individual.',
        ],
      },
      {
        heading: 'How to file a complaint',
        body: [
          `Write to us at ${site.email} or call ${site.phone}. Tell us the order number, the product and what is not working. A photo or a short video also helps.`,
          'We will tell you the steps for sending the product and keep you informed until it is resolved.',
        ],
      },
      {
        heading: 'If we do not reach a solution',
        body: [
          'You can contact the National Authority for Consumer Protection (ANPC) ([anpc.ro](https://anpc.ro)).',
          'You can also file a complaint for alternative dispute resolution at [reclamatiisal.anpc.ro](https://reclamatiisal.anpc.ro).',
        ],
      },
      contact,
    ],
  },
  {
    slug: 'plati',
    title: 'Payments',
    shortTitle: 'Payments',
    description: 'How to pay at Biohack Tech: cash on delivery, bank card via Stripe or bank transfer. Prices in lei (euros or dollars on biohack-tech.net), VAT included.',
    updated: UPDATED,
    sections: [
      {
        heading: 'Bank card',
        body: [
          'You pay online through Stripe, our payment processor. Card details go directly to Stripe. We do not see them and do not store them.',
          'Your bank may ask for additional confirmation (3-D Secure), in the bank’s app or by SMS.',
          'The order is confirmed when Stripe confirms the payment. If the payment fails, nothing is charged and you can try again.',
          'After a card payment we may offer you, only once, an optional product. It is charged to the same card only if you press “Add to order” and confirm the amount. It becomes a separate order, with a separate invoice; the first order remains paid and confirmed regardless. If your bank requires confirmation, the bank’s verification step opens.',
        ],
      },
      {
        heading: 'Cash on delivery',
        body: [
          'You pay the courier the full amount of the order when you receive the parcel. You pay nothing online.',
          'The order is confirmed immediately, by email. We prepare the parcel and send it to you like any other order. The amount to pay is shown in the email and on the order page.',
          'Bundle discounts apply in the same way, in the order total.',
        ],
      },
      {
        heading: 'Bank transfer',
        body: [
          'After ordering, you receive the payment details on the order page and by email: the beneficiary, the IBAN, the bank and the exact amount.',
          'Write the order number in the payment details. This is how we match the transfer to the order.',
          'We prepare the parcel once the amount reaches our account. We will write to you when we receive the payment.',
        ],
      },
      {
        heading: 'Promotions',
        body: [
          'For NEUROS Calm and NEUROS Focus, the discount is calculated separately for each product. When the order contains 2 units of the same product you get a 10% discount on those units, and from 3 units you get 20%. Units of different products are not added together, and the discount does not apply to the rest of the order. For a product, the two discounts are not cumulative: only the highest one reached applies. For NEUROS Amber, out of every 3 pairs in the same order, one is free (the cheapest, if prices differ). NEUROS Amber is not included in this discount and does not receive 10% or 20%. Discounts are calculated automatically in the cart, on the displayed prices, and are shown separately in the order and on the invoice. They apply as long as they are displayed on the site.',
          'Promotions apply in the same way regardless of the payment method: card, cash on delivery or transfer.',
        ],
      },
      {
        heading: 'Prices and invoice',
        body: [
          'Prices are in lei and include 21% VAT; orders in euros or dollars (biohack-tech.net) are charged in that currency. The total to pay is shown before you submit the order.',
          'You receive the invoice by email after payment confirmation. For cash on delivery, the invoice is issued when we hand the parcel to the courier.',
        ],
      },
      {
        heading: 'Refunds',
        body: ['We refund the money by the same means you used to pay: to the card or to the account from which you made the transfer. For an order paid cash on delivery, by bank transfer, to the account you indicate to us.'],
      },
      contact,
    ],
  },
  {
    slug: 'conditii-review-video',
    title: 'Video review conditions',
    shortTitle: 'Video review',
    description: 'How you send a Biohack Tech video review, how you receive the reward and how we use the video, with your agreement.',
    updated: UPDATED,
    sections: [
      {
        heading: 'In short',
        body: [
          {
            list: [
              'You send a short video about the product you received, from your account.',
              'You tick the licence agreement. This lets us use the video on the site, on social networks and in ads.',
              'We check the video and you receive the reward in your account.',
              'The reward is the same, whatever your opinion.',
              'You can withdraw the agreement at any time.',
            ],
          },
        ],
      },
      {
        heading: 'Who uses the video',
        body: [`The video is used by ${company.legalName ?? 'the operator of the shop'}, for the Biohack Tech shop. The company details are in the [Terms and Conditions](/terms-of-service).`],
      },
      {
        heading: 'The reward',
        id: 'recompensa',
        body: [
          {
            list: [
              'You receive one reward for each delivered and paid order, for one video.',
              'The reward comes together with the licence agreement. A video sent without the agreement stays private, for our team only, and carries no reward.',
              'You can also give the agreement after sending, from your account, until we check the video.',
              'The reward is the same for any rating and any opinion, positive or critical. We care about your real experience.',
              'We only check that the video is yours, shows the product you received and follows the rules below. If we reject it, we tell you why and you can send another one.',
              'You choose the reward from your account: a gift, for which you pay only the delivery.',
              'If you withdraw the agreement after receiving the reward, the reward stays yours.',
            ],
          },
        ],
      },
      {
        heading: 'The licence agreement',
        id: 'acord',
        body: [
          `The tick box on the upload page reads (in Romanian): “${AD_CONSENT_TEXT}” In English: “I agree that ${company.legalName ?? 'the operator of the shop'} may use my video, with my image and voice, in Biohack Tech materials: on the website, on social networks and in paid ads. I have read the conditions.” The box is separate and not pre-ticked.`,
          'With the agreement you allow us, free of charge and non-exclusively, to use the video and your image and voice in it:',
          {
            list: [
              'on the Biohack Tech websites (biohack-tech.ro and biohack-tech.net);',
              'on the Biohack Tech pages on social networks (for example Facebook, Instagram, TikTok, YouTube);',
              'in paid ads for Biohack Tech products, on these networks and on Google.',
            ],
          },
          'We may shorten the video, fit it to another format and add subtitles, a logo or the ad text. We keep the meaning of what you said.',
          'We use at most your first name, if you say it in the video. The rest of your data stays private.',
          'The agreement is valid until you withdraw it. We keep the text of the agreement, its version and the time you gave it.',
          'In ads we mention that you received a reward for the review, where the law requires it.',
        ],
      },
      {
        heading: 'What the video may contain',
        body: [
          {
            list: [
              'Your real experience with the product you bought.',
              'Only people who agreed to appear. No children.',
              'No personal data of others, no protected music and no medical promises.',
              'MP4, MOV or WebM format, up to 300 MB.',
            ],
          },
        ],
      },
      {
        heading: 'Withdrawing the agreement',
        id: 'retragere',
        body: [
          'You can withdraw the agreement at any time, free of charge: from your account, with the “Withdraw agreement” button, or by writing to us at ' + site.email + '.',
          'After withdrawal we use the video in no new materials. We remove it from the site, from our pages and from active ads within 7 working days.',
          'Shares made by other people and copies they saved are outside our control. We can ask the platform to remove them, if you ask us to.',
          'Withdrawal concerns future uses. What was published before was lawful, with your agreement.',
        ],
      },
      {
        heading: 'Keeping and deleting the video',
        body: [
          'The video sits in private storage. Only the Biohack Tech team can see it, through temporary links. Every view from the administration area is logged.',
          'If you ask us to delete it, we delete the file within 30 days and confirm by email. We keep only the proof of the agreement and of its withdrawal.',
          'Details about the data in the [Privacy Policy, Video review](/privacy-policy#review-video).',
        ],
      },
      contact,
    ],
  },
]
