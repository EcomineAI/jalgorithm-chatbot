// DEFAULT salon facts. The live values are edited by the owner in the Owner's panel and stored
// in Supabase (business_profile, services, booking_settings); src/services/businessInfo.js loads
// them into a catalog of this same shape. These defaults are only used when Supabase can't be
// reached and nothing is cached yet, and as the seed values of the migration.
// Scheduling rules are ENFORCED by the Supabase functions; here they only describe them to clients.

export const business = {
  name: "Vicky's Parlor",
  artist: 'Vicky',
  location: 'Olongapo City, Zambales',
  // Not set yet; the bot says so instead of inventing details.
  contact: null,
  portfolio: null,
  paymentMethods: null,
  hours: { open: '08:00', close: '19:00', days: 'daily' },
  consultationFee: null, // not on record; the bot says so instead of inventing a number
  travelAreas: ['Subic', 'Castillejos', 'San Antonio'],
  rules: {
    minAdvanceDays: 3,
    reservationFee: 1000,
    reservationFeeServices: ['bridal', 'wedding_package'],
    cancelCutoffHours: 24,
    rescheduleCutoffHours: 24,
  },
}

// `aliases` are matched against NORMALIZED text (see pipeline/normalizer.js), longest first.
export const services = [
  {
    key: 'bridal',
    name: 'Bridal Makeup (full)',
    price: 3500,
    aliases: ['bridal makeup', 'bridal', 'bride', 'ikakasal', 'kasal makeup', 'wedding makeup'],
  },
  {
    key: 'event_makeup',
    name: 'Event / Debut Makeup',
    price: 2000,
    aliases: ['event makeup', 'debut makeup', 'event', 'debut', 'debutante', 'party', 'prom', 'js prom', 'graduation', 'pageant', 'birthday', '18th birthday'],
  },
  {
    key: 'personal_makeup',
    name: 'Personal Makeup',
    price: 800,
    aliases: ['personal makeup', 'personal', 'simple makeup', 'everyday makeup', 'regular makeup'],
  },
  {
    key: 'hair_styling',
    name: 'Hair Styling',
    price: 500,
    aliases: ['hair styling', 'hairstyle', 'hair style', 'hairdo', 'hair do', 'updo', 'kulot', 'curls', 'ayos ng buhok', 'buhok', 'hair'],
  },
  {
    key: 'hair_makeup',
    name: 'Hair + Makeup Package',
    price: 2500,
    aliases: ['hair and makeup', 'hair at makeup', 'hair makeup', 'makeup and hair', 'hmu', 'hair makeup package'],
  },
  {
    key: 'wedding_package',
    name: 'Wedding Package (bride + entourage)',
    price: 8000,
    aliases: ['wedding package', 'entourage', 'bride and entourage', 'wedding'],
  },
]

// Topic-specific answers for GENERAL_INQUIRY. `keywords` are normalized tokens.
export const faqTopics = [
  { id: 'home_service', keywords: ['home', 'service', 'travel', 'puntahan', 'pumupunta', 'bahay', 'venue', 'onsite'] },
  { id: 'travel_fee', keywords: ['travel', 'fee', 'transpo', 'pamasahe', 'subic', 'castillejos'] },
  { id: 'portfolio', keywords: ['portfolio', 'sample', 'samples', 'work', 'gawa', 'facebook', 'instagram', 'page', 'pictures'] },
  { id: 'contact', keywords: ['contact', 'number', 'phone', 'call', 'text', 'message', 'reach'] },
  { id: 'confirmation', keywords: ['confirm', 'confirmation', 'confirmed', 'sure'] },
  { id: 'artist', keywords: ['artist', 'who', 'sino', 'vicky', 'stylist', 'mua'] },
  { id: 'payment', keywords: ['payment', 'pay', 'gcash', 'cash', 'bayad', 'magbayad', 'downpayment', 'bank'] },
  { id: 'reminder', keywords: ['reminder', 'remind', 'paalala', 'notify'] },
]

/** The catalog JAlgorithm runs on: { business, services, faqTopics }. */
export function defaultCatalog() {
  return structuredClone({ business, services, faqTopics })
}
