/**
 * Words speech-to-text gets wrong, in two lists that work differently:
 *
 * - SPEECH_HINTS go into the transcription prompt ("spell these like this").
 *   For names and server slang, sparingly. Never put "Zenbot" here: hinted, the
 *   model writes it for breaths and clicks (tested), and the name is what
 *   makes Zenbot answer.
 * - KNOWN_MISHEARINGS fix words after transcription. They only rewrite
 *   what was actually heard, so they can't invent anything - the safe place
 *   for the wake word.
 */

/**
 * Server-specific names and words for the transcription prompt. Hints carry
 * a cost: noise that slips past the level gate can come back as a hinted
 * word (tested: a click burst -> "The worst of us"). So this is opt-in and
 * the people in voice are NOT added automatically. Add a word when it's
 * misheard often and matters; prefer KNOWN_MISHEARINGS when the mishearing
 * is predictable.
 */
export const SPEECH_HINTS: string[] = [
  // e.g. "Osha", "Murloc", "Zenyatta"
];

// Zenbot's name as transcription mangles it: "Zenbot", "Zen bot", "ZennBot",
// "Xenbot", "Zenyatta", and when it misses entirely "Tim Bolts", "Then Bolt",
// "tim-bolt", "Sim bot" (a z/s/t/th sound, a vowel, n/m, "bolt")
const ZENBOT_SOUNDS =
  "\\b[zx]en+[\\s-]?(?:bot|yatta)?\\b|\\b(?:z|x|s|t|th)[eiy]+[nm]+[\\s-]?b[oa]l?ts?\\b";

/** Zenbot is addressed (any spelling) */
export const WAKE_WORD = new RegExp(ZENBOT_SOUNDS, "i");

/** Word fixes applied to every transcript: [pattern, replacement] */
const KNOWN_MISHEARINGS: [RegExp, string][] = [
  // Only the misheard forms - "zen" on its own stays "zen"
  [
    /\b(?:z|x|s|t|th)[eiy]+[nm]+[\s-]?b[oa]l?ts?\b|\b[zx]en+[\s-]?bot\b/gi,
    "Zenbot",
  ],
];

export const fixKnownMishearings = (text: string): string =>
  KNOWN_MISHEARINGS.reduce(
    (fixed, [pattern, replacement]) => fixed.replace(pattern, replacement),
    text,
  );
