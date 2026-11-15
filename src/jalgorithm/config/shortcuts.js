// Token-level normalization dictionaries.
//
// Every entry replaces ONE whole token (never a substring), so "b" in "bukas" is never touched.
// Entries may carry a `when(ctx)` guard; the replacement only happens if the guard returns true.
// ctx = { prev, next, index, count, tokens }  (all lowercase, already-normalized-so-far tokens)
//
// To add a shortcut: add a key here. To stop a false correction: tighten its `when` guard
// or add the word to PROTECTED_WORDS in lexicon.js.

const FILLERS = new Set(['ok', 'okay', 'sige', 'cge', 'sure', 'ge', 'oo', 'yes', 'hmm', 'hm', 'ah', 'eh', 'k'])
const PLACE_AFTER_SAN = new Set(['antonio', 'fernando', 'marcelino', 'narciso', 'felipe', 'juan', 'pablo', 'jose', 'miguel', 'rafael'])
const LETTER_CONTEXT = new Set(['plan', 'option', 'letter', 'grade', 'vitamin', 'size', 'type', 'block', 'lot', 'room', 'phase', 'section'])
const SA_NEXT = new Set([
  'jan', 'january', 'enero', 'feb', 'february', 'pebrero', 'mar', 'march', 'marso', 'apr', 'april', 'abril',
  'may', 'mayo', 'jun', 'june', 'hunyo', 'jul', 'july', 'hulyo', 'aug', 'august', 'agosto',
  'sep', 'sept', 'september', 'setyembre', 'oct', 'october', 'oktubre', 'nov', 'november', 'nobyembre', 'dec', 'december', 'disyembre',
  'mon', 'monday', 'lunes', 'tue', 'tuesday', 'martes', 'wed', 'wednesday', 'miyerkules', 'thu', 'thursday', 'huwebes',
  'fri', 'friday', 'biyernes', 'sat', 'saturday', 'sabado', 'sun', 'sunday', 'linggo',
  'bks', 'bukas', 'tmr', 'tomorrow', 'umaga', 'hapon', 'gabi', 'venue', 'bahay', 'salon', 'parlor', 'olongapo', 'subic', 'clark',
])

const notFirst = (ctx) => ctx.index > 0
const isWord = (t) => typeof t === 'string' && /^[a-zñ]/.test(t)

/** Plain one-to-one shortcut/variant map (no context needed). */
export const SIMPLE_SHORTCUTS = {
  // pronouns / particles
  aq: 'ako', aqo: 'ako', ako: 'ako', akoh: 'ako',
  kau: 'kayo', kyo: 'kayo', kau2: 'kayo',
  nyo: 'ninyo', niyo: 'ninyo', nio: 'ninyo',
  nmn: 'naman', nman: 'naman',
  lng: 'lang', lang: 'lang', nlng: 'nalang', nlang: 'nalang', nalng: 'nalang',
  sna: 'sana', cna: 'sana',
  kc: 'kasi', kse: 'kasi', kasi: 'kasi',
  ung: 'yung', yng: 'yung', yong: 'yung', iyong: 'yung', yun: 'yun',
  poh: 'po', pow: 'po',
  dn: 'din', rn: 'rin',
  tlga: 'talaga', tlaga: 'talaga',
  mrn: 'meron', mron: 'meron', mern: 'meron', meron: 'meron', mayron: 'meron', merun: 'meron',
  wla: 'wala', wlang: 'walang',
  cge: 'sige', sge: 'sige', sigi: 'sige',
  opo: 'opo', oo: 'oo',
  // question words
  pno: 'paano', pano: 'paano', pnu: 'paano', panu: 'paano',
  anu: 'ano', anung: 'anong', anu2: 'ano',
  kelan: 'kailan', klan: 'kailan', kln: 'kailan', kailn: 'kailan', kelanpo: 'kailan po', sanpo: 'saan po',
  sn: 'saan',
  cnu: 'sino', snu: 'sino',
  wat: 'what', wht: 'what', wen: 'when', whn: 'when', whr: 'where', wer: 'where', hw: 'how', mch: 'much',
  u: 'you', yu: 'you', ur: 'your', r: 'are',
  // modal / request
  pwde: 'pwede', pde: 'pwede', pwd: 'pwede', puede: 'pwede', pued: 'pwede', pwed: 'pwede', pede: 'pwede', puwede: 'pwede', pwedi: 'pwede', pdi: 'pwede', pwedeng: 'pwede', pdeng: 'pwede',
  gsto: 'gusto', gstu: 'gusto', gus2: 'gusto', gusto: 'gusto', gsto2: 'gusto',
  bka: 'baka', sguro: 'siguro',
  pki: 'paki', pkiusap: 'pakiusap',
  // "p" glued to a verb as a request prefix: "pbook", "psched", "pcancel"
  // (a target may contain several words; each becomes its own token)
  pbook: 'pa book', pabook: 'pa book', psched: 'pa schedule', pcancel: 'pa cancel', pacancel: 'pa cancel', presched: 'pa reschedule', paresched: 'pa reschedule', pmove: 'pa move', pbking: 'pa booking', pacheck: 'pa check', pcheck: 'pa check', pkicheck: 'paki check', pkibook: 'paki book', pkicancel: 'paki cancel', pkimove: 'paki move', pkiresched: 'paki reschedule', palipat: 'pa lipat', ptnong: 'pa tanong', itanong: 'tanong', tnong: 'tanong',
  pls: 'please', plz: 'please', pleas: 'please',
  mgpapa: 'magpapa', mgpa: 'magpa', mg: 'mag', ngpa: 'nagpa', ngpapa: 'nagpapa',
  // attendance & conversational tokens
  mkapunta: 'makapunta', mkpunta: 'makapunta', mkakapunta: 'makakapunta', mkkpunta: 'makakapunta', mkkapunta: 'makakapunta',
  mkarating: 'makarating', mkakarating: 'makakarating', pnta: 'punta', pmunta: 'pumunta',
  mna: 'muna', sndali: 'sandali', tka: 'teka',
  nklmutan: 'nakalimutan', nkalimutan: 'nakalimutan', naklimutan: 'nakalimutan', lmot: 'limot',
  // dates and times
  bks: 'bukas', bkas: 'bukas', bkaz: 'bukas', bukaz: 'bukas',
  mamya: 'mamaya', mmya: 'mamaya',
  ngyon: 'ngayon', ngaun: 'ngayon', ngayn: 'ngayon', ngayun: 'ngayon', ngyn: 'ngayon',
  tmrw: 'tomorrow', tmr: 'tomorrow', tomo: 'tomorrow', tom: 'tomorrow', tomm: 'tomorrow', tomorow: 'tomorrow', tommorow: 'tomorrow', tommorrow: 'tomorrow', tommorw: 'tomorrow',
  tdy: 'today', '2day': 'today',
  hr: 'hour', hrs: 'hours',
  calltime: 'call time',
  wk: 'week', nxt: 'next', nxtweek: 'next week', nxtwk: 'next week', nxtmonth: 'next month', thiswk: 'this week', wknd: 'weekend',
  // domain words and their common misspellings
  sched: 'schedule', sked: 'schedule', skedyul: 'schedule', schedul: 'schedule', schedle: 'schedule', shedule: 'schedule', schdule: 'schedule', iskedyul: 'schedule',
  resched: 'reschedule', rsched: 'reschedule', resked: 'reschedule', reskedyul: 'reschedule', rescheduled: 'reschedule', reschedul: 'reschedule', rescheduel: 'reschedule', reshedule: 'reschedule',
  chaneg: 'change', cahnge: 'change', chng: 'change', chge: 'change',
  upd: 'update', updt: 'update',
  numb: 'number', num: 'number', nmber: 'number', mob: 'mobile', cel: 'cellphone', contct: 'contact', cntact: 'contact', phne: 'phone',
  appt: 'appointment', appnt: 'appointment', apt: 'appointment', appoint: 'appointment',
  appoinemt: 'appointment', appointmnt: 'appointment', apointment: 'appointment', appoitment: 'appointment',
  apoyntment: 'appointment', appointmet: 'appointment', appoinment: 'appointment', apointmnt: 'appointment',
  appontment: 'appointment', appointement: 'appointment', appointmen: 'appointment', appoinmet: 'appointment', apoinment: 'appointment',
  appointments: 'appointment',
  bking: 'booking', bkng: 'booking', bok: 'book', buk: 'book', bookings: 'booking',
  cancl: 'cancel', cancle: 'cancel', cansel: 'cancel', kansel: 'cancel', kansela: 'cancel', cancelled: 'cancel', canceled: 'cancel', cncl: 'cancel', cancell: 'cancel',
  avl: 'available', avbl: 'available', availabl: 'available', availble: 'available', avaiable: 'available', availabe: 'available', avalable: 'available', availbility: 'availability', bakante: 'available', bakanteng: 'available',
  magkno: 'magkano', mgkano: 'magkano', mkano: 'magkano', mgkno: 'magkano', magkanu: 'magkano', mgknu: 'magkano', mgkanu: 'magkano', hmpo: 'magkano po',
  mutch: 'much', hmuch: 'how much', howmuch: 'how much',
  byad: 'bayad', bayd: 'bayad', pmbayad: 'pambayad', pg: 'pag',
  downpayment: 'downpayment', pymnt: 'payment', paymnt: 'payment',
  nagsasara: 'magsasara', ngsasara: 'magsasara', magsara: 'magsasara',
  presyo: 'price', prices: 'price', pricelist: 'price', rates: 'rate',
  cons: 'consultation', consult: 'consultation', konsulta: 'consultation', consultasyon: 'consultation', konsultasyon: 'consultation',
  loc: 'location', locn: 'location', lokasyon: 'location', addr: 'address', adress: 'address', addres: 'address', veneu: 'venue',
  mkeup: 'makeup', make: 'make', mekap: 'makeup', makup: 'makeup', makeyup: 'makeup',
  bridl: 'bridal', debu: 'debut', bday: 'birthday', grad: 'graduation', entourge: 'entourage', bridesmad: 'bridesmaid',
  incl: 'inclusion', incls: 'inclusions', addtl: 'additional', addl: 'additional',
  serbisyo: 'service', services: 'service', servces: 'service', srvice: 'service',
  slots: 'slot', slt: 'slot',
  ty: 'thanks', tysm: 'thanks', tnx: 'thanks', thx: 'thanks', tnks: 'thanks', thanks: 'thanks', thank: 'thanks', tenks: 'thanks', tnku: 'thanks',
  slmt: 'salamat', salamt: 'salamat', slamat: 'salamat',
  helo: 'hello', hellow: 'hello', hlo: 'hello', hai: 'hi', hii: 'hi', hey: 'hi', hoy: 'hi',
  musta: 'kumusta', kamusta: 'kumusta', kmusta: 'kumusta',
  oras: 'oras', orasan: 'oras',
  gantong: 'ganitong', gnitong: 'ganitong', ganto: 'ganito', gnito: 'ganito',
  im: 'im', "i'm": 'im', iam: 'im',
}

/** Shortcuts whose expansion depends on surrounding tokens. */
export const CONTEXT_SHORTCUTS = {
  // "d q mkapunta" → hindi ko makapunta; but keep "plan d", "d" at the end, "d 5" etc.
  d: { to: 'hindi', when: (c) => isWord(c.next) && !LETTER_CONTEXT.has(c.prev) },
  di: { to: 'hindi', when: (c) => c.next !== undefined },
  'di\'': { to: 'hindi' },
  q: { to: 'ko', when: (c) => !LETTER_CONTEXT.has(c.prev) },
  b: { to: 'ba', when: (c) => notFirst(c) && !LETTER_CONTEXT.has(c.prev) },
  n: { to: 'na', when: (c) => notFirst(c) && !LETTER_CONTEXT.has(c.prev) },
  p: { to: 'pa', when: (c) => notFirst(c) && !LETTER_CONTEXT.has(c.prev) },
  s: { to: 'sa', when: (c) => notFirst(c) && !LETTER_CONTEXT.has(c.prev) && (SA_NEXT.has(c.next) || /^\d/.test(c.next ?? '')) },
  // "hm po cons?" → magkano; "hmm ok sige" stays an interjection
  hm: { to: 'magkano', when: (c) => c.count > 1 && c.next !== undefined && !FILLERS.has(c.next) },
  hmm: { to: 'magkano', when: (c) => c.count > 1 && c.next === 'po' },
  // "san loc nyo" → saan; "san antonio" stays a place name
  san: { to: 'saan', when: (c) => !PLACE_AFTER_SAN.has(c.next) },
  // "k" alone or "k po" means okay
  k: { to: 'okay', when: (c) => c.count <= 2 },
  g: { to: 'game', when: (c) => c.count <= 2 && c.next !== 'ba' },
  bet: { to: 'gusto', when: (c) => ['ko', 'namin', 'natin', 'q', 'yan', 'yun', 'to'].includes(c.next) },
  pass: { to: 'ayaw', when: (c) => ['muna', 'na'].includes(c.next) || c.count <= 2 },
  push: { to: 'tuloy', when: (c) => ['natin', 'na', 'ko', 'tayo', 'tau'].includes(c.next) || c.prev === 'pa' || c.count <= 2 },
  // "mag avail ng bridal" = avail of a service (book); "may avail ba" = available
  avail: { to: 'available', when: (c) => !['mag', 'magpa', 'nag', 'ma'].includes(c.prev) },
  // "4 pm" / "4 am" glued by tokenizer already; "pm" here means private message only when alone
  pm: { to: 'message', when: (c) => c.count <= 3 && !/^\d/.test(c.prev ?? '') },
}

/**
 * Filipino verbal prefixes that attach to (often English) roots:
 * "magpabook", "nagpaschedule", "ipacancel", "makapag-reschedule".
 * Ordered longest first. A prefix is only split off when the remainder is a known ROOT,
 * so ordinary words like "mahal" or "paano" are never split.
 */
export const PREFIX_CANONICAL = {
  mgpapa: 'magpapa',
  mgpa: 'magpa',
  ngpapa: 'nagpapa',
  ngpa: 'nagpa',
  pakipa: 'pakipa',
  pki: 'paki',
  mg: 'mag',
}

export const PREFIXES = [
  'makapagpa', 'makapag', 'magpapa', 'nagpapa', 'mgpapa', 'ngpapa', 'pakipa', 'pinapa', 'ipapa', 'mapapa', 'makaka', 'nakaka',
  'magpa', 'nagpa', 'mgpa', 'ngpa', 'ipina', 'paki', 'pki', 'ipa', 'mag', 'nag', 'maka', 'naka', 'mg', 'ika', 'pa', 'ma', 'na', 'i',
]

export const PREFIX_ROOTS = new Set([
  'book', 'booking', 'schedule', 'reschedule', 'appointment', 'cancel', 'move', 'reserve', 'set',
  'available', 'avail', 'resched', 'sched', 'appoint', 'adjust', 'lipat', 'palit', 'usog', 'confirm',
  'makeup', 'ayos', 'check', 'change', 'update', 'postpone', 'hair', 'consult', 'consultation',
  'bayad', 'inquire', 'tanong', 'gupit', 'kulay', 'retouch', 'sara', 'bukas', 'open', 'close',
])
