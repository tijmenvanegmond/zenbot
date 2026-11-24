import { EnrichedQuote, QuoteLine } from "../types";

const linesOf = (quote: EnrichedQuote): QuoteLine[] =>
  quote.lines?.length
    ? quote.lines
    : [{ speaker: quote.speaker, text: quote.parsedQuote }];

const withEndPunctuation = (text: string): string =>
  /[.!?…]$/.test(text) ? text : `${text}.`;

// Piper turns [pause:SECONDS] into exact silence (see piper-server/server.py)
export const SPEAKER_PAUSE = "[pause:0.6]"; // "Osha:" ... "pelican"
export const LINE_PAUSE = "[pause:0.9]"; // between dialogue lines
export const INTRO_PAUSE = "[pause:0.8]"; // after the intro

/**
 * Text for TTS with timed pauses, e.g.
 *   "Osha:[pause:0.6] pelican.[pause:0.9] Murloc:[pause:0.6] those are seagulls Brother."
 */
export const formatQuoteForSpeech = (quote: EnrichedQuote): string =>
  linesOf(quote)
    .map((line) => {
      const text = withEndPunctuation(line.text);
      return line.speaker ? `${line.speaker}:${SPEAKER_PAUSE} ${text}` : text;
    })
    .join(LINE_PAUSE + " ");

/**
 * Markdown for the Discord reply
 */
export const formatQuoteForDisplay = (
  quote: EnrichedQuote,
  channelName: string,
): string => {
  const body = linesOf(quote)
    .map((line) =>
      line.speaker ? `> **${line.speaker}:** ${line.text}` : `> *${line.text}*`,
    )
    .join("\n");

  return `💬 **From #${channelName}** (shared by ${quote.poster.displayName})\n${body}`;
};
