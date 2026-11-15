export function buildDebugSnapshot(result) {
  const nlu = result?.nlu
  if (!nlu) return null
  return {
    original: nlu.original,
    normalized: nlu.normalized,
    changes: nlu.changes ?? [],
    tags: nlu.tags ?? [],
    language: nlu.language ?? null,
    entities: {
      service: nlu.entities?.service ?? null,
      date: nlu.entities?.date ?? null,
      time: nlu.entities?.time ?? null,
      contact: nlu.entities?.contact ?? null,
      reference: nlu.entities?.reference ?? null,
    },
    intent: result.intent,
    rawIntent: nlu.intent,
    confidence: nlu.confidence ?? null,
    ambiguous: Boolean(nlu.ambiguous),
    candidates: nlu.candidates ?? [],
    reason: nlu.reason ?? null,
    ranked: (nlu.ranked ?? []).map((r) => ({
      intent: r.intent,
      score: Number(r.score.toFixed(4)),
    })),
    components: nlu.components
      ? {
          rulesTop: nlu.components.rules?.[nlu.intent] ?? 0,
          naiveBayesTop: Number((nlu.components.naiveBayes?.[nlu.intent] ?? 0).toFixed(4)),
          tfidfTop: Number((nlu.components.tfidf?.[nlu.intent] ?? 0).toFixed(4)),
          nearest: nlu.components.nearest
            ? {
                intent: nlu.components.nearest.label ?? nlu.components.nearest.intent ?? null,
                similarity: Number((nlu.components.nearest.similarity ?? 0).toFixed(4)),
              }
            : null,
        }
      : null,
    action: result.action ?? null,
    elapsedMs: result.elapsedMs ?? null,
  }
}

export async function copyText(value) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {
    /* fallback below */
  }
  try {
    const el = document.createElement('textarea')
    el.value = value
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}
