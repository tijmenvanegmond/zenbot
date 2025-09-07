/**
 * Common emoji mappings for different advice/message types
 */
export const ADVICE_EMOJIS = {
  philosophical: "🧘",
  greeting: "🙏",
  harmony: "💚",
  discord: "⚡",
  transcendence: "✨",
  random: "🎲",
  default: "🧘",
} as const;

/**
 * Common message prefixes for different advice types
 */
export const ADVICE_PREFIXES = {
  philosophical: "Walk in wisdom...",
  greeting: "Peace be upon you...",
  harmony: "Embrace harmony...",
  discord: "Face your challenges...",
  transcendence: "Experience tranquility...",
  random: "The iris reveals...",
  default: "Walk in wisdom...",
} as const;

export type AdviceType = keyof typeof ADVICE_EMOJIS;

/**
 * Gets appropriate emoji for advice type
 */
export function getAdviceEmoji(type?: string): string {
  return ADVICE_EMOJIS[type as AdviceType] || ADVICE_EMOJIS.default;
}

/**
 * Gets appropriate prefix for advice type
 */
export function getAdvicePrefix(type?: string): string {
  return ADVICE_PREFIXES[type as AdviceType] || ADVICE_PREFIXES.default;
}

/**
 * Formats a wisdom message with emoji and prefix
 */
export function formatWisdomMessage(text: string, type?: string): string {
  const emoji = getAdviceEmoji(type);
  const prefix = getAdvicePrefix(type);
  return `${emoji} **${prefix}** "${text}"`;
}

/**
 * Formats a simple wisdom message with just emoji
 */
export function formatSimpleWisdomMessage(text: string, type?: string): string {
  const emoji = getAdviceEmoji(type);
  return `${emoji} **Zenyatta's Wisdom:** ${text}`;
}
