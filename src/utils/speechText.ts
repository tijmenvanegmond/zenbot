/**
 * Turn chat-style AI output into something worth reading aloud
 */
export const toSpeakableText = (text: string, maxChars = 700): string => {
  let speech = text
    .replace(/```[\s\S]*?```/g, " ") // code blocks
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [label](url)
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\*\*([^*]+)\*\*/g, "$1") // **bold**
    .replace(/__([^_]+)__/g, "$1")
    // *chuckles* / _sighs_ at the start of a sentence are stage directions
    // and get dropped; other italics (*probably*) are kept as plain text
    .replace(
      /[*_]([^*_\n]+)[*_]/g,
      (match: string, inner: string, offset: number, whole: string) => {
        const before = whole.slice(0, offset).trimEnd();
        const sentenceStart = before === "" || /[.!?:\n]$/.test(before);
        const short = inner.trim().split(/\s+/).length <= 4;
        return sentenceStart && short ? " " : inner;
      },
    )
    .replace(/^#+\s*(.+?)\s*$/gm, (_, heading: string) =>
      /[.!?:]$/.test(heading) ? heading : `${heading}.`,
    ) // headings become their own sentence
    .replace(/^\s*[-•]\s+/gm, "") // bullets
    .replace(/\s+/g, " ")
    .trim();

  if (speech.length > maxChars) {
    const cut = speech.slice(0, maxChars);
    const lastSentenceEnd = Math.max(
      cut.lastIndexOf(". "),
      cut.lastIndexOf("! "),
      cut.lastIndexOf("? "),
    );
    speech =
      lastSentenceEnd > maxChars / 2
        ? cut.slice(0, lastSentenceEnd + 1)
        : `${cut.slice(0, cut.lastIndexOf(" "))}...`;
  }

  return speech;
};
