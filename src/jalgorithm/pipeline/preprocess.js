// Stage 1: input processing. The original message is always preserved for logging/debugging.

const EMOJI_RE = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu

export const MAX_INPUT_LENGTH = 500

export function preprocess(input) {
  const original = typeof input === 'string' ? input : String(input ?? '')
  let text = original.slice(0, MAX_INPUT_LENGTH).normalize('NFKC').toLowerCase()

  text = text
    .replace(EMOJI_RE, ' ')
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”]/g, '"')
    // "hair & makeup", "hair+makeup" → "hair and makeup" (a leading "+63" phone prefix is untouched)
    .replace(/\s*&\s*/g, ' and ')
    .replace(/([a-z])\s*\+\s*(?=[a-z])/g, '$1 and ')
    // "p.m." / "a.m." → "pm" / "am"
    .replace(/\b([ap])\.\s?m\.?/g, '$1m')
    // elongations: "pleaseee" → "please", "hiii" → "hi" (3+ repeats collapse to one);
    // booking references such as "jal-zzz7k" are left intact
    .replace(/\S+/g, (w) => (/jal-?[a-z0-9]{5}/.test(w) ? w : w.replace(/([a-zñ])\1{2,}/g, '$1')))
    // repeated punctuation
    .replace(/([?!.])\1+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

  return { original, text }
}
