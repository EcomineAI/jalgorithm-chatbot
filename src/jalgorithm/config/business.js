// DEFAULT salon facts. The live values are edited by the owner in the Owner's panel and stored
// in Supabase (business_profile, services, booking_settings); src/services/businessInfo.js loads
// them into a catalog of this same shape. These defaults are only used when Supabase can't be
// reached and nothing is cached yet, and as the seed values of the migration.
// Scheduling rules are ENFORCED by the Supabase functions; here they only describe them to clients.

export const SHOWCASE_GALLERY_URLS = [
  'https://images.pexels.com/photos/38707938/pexels-photo-38707938.jpeg?auto=compress&cs=tinysrgb&w=900',
  'https://images.pexels.com/photos/35341712/pexels-photo-35341712.jpeg?auto=compress&cs=tinysrgb&w=900',
  'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=900&q=80&fit=crop',
  'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=900&q=80&fit=crop',
  'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=900&q=80&fit=crop',
  'https://images.unsplash.com/photo-1583784561126-c18e59057f3b?w=900&q=80&fit=crop',
  'https://images.unsplash.com/photo-1512178295672-8e697a3412f4?w=900&q=80&fit=crop',
  'https://images.unsplash.com/photo-1500840216050-6ffa99d75160?w=900&q=80&fit=crop',
]

export const SHOWCASE_SERVICE_IMAGES = {
  bridal: 'https://images.pexels.com/photos/38707938/pexels-photo-38707938.jpeg?auto=compress&cs=tinysrgb&w=900',
  event_makeup: 'https://images.pexels.com/photos/35341712/pexels-photo-35341712.jpeg?auto=compress&cs=tinysrgb&w=900',
  personal_makeup: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=900&q=80&fit=crop',
  hair_styling: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=900&q=80&fit=crop',
  hair_makeup: 'https://images.unsplash.com/photo-1583784561126-c18e59057f3b?w=900&q=80&fit=crop',
  wedding_package: 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=900&q=80&fit=crop',
}

export const DEFAULT_HERO_PHOTO_URL =
  'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1400&q=90&fit=crop'

export const DEFAULT_ARTIST_PHOTO_URL =
  'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=900&q=80&fit=crop'

export const business = {
  name: "Vicky's Parlor",
  artist: 'Vicky',
  location: 'Olongapo City, Zambales',
  experienceYears: '5+ yrs',
  aboutBio:
    "Professional freelance hair and makeup artist based in Olongapo City, Zambales. Specializing in bridal, debut, and event looks, bringing out every client's natural beauty with a personalized touch.",
  specialtyTags: ['Bridal', 'Debut', 'Events', 'Home Service', 'Hair Styling'],
  heroPhotoUrl: DEFAULT_HERO_PHOTO_URL,
  artistPhotoUrl: DEFAULT_ARTIST_PHOTO_URL,
  galleryUrls: [...SHOWCASE_GALLERY_URLS],
  // Not set yet; the bot says so instead of inventing details.
  contact: null,
  portfolio: null,
  messengerUrl: null,
  paymentMethods: null,
  hours: { open: '08:00', close: '19:00', days: 'daily' },
  consultationFee: null, // not on record; the bot says so instead of inventing a number
  travelAreas: ['Subic', 'Castillejos', 'San Antonio'],
  freeTravelAreas: [],
  travelFeeNote: null,
  additionalHeadPrice: null,
  additionalHeadNote: null,
  rules: {
    minAdvanceDays: 3,
    reservationFee: 1000,
    reservationFeeServices: ['bridal', 'wedding_package'],
    cancelCutoffHours: 24,
    rescheduleCutoffHours: 24,
    weddingDownpaymentPercent: null,
    weddingCancelCutoffDays: null,
    eventDownpaymentPercent: null,
    eventCancelCutoffDays: null,
    sameDayRushNote: null,
  },
}

// `aliases` are matched against NORMALIZED text (see pipeline/normalizer.js), longest first.
export const services = [
  {
    key: 'bridal',
    name: 'Bridal Makeup (full)',
    price: 3500,
    durationMinutes: 180,
    description: 'Full glam for your wedding day',
    inclusions: 'Full skin prep, long-wear HD bridal makeup, false lashes, bridal hairstyling, and ceremony touch-up prep',
    aliases: ['bridal makeup', 'bridal', 'bride', 'ikakasal', 'kasal makeup', 'wedding makeup'],
    imageUrl: SHOWCASE_SERVICE_IMAGES.bridal,
    showOnLanding: true,
  },
  {
    key: 'event_makeup',
    name: 'Event / Debut Makeup',
    price: 2000,
    durationMinutes: 120,
    description: 'Debuts, parties, and special events',
    inclusions: 'Skin prep, long-wear event glam, false lashes, and styled hair',
    aliases: ['special events', 'event makeup', 'debut makeup', 'event', 'debut', 'debutante', 'party', 'prom', 'js prom', 'graduation', 'pageant', 'birthday', '18th birthday'],
    imageUrl: SHOWCASE_SERVICE_IMAGES.event_makeup,
    showOnLanding: false,
  },
  {
    key: 'personal_makeup',
    name: 'Personal Makeup',
    price: 800,
    durationMinutes: 90,
    description: 'Clean everyday glam and shoots',
    inclusions: 'Basic skin prep, soft natural makeup finish, and light hair touch',
    aliases: ['everyday glam', 'day to day glam', 'personal makeup', 'personal', 'simple makeup', 'everyday makeup', 'regular makeup'],
    imageUrl: SHOWCASE_SERVICE_IMAGES.personal_makeup,
    showOnLanding: true,
  },
  {
    key: 'hair_styling',
    name: 'Hair Styling',
    price: 500,
    durationMinutes: 60,
    description: 'Updos and event-ready styles',
    inclusions: 'Blowdry, curls or formal updo, setting spray, and hairpins',
    aliases: ['hairstyling', 'hair styling', 'hairstyle', 'hair style', 'hairdo', 'hair do', 'updo', 'kulot', 'curls', 'ayos ng buhok', 'buhok', 'hair'],
    imageUrl: SHOWCASE_SERVICE_IMAGES.hair_styling,
    showOnLanding: true,
  },
  {
    key: 'hair_makeup',
    name: 'Hair + Makeup Package',
    price: 2500,
    durationMinutes: 150,
    description: 'Hair + makeup for events and entourages',
    inclusions: 'Event hairstyling combo with full long-wear makeup and false lashes',
    aliases: ['hair and makeup', 'hair at makeup', 'hair makeup', 'makeup and hair', 'hmu', 'hair makeup package'],
    imageUrl: SHOWCASE_SERVICE_IMAGES.hair_makeup,
    showOnLanding: true,
  },
  {
    key: 'wedding_package',
    name: 'Wedding Package (bride + entourage)',
    price: 8000,
    durationMinutes: 300,
    description: 'Bride and entourage package',
    inclusions: 'Full bridal makeup & hair plus coordinated styling for wedding entourage',
    aliases: ['wedding package', 'entourage', 'bride and entourage', 'wedding'],
    imageUrl: SHOWCASE_SERVICE_IMAGES.wedding_package,
    showOnLanding: false,
  },
]

// Topic-specific answers for GENERAL_INQUIRY. `keywords` are normalized tokens.
export const faqTopics = [
  { id: 'home_service', keywords: ['home', 'service', 'travel', 'puntahan', 'pumupunta', 'bahay', 'venue', 'onsite', 'location'] },
  { id: 'travel_fee', keywords: ['travel', 'fee', 'transpo', 'pamasahe', 'subic', 'castillejos', 'clark', 'zambales', 'toll', 'outoftown'] },
  { id: 'inclusions', keywords: ['inclusion', 'inclusions', 'include', 'includes', 'included', 'kasama', 'kasali', 'difference', 'pinagkaiba', 'kaibahan', 'compare', 'step', 'steps'] },
  { id: 'additional_heads', keywords: ['additional', 'dagdag', 'extra', 'head', 'heads', 'person', 'pax', 'kasabay', 'companion', 'bridesmaid', 'bridesmaids'] },
  { id: 'portfolio', keywords: ['portfolio', 'sample', 'samples', 'work', 'gawa', 'facebook', 'instagram', 'page', 'pictures'] },
  { id: 'contact', keywords: ['contact', 'number', 'phone', 'call', 'text', 'message', 'reach', 'messenger', 'fb'] },
  { id: 'confirmation', keywords: ['confirm', 'confirmation', 'confirmed', 'sure', 'secure'] },
  { id: 'artist', keywords: ['artist', 'who', 'sino', 'vicky', 'trev', 'stylist', 'mua', 'team'] },
  { id: 'payment', keywords: ['payment', 'pay', 'gcash', 'cash', 'bayad', 'magbayad', 'downpayment', 'bank', 'dp', 'reservation', 'contract'] },
  { id: 'reminder', keywords: ['reminder', 'remind', 'paalala', 'notify'] },
]

/** Quick-load Owner Panel preset based on the Makeup and Hair by Trev Luna interview. */
export const BENEFICIARY_PRESET_TREV_LUNA = {
  key: 'trev_luna',
  label: 'Makeup and Hair by Trev Luna',
  profile: {
    name: 'Makeup and Hair by Trev Luna',
    artist: 'Trev Luna',
    location: 'Olongapo City, Zambales',
    experience_years: '5+ yrs',
    about_bio:
      'Trev Luna is a professional hair and makeup artist based in Olongapo City with over 5 years of experience, working with a dedicated styling team. Available for on-location client venues and studio bookings for weddings, debuts, special events, and everyday glam.',
    specialty_tags: ['Bridal', 'Debut', 'Special Events', 'Everyday Glam', 'Hairstyling', 'On-Location'],
    contact: 'Message via Facebook / Instagram Page (SMS on inquiry)',
    portfolio_url: 'https://www.facebook.com/',
    messenger_url: 'https://m.me/',
    payment_methods: 'GCash, Bank Transfer, Cash Down Payment (send proof on our Page)',
    consultation_fee: null,
    travel_areas: ['Zambales', 'Clark', 'Castillejos', 'San Antonio'],
    free_travel_areas: ['Olongapo City', 'Subic Bay'],
    travel_fee_note:
      'Subic Bay is already inclusive in packages. Out-of-town fees apply for Zambales areas and Clark depending on distance, toll fees, car rental, gas, and driver. Message our page for an exact transpo quote.',
    additional_head_price: 1000,
    additional_head_note:
      'Additional heads for weddings or group bookings start at PHP 1,000 per person (final rate depends on makeup and hair requirements). Message our page for group quotes.',
    reservation_fee: 1000,
    reservation_fee_services: ['bridal', 'wedding_package', 'event_makeup', 'hair_makeup'],
    wedding_downpayment_percent: 40,
    wedding_cancel_cutoff_days: 30,
    event_downpayment_percent: '10% to 20%',
    event_cancel_cutoff_days: 3,
    same_day_rush_note:
      'Standard bookings require at least 7 days advance notice. Same-day or on-the-day rush bookings may be accepted subject to team availability at a slightly higher rate. Message our page directly to check urgent slots.',
    hero_photo_url: DEFAULT_HERO_PHOTO_URL,
    artist_photo_url: DEFAULT_ARTIST_PHOTO_URL,
    gallery_urls: [...SHOWCASE_GALLERY_URLS],
  },
  services: [
    {
      key: 'bridal',
      name: 'Bridal Makeup (Full Package)',
      price: 5000,
      duration_minutes: 180,
      aliases: ['bridal makeup', 'bridal', 'bride', 'ikakasal', 'kasal makeup', 'wedding makeup'],
      description: 'Full bridal glam with skin prep and ceremony styling',
      inclusions:
        'Full skin prep, long-wear HD bridal makeup, false lashes and lens prep, bridal hairstyling, and ceremony retouch assistance (more detailed than standard event glam)',
      image_url: SHOWCASE_SERVICE_IMAGES.bridal,
      show_on_landing: true,
      active: true,
    },
    {
      key: 'event_makeup',
      name: 'Special Events & Debut Makeup',
      price: 2500,
      duration_minutes: 120,
      aliases: ['special events', 'event makeup', 'debut makeup', 'event', 'debut', 'debutante', 'party', 'prom', 'js prom', 'graduation', 'pageant', 'birthday', '18th birthday'],
      description: 'Glam look for debuts, birthdays, and special events',
      inclusions: 'Skin prep, long-wear event makeup, false lashes, and styled hair',
      image_url: SHOWCASE_SERVICE_IMAGES.event_makeup,
      show_on_landing: true,
      active: true,
    },
    {
      key: 'personal_makeup',
      name: 'Everyday Glam',
      price: 1500,
      duration_minutes: 90,
      aliases: ['everyday glam', 'day to day glam', 'personal makeup', 'personal', 'simple makeup', 'everyday makeup', 'regular makeup'],
      description: 'Fresh day-to-day glam for shoots and casual gatherings',
      inclusions: 'Hydrating skin prep, soft everyday glam finish, natural lashes, and light hair styling',
      image_url: SHOWCASE_SERVICE_IMAGES.personal_makeup,
      show_on_landing: true,
      active: true,
    },
    {
      key: 'hair_styling',
      name: 'Hairstyling',
      price: 1000,
      duration_minutes: 60,
      aliases: ['hairstyling', 'hair styling', 'hairstyle', 'hair style', 'hairdo', 'hair do', 'updo', 'kulot', 'curls', 'ayos ng buhok', 'buhok', 'hair'],
      description: 'Updos, waves, curls, and event-ready hairstyling',
      inclusions: 'Blowdry prep, curls or formal updo, pins, and long-hold finishing spray',
      image_url: SHOWCASE_SERVICE_IMAGES.hair_styling,
      show_on_landing: true,
      active: true,
    },
    {
      key: 'hair_makeup',
      name: 'Hair + Makeup Package',
      price: 3000,
      duration_minutes: 150,
      aliases: ['hair and makeup', 'hair at makeup', 'hair makeup', 'makeup and hair', 'hmu', 'hair makeup package'],
      description: 'Complete event hairstyling and long-wear makeup combo',
      inclusions: 'Complete hairstyling, skin prep, long-wear HD makeup, and false lashes',
      image_url: SHOWCASE_SERVICE_IMAGES.hair_makeup,
      show_on_landing: false,
      active: true,
    },
    {
      key: 'wedding_package',
      name: 'Wedding Package (Bride + Entourage)',
      price: 10000,
      duration_minutes: 300,
      aliases: ['wedding package', 'entourage', 'bride and entourage', 'wedding'],
      description: 'Bride and entourage styling with team on location',
      inclusions: 'Full bridal glam plus coordinated entourage hair and makeup with Trev Luna and styling team',
      image_url: SHOWCASE_SERVICE_IMAGES.wedding_package,
      show_on_landing: false,
      active: true,
    },
  ],
  settings: {
    open_time: '07:00',
    close_time: '19:00',
    min_advance_days: 7,
    cutoff_hours: 72,
    slot_interval_minutes: 60,
  },
}

/** Built-in default preset matching initial seed rows. */
export const DEFAULT_PRESET = {
  key: 'default',
  label: "Vicky's Parlor (Default)",
  profile: {
    name: business.name,
    artist: business.artist,
    location: business.location,
    experience_years: business.experienceYears,
    about_bio: business.aboutBio,
    specialty_tags: [...business.specialtyTags],
    contact: business.contact,
    portfolio_url: business.portfolio,
    messenger_url: business.messengerUrl,
    payment_methods: business.paymentMethods,
    consultation_fee: business.consultationFee,
    travel_areas: [...business.travelAreas],
    free_travel_areas: [...business.freeTravelAreas],
    travel_fee_note: business.travelFeeNote,
    additional_head_price: business.additionalHeadPrice,
    additional_head_note: business.additionalHeadNote,
    reservation_fee: business.rules.reservationFee,
    reservation_fee_services: [...business.rules.reservationFeeServices],
    wedding_downpayment_percent: business.rules.weddingDownpaymentPercent,
    wedding_cancel_cutoff_days: business.rules.weddingCancelCutoffDays,
    event_downpayment_percent: business.rules.eventDownpaymentPercent,
    event_cancel_cutoff_days: business.rules.eventCancelCutoffDays,
    same_day_rush_note: business.rules.sameDayRushNote,
    hero_photo_url: business.heroPhotoUrl,
    artist_photo_url: business.artistPhotoUrl,
    gallery_urls: [...business.galleryUrls],
  },
  services: services.map((s) => ({
    key: s.key,
    name: s.name,
    price: s.price,
    duration_minutes: s.durationMinutes,
    aliases: [...s.aliases],
    description: s.description,
    inclusions: s.inclusions,
    image_url: s.imageUrl,
    show_on_landing: s.showOnLanding,
    active: true,
  })),
  settings: {
    open_time: business.hours.open,
    close_time: business.hours.close,
    min_advance_days: business.rules.minAdvanceDays,
    cutoff_hours: business.rules.cancelCutoffHours,
    slot_interval_minutes: 60,
  },
}

/** The catalog JAlgorithm runs on: { business, services, faqTopics }. */
export function defaultCatalog() {
  return structuredClone({ business, services, faqTopics })
}
