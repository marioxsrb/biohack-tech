/**
 * How the AI caller addresses the person: "Bună ziua, doamna Ana!" or "Bună ziua, domnule Ion!". The form takes the
 * name as typed ("Ana Popescu", "Popescu Ana", "ana"): the given name is picked among its words (only it is sent to the
 * voice provider), and "domnule"/"doamna" is added only when it is a given name we know for sure (lists below).
 * A given name not on the lists is judged by its ending, the Romanian way (Iustina, Luciana → doamna; Mario,
 * Bogdan → domnule), but only where the words agree and none is a known unisex name; anything still unsure
 * (Andrea, Alex, Cristi, or a surname that contradicts) gets the name alone. A value that does not look like a
 * name (digits, an email, very long) gets no name at all.
 */

// Common given names in Romania (diacritics removed for matching). Only unambiguous ones.
// prettier-ignore
const MALE = new Set([
  'adi','adrian','alexandru','alin','andrei','anton','aurel','aurelian','bogdan','calin','catalin','cezar','ciprian','claudiu','constantin','corneliu','costel','costin',
  'cosmin','cristian','dan','daniel','darius','david','denis','dorin','dragos','dumitru','eduard','emil','eugen','fabian','florian','florin','gabriel','george','georgel',
  'gheorghe','grigore','horatiu','ilie','ioan','ion','ionel','ionut','iulian','iustin','laurentiu','lucian','marcel','marian','marin','marius','matei','mihai','mihail',
  'mircea','mihnea','mitica','nicolae','nicu','nicusor','octavian','ovidiu','paul','petre','petru','radu','raul','razvan','remus','robert','romeo','sabin','sebastian',
  'sergiu','silviu','sorin','stefan','teodor','tiberiu','titus','toma','traian','tudor','valentin','valeriu','vasile','victor','viorel','virgil','vlad','luca','horia',
  'liviu','mugurel','nelu','petrica','rares','relu','stelian','vali','victoras','antonio','alexandro','iosif','emanuel','eusebiu','gelu','sandu','dinu','codrut',
  'john','michael','james','thomas','peter','mark','martin','oliver','william','richard','markus','lukas','jan','pierre','jean','giovanni','marco','luis','carlos',
  'mario','marian','andrei','aurelian','bebe','beniamin','benjamin','cornel','cristinel','damian','dragomir','emilian','florea','gigel','grigorie','iacob','ionica',
  'laur','lucian','lică','mihaita','mihăiță','nae','neculai','nicoara','octav','paun','sorinel','stelica','tache','tudorel','valer','vasilică','vladimir','zaharia',
  'alexandru-ionut','ilie','costica','dorel','fanel','fănel','florentin','gelu','iulius','leonard','leontin','lorin','mihnea','nichita','patrick','silvestru','tiberiu',
])
// prettier-ignore
const FEMALE = new Set([
  'adela','adelina','adina','adriana','alexandra','alice','alina','amalia','ana','anca','andreea','angela','anisia','antonia','aurelia','aurora','beatrice','bianca',
  'camelia','carmen','catalina','cecilia','claudia','codruta','corina','cornelia','cristina','dana','daniela','delia','denisa','diana','doina','dorina','ecaterina',
  'elena','eliza','elisabeta','emilia','eugenia','felicia','flavia','florentina','florica','gabriela','georgiana','geta','ileana','ilinca','ioana','irina','iulia',
  'iuliana','larisa','laura','lavinia','liliana','livia','loredana','lucia','luminita','madalina','magdalena','maria','mariana','marilena','mihaela','mirela','miruna',
  'monica','nicoleta','oana','otilia','paula','petronela','raluca','ramona','rebeca','roxana','ruxandra','sabina','sanda','silvia','simona','smaranda','sofia','sorina',
  'stefania','tatiana','teodora','valentina','valeria','vasilica','veronica','victoria','violeta','viorica','zoe','anamaria','andra','anastasia','bogdana','camelia',
  'cristiana','lacramioara','lenuta','marcela','margareta','marioara','nadia','natalia','olivia','patricia','rodica','stela','tamara','tudora','emma','sara','ingrid',
  'mary','jennifer','linda','susan','sarah','anna','julia','sophie','laura','claire','marie','hannah','lisa','katharina','chiara','giulia','francesca','lucy',
  'iustina','luciana','alexia','ariana','briana','casiana','cosmina','crina','daria','dorina','elvira','emanuela','estera','eva','gina','ionela','irinela','iulia',
  'karina','lorena','luana','marina','medeea','melania','mihaela','minodora','nicoleta','olga','paraschiva','renata','rozalia','sorana','stefana','tania','vanesa',
  'virginia','yasmina','carmen','ingrid','miriam','beatrix','lidia','aneta','anca','corina','florina','georgeta','ilona','lucreția','lucretia','mirabela','ramona',
])

// Known unisex or ambiguous given names: never guessed.
// prettier-ignore
const UNISEX = new Set(['alex','andrea','cristi','gabi','dani','sasha','sacha','nicola','dominique','ionut-alexandra','vali','sami','robin','kim','eli','chris','jo','toni'])
// Romanian given names ending in -a that are men's.
// prettier-ignore
const MALE_IN_A = new Set(['luca','mihnea','toma','horia','costea','sava','ilia','iosua','noa','jona','coca','aurica','nicola'])
// Women's given names ending in a consonant.
// prettier-ignore
const FEMALE_CONSONANT = new Set(['carmen','ingrid','miriam','beatrix','karin','ruth','esther','rachel','isabel','mabel','lilian','iris','agnes','doris','lucy'])
// Looks like a Romanian surname (Popescu, Munteanu, Calugaroiu, Mazilu...): left out of the guess.
const SURNAME_LIKE = /(escu|eanu|anu|aru|iu|ache|uc|ovici|ici|eac|ean|easa|oaia)$/

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const titleCase = (w: string) => w.split('-').map((p) => (p ? p[0].toLocaleUpperCase('ro-RO') + p.slice(1).toLocaleLowerCase('ro-RO') : p)).join('-')

/** The name as it will be said (up to three words, tidied), or null when the value is not a usable name. */
export function spokenName(raw: string | null | undefined): string | null {
  const s = (raw ?? '').replace(/\s+/g, ' ').trim()
  if (!s || s.length > 60 || /[\d@_/\\]/.test(s)) return null
  const words = s.split(' ').filter((w) => /^[\p{L}'-]+$/u.test(w))
  if (!words.length) return null
  return words.slice(0, 3).map(titleCase).join(' ')
}

/** By the ending alone, for a word not on the lists: -a is a woman's name, -o or a consonant a man's (with exceptions). */
function guess(w: string): 'm' | 'f' | null {
  if (w.length < 3 || UNISEX.has(w) || SURNAME_LIKE.test(w)) return null
  if (MALE_IN_A.has(w)) return 'm'
  if (FEMALE_CONSONANT.has(w)) return 'f'
  if (w.endsWith('a')) return 'f'
  if (/[o]$/.test(w) || /[bcdfghjklmnprstvzșțx]$/.test(w)) return 'm'
  return null
}

const known = (w: string): 'm' | 'f' | null => (UNISEX.has(w) ? null : MALE.has(w) ? 'm' : FEMALE.has(w) ? 'f' : null)

/**
 * 'm' or 'f': from the known given names first (none saying the opposite); otherwise from the endings of the words,
 * when every word that says something agrees. null when unsure, or when a known unisex name is among the words.
 */
export function genderOf(name: string | null | undefined): 'm' | 'f' | null {
  const words = (name ?? '').split(/[\s-]+/).map(plain).filter(Boolean)
  if (words.some((w) => UNISEX.has(w))) return null
  const sure = new Set(words.map(known).filter(Boolean))
  if (sure.size) return sure.size === 1 ? [...sure][0] : null
  const guesses = new Set(words.map(guess).filter(Boolean))
  return guesses.size === 1 ? [...guesses][0] : null
}

/** The given name to check "am I speaking with…": the known given name among the words, else the guessed one, else the first word. */
export function givenName(name: string | null | undefined): string {
  const words = (spokenName(name) ?? '').split(' ').filter(Boolean)
  const g = genderOf(words.join(' '))
  return words.find((w) => known(plain(w))) ?? (g ? words.find((w) => guess(plain(w)) === g) : undefined) ?? words[0] ?? ''
}

/**
 * "doamna Ana", "domnule Ion" (the given name only), "Alex" when unsure, or '' (no usable name). The gender is
 * judged on the whole name as typed, so a surname can veto a guess ("Popa Zorel" → "Zorel").
 */
export function addressee(raw: string | null | undefined): string {
  const full = spokenName(raw)
  if (!full) return ''
  const name = givenName(full)
  const g = genderOf(full)
  return g === 'm' ? `domnule ${name}` : g === 'f' ? `doamna ${name}` : name
}
