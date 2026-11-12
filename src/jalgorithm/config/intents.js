// Intent definitions.
//
// `rules`  : weights applied to concept tags (config/lexicon.js) and derived features
//            (#DATE, #TIME, #SERVICE, #NEG_ATTEND, #VIEW_Q, #FLEX). Negative weights are penalties.
// `flow`   : slots the dialogue manager must collect before acting (required) or may use (optional).
// OUT_OF_SCOPE is a training-only class: messages that look like it are reported as UNKNOWN_INTENT.

export const INTENTS = {
  BOOK_APPOINTMENT: {
    rules: { BOOK: 3, WANT: 0.6, APPT: 0.9, SERVICE: 0.4, DATE: 0.2, MOVE: -2.5, CANCEL: -3, VIEW: -1.5, VIEW_Q: -2, PRICE: -1.2, NEG_ATTEND: -3, AVAIL: -0.4, POLICY: -1 },
    flow: { required: ['service', 'date', 'time', 'name', 'contact'], optional: ['location'] },
  },
  CHECK_AVAILABILITY: {
    rules: { AVAIL: 2.5, FLEX: 3, QWHEN: 0.4, DATE: 0.9, TIME: 0.7, APPT: 0.2, BOOK: -0.6, MOVE: -1.5, CANCEL: -2.5, HOURS: -0.8, PRICE: -1, VIEW_Q: -1.5, NEG_ATTEND: -2.5, POLICY: -0.8 },
    flow: { required: ['date'], optional: ['time', 'service'] },
  },
  RESCHEDULE_APPOINTMENT: {
    rules: { MOVE: 3.2, APPT: 0.7, POSS: 0.3, DATE: 0.3, TIME: 0.2, CANCEL: -1.5, FLEX: -2.5, BOOK: -0.5, POLICY: -0.8 },
    flow: { required: ['reference', 'contact', 'date', 'time'], optional: [] },
  },
  CANCEL_APPOINTMENT: {
    rules: { CANCEL: 3.6, APPT: 0.6, POSS: 0.3, MOVE: -1.5, POLICY: -1.2, PRICE: -0.8 },
    flow: { required: ['reference', 'contact'], optional: [] },
  },
  VIEW_APPOINTMENT: {
    rules: { VIEW: 2.4, VIEW_Q: 3, APPT: 0.4, POSS: 0.4, BOOK: -2, MOVE: -2, CANCEL: -2, AVAIL: -0.8 },
    flow: { required: ['reference', 'contact'], optional: [] },
  },
  CANNOT_ATTEND: {
    rules: { NEG_ATTEND: 3.6, ABSENCE: 1.4, DATE: 0.2, MOVE: -2, CANCEL: -2 },
  },
  ASK_PRICE: {
    rules: { PRICE: 3, SERVICE: 0.5, QUESTION: 0.1, BOOK: -1.2, POLICY: -0.6 },
  },
  ASK_SERVICES: {
    rules: { SERVICE_Q: 2.6, QUESTION: 0.1, PRICE: -0.8, BOOK: -1 },
  },
  ASK_LOCATION: {
    rules: { LOCATION: 3, QUESTION: 0.1, HOURS: -0.8 },
  },
  ASK_OPERATING_HOURS: {
    rules: { HOURS: 3, QUESTION: 0.1, AVAIL: -0.4, APPT: -0.6, POSS: -0.8 },
  },
  ASK_BOOKING_POLICY: {
    rules: { POLICY: 3, QUESTION: 0.1, CANCEL: 0.2 },
  },
  GREETING: {
    rules: { GREETING: 3, MANY_TAGS: -2.5 },
  },
  THANKS: {
    rules: { THANKS: 3, MANY_TAGS: -2 },
  },
  GENERAL_INQUIRY: {
    rules: { GENERAL: 2.4, QUESTION: 0.15, BOOK: -1, PRICE: -0.6 },
  },
  OUT_OF_SCOPE: {
    rules: { OFFTOPIC: 4 },
  },
}

export const FLOW_INTENTS = Object.keys(INTENTS).filter((k) => INTENTS[k].flow)

export const CLASSIFIER_CONFIG = {
  // Late-fusion weights for the three component classifiers (must sum to 1).
  weights: { rules: 0.45, naiveBayes: 0.35, tfidf: 0.2 },
  // Below this fused confidence the message is reported as UNKNOWN_INTENT.
  minConfidence: 0.3,
  // If the top-2 fused scores are closer than this, the result is flagged ambiguous.
  ambiguityMargin: 0.1,
  // An ambiguous result is only acted on as a clarification if the runner-up is at least this strong.
  ambiguityFloor: 0.22,
  // Minimum evidence that a message is about the salon at all (concept tags, entities,
  // or TF-IDF similarity). Prevents forcing unrelated text into a known intent.
  minTfidfSimilarity: 0.18,
  // Naive Bayes Laplace smoothing.
  nbAlpha: 0.5,
}

// Pairs that are commonly confused; when ambiguous the bot asks which one the user meant.
export const CLARIFY_PAIRS = [
  ['RESCHEDULE_APPOINTMENT', 'CANCEL_APPOINTMENT'],
  ['BOOK_APPOINTMENT', 'CHECK_AVAILABILITY'],
  ['ASK_PRICE', 'ASK_SERVICES'],
  ['ASK_OPERATING_HOURS', 'CHECK_AVAILABILITY'],
  ['VIEW_APPOINTMENT', 'RESCHEDULE_APPOINTMENT'],
]
