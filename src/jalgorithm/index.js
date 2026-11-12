// JAlgorithm: deterministic, local NLP + dialogue engine for the salon chatbot.
//
//   const bot = createJAlgorithm({ actions })
//   let state = bot.initialState()
//   const { reply, state: next, intent, nlu, action } = await bot.processMessage('pwde b bukas?', state)
//
// `actions` is the application layer (src/services/appointments.js). The engine itself does no
// I/O, needs no model download or network, and works in the browser and in Node.

import { createAnalyzer } from './analyzer.js'
import { createResponder } from './responder.js'
import { createDialogueManager } from './dialogue/manager.js'
import { initialState } from './dialogue/state.js'
import { defaultCatalog } from './config/business.js'

/**
 * @param {object} [opts]
 * @param {object} [opts.actions]  appointment operations (src/services/appointments.js)
 * @param {object} [opts.catalog]  salon info { business, services, faqTopics } — the owner's data
 *                                 from Supabase (src/services/businessInfo.js), or the defaults
 */
export function createJAlgorithm({ actions = null, now = () => new Date(), training, classifierConfig, catalog = defaultCatalog() } = {}) {
  const analyzer = createAnalyzer({ training, classifierConfig, catalog })
  const responder = createResponder(catalog)
  const manager = createDialogueManager({ analyzer, responder, actions, catalog, now })

  async function processMessage(text, state = initialState()) {
    if (typeof text !== 'string' || !text.trim()) {
      return { reply: '', state: state ?? initialState(), intent: null, nlu: null, action: null }
    }
    const started = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const result = await manager.handle(text, state)
    const ended = typeof performance !== 'undefined' ? performance.now() : Date.now()
    return { ...result, elapsedMs: Number((ended - started).toFixed(2)) }
  }

  return {
    processMessage,
    initialState,
    welcome: (lang = 'fil') => responder.t('welcome', {}, { lang }),
    analyze: (text, opts) => analyzer.analyze(text, { now: now(), ...opts }),
  }
}

export { initialState }
