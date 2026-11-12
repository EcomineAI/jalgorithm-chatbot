// Keyword baseline for comparison with JAlgorithm: a plain first-match keyword classifier over the
// full JAlgorithm label set, with no normalization, no fuzzy matching, no context and no learning.

const KEYWORDS = [
  ['CANCEL_APPOINTMENT', /\bcancel/],
  ['RESCHEDULE_APPOINTMENT', /\b(reschedule|resched|move|lipat|palitan|change)\b/],
  ['CANNOT_ATTEND', /\b(can'?t|cannot|hindi|di) .*(come|attend|makapunta|makakapunta)/],
  ['VIEW_APPOINTMENT', /\b(my appointment|appointment ko|booking ko|status)\b/],
  ['CHECK_AVAILABILITY', /\b(available|availability|slot|bakante|free)\b/],
  ['BOOK_APPOINTMENT', /\b(book|appointment|schedule|reserve)\b/],
  ['ASK_PRICE', /\b(how much|magkano|price|rate|cost|fee)\b/],
  ['ASK_SERVICES', /\b(services?|offer|package)\b/],
  ['ASK_LOCATION', /\b(where|saan|location|address)\b/],
  ['ASK_OPERATING_HOURS', /\b(hours|open|close|sarado)\b/],
  ['ASK_BOOKING_POLICY', /\b(deposit|downpayment|refund|policy|advance)\b/],
  ['THANKS', /\b(thanks|thank you|salamat)\b/],
  ['GREETING', /\b(hi|hello|good morning|good afternoon|good evening|magandang)\b/],
  ['GENERAL_INQUIRY', /\b(home service|travel|gcash|portfolio|contact|artist)\b/],
]

export function keywordBaseline(message) {
  const lc = message.toLowerCase()
  for (const [intent, re] of KEYWORDS) if (re.test(lc)) return intent
  return 'UNKNOWN_INTENT'
}
