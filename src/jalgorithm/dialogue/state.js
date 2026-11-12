// Serializable conversation state (safe to JSON.stringify into sessionStorage).

export function initialState() {
  return {
    lang: 'fil', // reply language: 'en' | 'fil'
    turn: 0,
    flow: null, // active multi-turn task, see newFlow()
    pending: null, // { type: 'clarify', options: [intentA, intentB], slots } | { type: 'offer_book', slots } | { type: 'cancel_or_abort' }
    lastIntent: null,
  }
}

export function newFlow(intent, slots = {}) {
  return {
    intent,
    slots: { service: null, date: null, time: null, name: null, contact: null, location: null, reference: null, ...slots },
    awaiting: null, // slot (or 'confirm' / 'change') the bot just asked for
    confirming: false,
    locationAsked: false,
    appointment: null, // appointment found by reference (reschedule/cancel/view)
    checked: null, // { date, service, slots: ['09:00', ...] } last availability result
    misses: 0,
    lookups: 0,
  }
}

export function cloneState(state) {
  return state ? JSON.parse(JSON.stringify(state)) : initialState()
}
