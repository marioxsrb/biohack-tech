/**
 * How the AI caller addresses the person: "Bună ziua, doamna Ana!" or "Bună ziua, domnule Ion!". The form takes the
 * name as typed ("Ana Popescu", "Popescu Ana", "ana"): the given name is picked among its words (only it is sent to the
 * voice provider), and "domnule"/"doamna" is added only when it is a given name we know for sure (lists below).
 * Anything unknown or ambiguous (Andrea, Alex, Cristi...) gets the name alone; a value that does not look like a
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
])

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

/** 'm' or 'f' when one of the words is a given name we know for sure (and none says the opposite), otherwise null. */
export function genderOf(name: string | null | undefined): 'm' | 'f' | null {
  const words = (name ?? '').split(/[\s-]+/).map(plain).filter(Boolean)
  const m = words.some((w) => MALE.has(w))
  const f = words.some((w) => FEMALE.has(w))
  return m === f ? null : m ? 'm' : 'f'
}

/** The given name to check "am I speaking with…": the known given name among the words, else the first word. */
export function givenName(name: string | null | undefined): string {
  const words = (spokenName(name) ?? '').split(' ').filter(Boolean)
  return words.find((w) => MALE.has(plain(w)) || FEMALE.has(plain(w))) ?? words[0] ?? ''
}

/** "doamna Ana Popescu", "domnule Ion Popescu", "Alex Popescu" (unknown), or '' (no usable name). */
export function addressee(raw: string | null | undefined): string {
  const name = spokenName(raw)
  if (!name) return ''
  const g = genderOf(name)
  return g === 'm' ? `domnule ${name}` : g === 'f' ? `doamna ${name}` : name
}
