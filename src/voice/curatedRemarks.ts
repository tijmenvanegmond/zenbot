/**
 * Curated remarks used when no AI provider is available.
 * Keys match RemarkType values; {name} is replaced with the subject.
 */
const CURATED_REMARKS: Record<string, string[]> = {
  positive: [
    "{name} is competent. Rare. Noted.",
    "{name} has achieved something approaching harmony. Don't ruin it.",
    "{name} is better than most. The bar was low, but still.",
    "I have observed {name}. The results are... acceptable. High praise.",
  ],
  negative: [
    "{name} walks the path. In circles.",
    "{name} has the focus of a goldfish and half the memory.",
    "I sense great potential in {name}. Untouched. Pristine.",
    "{name}: proof that enlightenment is optional.",
  ],
  philosophical: [
    "{name} seeks answers. {name} has not checked the obvious places.",
    "Is {name} the dream, or the dreamer? Neither, probably.",
    "{name} exists. That is the most I can confirm.",
  ],
  sarcastic: [
    "Oh good, {name} is here. Truly the highlight.",
    "{name}, a visionary. Of what, unclear.",
    "Incredible work, {name}. Somebody had to do it badly.",
  ],
  encouraging: [
    "{name}, you are closer than you think. Not close. Closer.",
    "Keep going, {name}. Momentum beats talent.",
    "{name} will get there. Eventually. Persistently.",
  ],
  mysterious: [
    "{name} knows what they did.",
    "The Iris whispers of {name}. It does not elaborate.",
    "Something approaches {name}. It is probably fine.",
  ],
  wise: [
    "{name}: pass on what you have learned. Briefly.",
    "The wise {name} speaks little. Be the wise {name}.",
    "{name}, the obstacle is the path. Also the obstacle.",
  ],
  humorous: [
    "{name} pressed the wrong button with total confidence.",
    "{name} is the reason the instructions have pictures.",
    "{name} has entered the chat. The chat has noticed.",
  ],
};

export function getCuratedRemark(type: string, subject: string): string {
  const lines = CURATED_REMARKS[type] ?? CURATED_REMARKS.positive;
  const line = lines[Math.floor(Math.random() * lines.length)];
  return line.split("{name}").join(subject);
}
