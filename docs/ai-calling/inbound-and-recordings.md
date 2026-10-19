# Apeluri primite (inbound) și înregistrări — audit 19.10.2026

Stare: **pregătit, neactivat**. Nimic din ce e mai jos nu a fost cumpărat, pornit sau schimbat la Orange, Twilio sau ElevenLabs.

## 1. Configurația găsită

| Ce | Stare |
|---|---|
| Agent | `agent_9901m501694cf66v9pxkq8jp004h` „BiohackTech — AI Recovery Agent”, limba ro, prima frază `{{opening_line}}` (o trimite serverul la fiecare apel outbound) |
| Număr în ElevenLabs | `+40754994727` (Orange), importat cu providerul **Twilio** (`phnum_7701m4zt81brfndt7v9tbz69svkw`); **niciun agent asignat pentru inbound** |
| Outbound | `POST /v1/convai/twilio/outbound-call`, `call_recording_enabled: false`; Twilio folosește numărul Orange ca *Verified Caller ID* |
| Webhook post-call | setat la nivel de workspace (`transcript`, `call_initiation_failure`), fără audio (`send_audio: false`) → `/api/webhooks/elevenlabs` |
| Webhook de inițiere (inbound) | **nesetat** (`conversation_initiation_client_data_webhook: null`) |
| Confidențialitate | `record_voice: false` (fără audio), transcripturi păstrate 30 de zile, zero-retention oprit |
| Antrenare modele | nu e activată nicio opțiune de folosire a conversațiilor |

**De ce apelurile primite ajung pe telefonul tău:** numărul este un SIM Orange. Twilio doar *afișează* numărul la apelurile date (Verified Caller ID); nu îl deține și nu primește apelurile lui. Cine sună înapoi la +40 754 994 727 ajunge în rețeaua Orange, pe SIM, adică la tine. ElevenLabs nu are cum să răspundă la un număr pe care nu îl primește.

## 2. Variante pentru ca agentul să răspundă

| | A. Redirecționare Orange → număr Twilio RO | B. Redirecționare → număr SIP (alt furnizor) | C. Gateway GSM–SIP cu SIM-ul Orange |
|---|---|---|---|
| Compatibil ElevenLabs | da, nativ (Twilio, import + agent asignat) | da (SIP trunk) | da, prin SIP trunk, dar config complexă |
| Cost | ~3 $/lună număr local + 0,01 $/min primit (Twilio) + minutele ElevenLabs; redirecționarea Orange e de obicei inclusă în minutele naționale ale abonamentului | similar sau puțin mai mic, plus încă un furnizor | 100–250 € hardware + internet 24/7 + mentenanță |
| Complexitate | mică: cumperi un număr, îl imporți, dai un cod USSD | medie | mare (NAT, IP public, firmware) |
| Fiabilitate | mare (rețele operator) | mare | depinde de un aparat din birou; Orange poate interzice SIM-urile în gateway |
| Caller ID outbound rămâne +40 754… | da (nu se schimbă nimic la outbound) | da | da |
| 24/7 | da | da | doar cât aparatul e pornit |

**Recomandare: A.** Pași:
1. (tu, aprobare + cumpărare) Twilio → Buy a number → Romania, Local, Voice. Pentru România Twilio poate cere un *regulatory bundle* (adresă/firmă din RO); durează de la ore la câteva zile.
2. (eu) Import în ElevenLabs → Phone Numbers → Twilio, asignez agentul existent pentru inbound.
3. (eu) Webhook de inițiere pentru inbound (`/api/webhooks/elevenlabs/initiation`, secret în header): întoarce `opening_line` = „Bună ziua! Ați sunat la Biohack Tech. Sunt asistentul virtual. Cu ce vă pot ajuta?” și `call_direction=inbound`, plus valori neutre pentru variabilele de coș. Pornesc „Fetch initiation client data from a webhook” în Security.
4. (eu) Secțiune „Apel primit” în instrucțiunile agentului: nu presupune coș abandonat; produse/prețuri/livrare/retur din knowledge base; despre o comandă anume nu spune nimic doar pe baza numărului apelantului (verificare: numărul comenzii + emailul, sau trimite linkul comenzii pe email-ul din comandă); notează cererea pentru echipă (tool existent `record_outcome` cu `follow_up`); „nu mă mai sunați” → lista „nu suna”. Instrucțiunile de outbound rămân neschimbate.
5. (tu) Pe telefonul cu SIM-ul Orange: redirecționare. Variante: totul `**21*<număr Twilio>#`; doar când nu răspunzi `**61*<număr>#`, ocupat `**67*<număr>#`, inaccesibil `**62*<număr>#`. Anulare: `##21#` (respectiv `##61#` etc.).
6. Test: un singur apel de pe un număr autorizat, apoi verificare în Admin → Apeluri AI (direcție „primit”, link ElevenLabs).

## 3. Înregistrări audio — ACTIVE din 19.10.2026 (vezi mai jos condițiile îndeplinite)

**Actualizare 19.10.2026:** politica și termenii spun acum că apelurile sunt înregistrate (scop, temei: interes legitim art. 6(1)(f), 30 de zile, acces, drepturi, ștergere în 3 zile lucrătoare). Prima frază anunță „Sunt un asistent automat, iar apelul este înregistrat”. Agentul încheie apelul dacă persoana nu vrea înregistrare și cere ștergerea (request_human_follow_up). Abia după publicarea acestora s-a pornit `record_voice: true` (retenție 30 de zile). Ascultare: ElevenLabs → Conversations sau Admin → Apeluri AI → Deschide.

### Istoric: de ce nu erau pornite

Tehnic se pornesc cu un singur câmp (`platform_settings.privacy.record_voice: true`); apar apoi în ElevenLabs → Conversations, cu player și descărcare. **Legal însă nu se poate acum**, pentru că textele în vigoare promit contrariul:

- Politica de confidențialitate (`src/content/legal.ts`): „Nu înregistrăm apelul. Păstrăm doar data, durata și rezultatul…” și, la acordul pentru apeluri: „…Nu înregistrăm apelul și nu îți cere date de card.”
- Toți cei care au bifat acordul de apeluri l-au dat pe baza acestui text.

Ce trebuie, înainte de pornire (de verificat cu un consultant GDPR):
1. Politica de confidențialitate: scop (calitate, dovada acordului/refuzului), temei (interes legitim sau consimțământ), durată (ex. 30 de zile, aliniat cu retention-ul ElevenLabs), destinatar (ElevenLabs, SUA — clauze contractuale standard), dreptul de opoziție.
2. Anunț la începutul fiecărui apel, ex. după salut: „Apelul este înregistrat pentru calitate.” Pentru outbound înseamnă o schimbare în `openingLine` (`src/server/calling/offer.ts`); pentru inbound, în fraza de răspuns.
3. Pentru acordurile date înainte de schimbare: fie nu se înregistrează apelurile lor, fie li se cere din nou acordul.
4. Textul acordului (`COMMUNICATIONS_CONSENT_TEXT`) poate rămâne, dar pagina „Termeni pentru comunicări” trebuie actualizată.

Draft de înlocuire în politica de confidențialitate (nepublicat):
> „Apelurile asistentului AI sunt înregistrate audio, iar asistentul îți spune asta la începutul apelului. Înregistrarea și transcriptul sunt păstrate 30 de zile la furnizorul nostru ElevenLabs, pentru verificarea calității și ca dovadă a celor convenite (de exemplu, refuzul de a mai fi contactat), apoi sunt șterse automat. Te poți opune oricând; spune-i asistentului sau scrie-ne și nu mai înregistrăm apelurile cu tine.”

## 4. Observație separată: anunțul „asistent AI”

Politica spune: „Îți spune de la început că este un asistent AI.” Din 17.10.2026 (commit „Agent: prima frază”) fraza de deschidere nu mai conține „Sunt un asistent automat” — 4 teste semnalează asta. AI Act (art. 50) cere ca persoana să afle că vorbește cu un sistem AI. Fie se pune la loc anunțul în prima frază, fie se schimbă politica; decizia e a ta.
