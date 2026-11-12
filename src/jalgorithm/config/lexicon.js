// Concept lexicon: groups English / Filipino / Taglish synonyms and phrases under one tag.
// Patterns are matched against NORMALIZED tokens. A pattern is either a single token
// ('cancel') or a contiguous token sequence (['ibang', 'araw']).
// Tags become features for the rule classifier and extra "#TAG" tokens for the
// statistical classifiers, so a new synonym added here improves all three.

export const CONCEPTS = {
  BOOK: [
    'book', 'reserve', 'reservation', ['mag', 'avail'], ['magpa', 'avail'],
    ['pa', 'schedule'], ['pa', 'appointment'], ['pa', 'book'], ['magpa', 'schedule'], ['magpa', 'appointment'], ['magpa', 'book'],
    ['magpapa', 'schedule'], ['magpapa', 'appointment'], ['magpapa', 'book'], ['nagpa', 'schedule'], ['magpapa', 'makeup'],
    ['set', 'appointment'], ['set', 'schedule'], ['make', 'appointment'], ['make', 'booking'], ['kuha', 'appointment'],
    ['kumuha', 'appointment'], ['mag', 'appointment'], ['mag', 'schedule'], ['mag', 'book'], ['new', 'appointment'],
    ['get', 'appointment'], ['hire'], ['magpaayos'], ['magpa', 'makeup'], ['pa', 'makeup'], ['magpa', 'ayos'],
  ],
  APPT: ['appointment', 'schedule', 'booking', 'reservation', 'slot'],
  WANT: ['gusto', 'want', 'sana', 'need', 'kailangan', ['would', 'like'], 'like', 'balak', 'plan', 'interested'],
  MOVE: [
    'reschedule', 'move', 'ilipat', 'lipat', 'ilipat', 'palitan', 'palit', 'change', 'adjust', 'usog', 'iusog', 'postpone',
    'transfer', 'ipagpaliban', 'urong', 'iurong', 'imbes', 'instead', 'rebook', 'baguhin', ['ibang', 'araw'], ['ibang', 'oras'], ['ibang', 'date'], ['ibang', 'time'],
    ['other', 'day'], ['different', 'day'], ['different', 'time'], ['another', 'day'], ['another', 'time'], ['later', 'date'],
    ['pa', 'move'], ['ipa', 'move'], ['pa', 'reschedule'], ['pa', 'lipat'], ['pa', 'usog'],
  ],
  CANCEL: [
    'cancel', 'cancellation', 'ikansela', 'icancel', 'kanselahin', 'scrap', 'drop', ['hindi', 'na', 'tuloy'], ['hindi', 'na', 'itutuloy'],
    ['wag', 'na', 'ituloy'], ['huwag', 'na', 'ituloy'], ['call', 'off'], ['hindi', 'na', 'push'], ['di', 'na', 'tuloy'],
  ],
  VIEW: [
    'view', 'status', 'details', 'detail', 'reference', 'ref', 'lookup', ['check', 'my'], ['see', 'my'], ['look', 'up'],
    ['confirm', 'kung'], ['naka', 'book', 'ba'], ['nakabook', 'ba'], ['booked', 'ba'], ['did', 'my'], ['still', 'on'],
  ],
  AVAIL: [
    'available', 'availability', 'vacant', 'free', 'vacancy', 'open', ['may', 'slot'], ['meron', 'slot'], ['may', 'available'],
    ['meron', 'available'], ['fully', 'booked'], ['full', 'booked'], ['kaya', 'ba'], ['pwede', 'ba'], ['are', 'you', 'free'],
    ['may', 'bakante'], ['open', 'slot'], ['open', 'slots'], 'slot',
  ],
  // "...kaya ba or ako mag-adjust?": the CLIENT offers to adjust, i.e. asking if a time is possible.
  FLEX: [
    ['ako', 'mag', 'adjust'], ['ako', 'adjust'], ['ako', 'na', 'mag', 'adjust'], ['ako', 'na', 'lang', 'mag', 'adjust'],
    ['ako', 'nalang', 'mag', 'adjust'], ['i', 'adjust'], ['i', 'will', 'adjust'], ['i', 'can', 'adjust'], ['ako', 'na', 'adjust'],
    ['flexible', 'ako'], ['im', 'flexible'], ['i', 'am', 'flexible'], ['kahit', 'anong', 'oras'], ['any', 'time'], ['anytime'],
  ],
  QWHEN: ['kailan', 'when', ['what', 'time'], ['anong', 'oras'], ['ano', 'oras'], ['what', 'date'], ['anong', 'araw'], ['what', 'day']],
  POSS: ['ko', 'my', 'namin', 'natin', 'mine', 'akin', 'ours'],
  PRICE: [
    'magkano', 'price', 'rate', 'cost', 'fee', 'fees', 'halaga', 'singil', 'charge', 'consultation', 'pricing', 'budget',
    ['how', 'much'], ['rate', 'ninyo'], 'mahal', 'mura',
  ],
  SERVICE_Q: [
    'service', 'offer', 'offers', 'inooffer', 'package', 'packages', 'menu', 'ginagawa', 'services', 'specialize',
    ['ano', 'ginagawa'], ['what', 'do', 'you', 'do'], ['ano', 'meron'], ['what', 'can', 'you'], 'options', 'list',
  ],
  LOCATION: [
    'location', 'address', 'where', 'saan', 'nasaan', 'located', 'lugar', 'banda', 'direction', 'directions', 'map',
    'pwesto', 'puwesto', 'area', 'areas', 'cover', 'coverage', 'located', ['taga', 'saan'], 'olongapo', 'zambales', 'branch',
  ],
  HOURS: [
    'hours', 'opening', 'closing', 'close', 'sarado', 'operating', 'magsasara', 'nagbubukas', 'magbubukas',
    ['bukas', 'ba', 'kayo'], ['bukas', 'kayo'], ['open', 'kayo'], ['open', 'ba', 'kayo'], ['are', 'you', 'open'],
    ['hanggang', 'anong', 'oras'], ['hanggang', 'ano', 'oras'], ['until', 'what', 'time'], ['working', 'hours'],
    ['business', 'hours'], ['store', 'hours'], ['open', 'hours'], ['what', 'time', 'you', 'open'], ['bukas', 'kayo', 'ng'],
    ['open', 'on'], ['open', 'every'], 'everyday', 'daily',
  ],
  POLICY: [
    'policy', 'policies', 'rules', 'rule', 'refund', 'refundable', 'downpayment', 'deposit', 'requirement', 'requirements',
    'penalty', 'terms', 'patakaran', ['reservation', 'fee'], ['ilang', 'araw'], ['how', 'many', 'days'], ['in', 'advance'],
    ['advance', 'booking'], ['same', 'day'], ['late', 'cancellation'], ['walk', 'in'], 'walkin', 'advance',
  ],
  GREETING: [
    'hi', 'hello', 'kumusta', 'hola', 'greetings', 'gm', 'yo', 'heyy', ['good', 'morning'], ['good', 'afternoon'],
    ['good', 'evening'], ['good', 'day'], ['magandang', 'umaga'], ['magandang', 'hapon'], ['magandang', 'gabi'], ['magandang', 'araw'],
  ],
  THANKS: ['thanks', 'salamat', ['thank', 'you'], 'appreciated', 'appreciate', 'tenkyu', 'thankyou', ['maraming', 'salamat']],
  NEG: ['hindi', 'not', 'cannot', "can't", 'cant', "won't", 'wont', 'ayaw', 'wag', 'huwag', "don't", 'dont', 'unable', ['can', 'not']],
  ATTEND: [
    'makapunta', 'makakapunta', 'punta', 'pumunta', 'makarating', 'makakarating', 'attend', 'come', 'sipot', 'sisipot',
    'darating', 'dumating', 'makaattend', 'makaka', ['make', 'it'], 'go', 'show', 'makakaabot', 'makaabot', 'aabot',
    'makahabol', 'makakahabol', 'pupunta',
  ],
  ABSENCE: [
    'emergency', 'sick', 'sakit', 'nagkasakit', 'conflict', 'biglaan', 'aberya', 'ospital', 'hospital',
  ],
  GENERAL: [
    'home', ['home', 'service'], 'travel', 'portfolio', 'gcash', 'payment', 'contact', 'number', 'facebook', 'instagram',
    'artist', 'who', 'sino', 'reminder', 'remind', 'pay', 'bayad', 'magbayad', 'samples', 'sample', 'vicky', 'stylist',
    'confirmation', 'transpo', 'pamasahe', 'venue', 'bahay', 'pumupunta', 'puntahan', 'onsite',
  ],
  QUESTION: ['ba', 'paano', 'ano', 'how', 'what', 'can', 'pwede', 'is', 'are', 'do', 'does', '?', 'kaya', 'po'],
  // Clearly unrelated topics. Lets the rule layer vote for OUT_OF_SCOPE instead of letting
  // a stray "saan"/"ano" pull an off-topic message into a salon intent.
  OFFTOPIC: [
    'kumain', 'kain', 'kakain', 'ulam', 'pagkain', 'food', 'gutom', 'hungry', 'masarap', 'luto', 'cook',
    'weather', 'ulan', 'panahon', 'movie', 'song', 'kanta', 'sing', 'crush', 'girlfriend', 'boyfriend',
    'homework', 'assignment', 'laptop', 'computer', 'load', 'pautang', 'utang', 'inom', 'tagay',
    'joke', 'robot', 'news', 'basketball', 'math', 'translate', 'bored', 'favorite', 'shoes',
  ],
}

// Words that are correct as written and must never be "fixed" by the fuzzy corrector,
// plus ordinary function words in both languages. Anything in here (or in CONCEPTS,
// service aliases, or date/time words) counts as in-vocabulary.
export const KNOWN_WORDS = new Set(`
  a an the and or but if then so to of in on at for with from by as is are was were be been am do does did
  i me my you your we our they them he she it its this that these those there here what which who whom whose
  how when where why can could will would should shall may might must have has had not no yes yeah yep nope
  please ok okay sure just only also too very really still already again maybe now later soon today tomorrow
  ako ko akin ikaw ka mo ikaw kayo ninyo nyo kami namin tayo natin sila nila siya niya ito iyan iyon yun yan
  ang ng mga sa si ni kay na pa ba po opo oo hindi di wala walang meron may naman lang nalang talaga rin din
  ay kasi sana kung kapag pag pero tapos saka at o eh ah hm hmm uy uhm kahit basta yung dito diyan doon jan
  ano anong paano bakit sino kailan saan nasaan ilan magkano gaano alin
  gusto ayaw kailangan pwede puwede kaya baka sige game tara teka wait
  araw oras umaga tanghali hapon gabi linggo buwan taon ngayon bukas mamaya kahapon makalawa susunod sunod nakaraan
  morning afternoon evening night noon midnight week weekend month year day time date
  monday tuesday wednesday thursday friday saturday sunday lunes martes miyerkules miyerkoles huwebes biyernes sabado
  alas una dos tres kwatro kuwatro singko sais syete siyete otso nuwebe diyes onse dose medya y
  january february march april may june july august september october november december
  enero pebrero marso abril mayo hunyo hulyo agosto setyembre oktubre nobyembre disyembre
  makeup hair buhok bridal bride wedding kasal debut event party package personal styling hairstyle
  salon parlor artist vicky olongapo subic castillejos san antonio zambales
  kumain kain tubig weather panahon ulan init lamig love mahal crush joke biro game play song kanta movie
  name pangalan number contact phone cellphone cp email
  thanks salamat thank welcome bye paalam ingat
  book booking appointment schedule reschedule cancel available slot price rate fee consultation location address
  hours open close service offer
`.split(/\s+/).filter(Boolean))

// Words the fuzzy corrector is allowed to correct TOWARDS (domain vocabulary only).
// Keeping this list small is what prevents false corrections of ordinary words.
export const FUZZY_TARGETS = [
  'appointment', 'schedule', 'reschedule', 'booking', 'cancel', 'cancellation', 'available', 'availability',
  'reservation', 'consultation', 'location', 'address', 'magkano', 'makeup', 'bridal', 'wedding', 'package',
  'service', 'hairstyle', 'styling', 'tomorrow', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday',
  'saturday', 'sunday', 'miyerkules', 'huwebes', 'biyernes', 'sabado', 'makapunta', 'makakapunta',
  'debutante', 'entourage', 'portfolio', 'operating', 'salamat', 'thanks', 'kumusta', 'pwede', 'paano',
  'reference', 'available', 'postpone', 'ngayon', 'mamaya', 'umaga', 'hapon',
]

// Reply language detection: tokens that strongly indicate Filipino.
export const FILIPINO_MARKERS = new Set(`
  ako ko akin ikaw ka mo kayo ninyo kami namin tayo natin sila siya ang ng mga sa si na pa ba po opo oo hindi
  wala meron may naman lang nalang talaga rin din kasi sana kung pero tapos yung dito ano anong paano bakit sino
  kailan saan nasaan magkano gusto pwede kaya baka sige bukas ngayon mamaya umaga hapon gabi linggo araw oras
  makapunta makakapunta punta lipat palitan salamat kumusta magandang magpa magpapa mag pa nag lunes martes
  miyerkules huwebes biyernes sabado alas ilang hanggang meron magkano kahit dyan jan ninyo pala ay
`.split(/\s+/).filter(Boolean))

export const ENGLISH_MARKERS = new Set(`
  i me my you your we our the a an is are was can could would will do does did what when where how which
  please want like need have has available book appointment schedule cancel reschedule price much hours open
  tomorrow today thanks thank hello hi there any slot time date location address service offer sorry not
`.split(/\s+/).filter(Boolean))

// Short confirmations / denials used while the bot waits for a yes/no answer.
export const YES_WORDS = new Set(['oo', 'opo', 'yes', 'yep', 'yup', 'yeah', 'sige', 'sure', 'okay', 'ok', 'game', 'go', 'tama', 'correct', 'confirm', 'confirmed', 'ayos', 'tuloy', 'proceed', 'g', 'oks', 'oki', 'goods', 'ge', 'yes po', 'push'])
export const NO_WORDS = new Set(['hindi', 'no', 'nope', 'ayaw', 'wag', 'huwag', 'mali', 'wrong', 'teka', 'nah', 'di'])

// Phrases that abort the active conversation flow (matched on the whole normalized message).
export const RESET_PHRASES = [
  ['reset'], ['start', 'over'], ['ulit', 'tayo'], ['umpisa', 'ulit'], ['never', 'mind'], ['nevermind'], ['stop'],
  ['wag', 'na'], ['huwag', 'na'], ['wag', 'nalang'], ['huwag', 'nalang'], ['wag', 'na', 'lang'], ['wag', 'na', 'pala'],
  ['huwag', 'na', 'lang'], ['hindi', 'na', 'lang'], ['hindi', 'na', 'pala'], ['forget', 'it'], ['quit'], ['exit'],
]
