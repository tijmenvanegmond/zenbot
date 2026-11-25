import { Guild, Message, TextChannel } from "discord.js";
import { CHANNEL_TYPES, QUOTE_CHANNEL_NAMES } from "../config";
import { logger } from "../utils/logger";
import { OpenAIService } from "./openaiService";
import {
  ParsedQuote,
  QuoteLine,
  EnrichedQuote,
  QuoteSearchOptions,
  QuoteSearchResult,
  API_CONFIG,
} from "../types";

/**
 * Smart quote parsing - fast regex with multiple format support
 */
const URL_PATTERN = /https?:\/\/\S+/gi;
const SPEAKER_LINE = /^([^:]{1,40}?)\s*:\s*(.+)$/;

const stripQuoteMarks = (text: string): string =>
  text
    .trim()
    .replace(/^["'“”‘’]+\s*/, "")
    .replace(/\s*["'“”‘’]+$/, "")
    .trim();

/**
 * Parse one line as `Name: "text"` (quotes optional) or plain narration
 */
const parseLine = (line: string): QuoteLine => {
  const match = line.match(SPEAKER_LINE);
  if (match) {
    const speaker = match[1].trim();
    const isUrlScheme = /^https?$/i.test(speaker);
    const looksLikeName = speaker.split(/\s+/).length <= 5;
    if (!isUrlScheme && looksLikeName) {
      return { speaker, text: stripQuoteMarks(match[2]) };
    }
  }
  return { speaker: null, text: stripQuoteMarks(line) };
};

/**
 * Smart quote parsing - handles single quotes and multi-line dialogues:
 *   osha: "everything is fine"
 *   Osha: "pelican" \n Murloc: "those are seagulls" \n Osha: "chicken"
 */
export const parseQuote = (content: string): ParsedQuote => {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseLine);

  const speakers = [
    ...new Set(lines.map((l) => l.speaker).filter((s): s is string => !!s)),
  ];

  if (speakers.length === 0) {
    return {
      speaker: null,
      quote: stripQuoteMarks(content),
      isQuoted: false,
      lines,
    };
  }

  if (lines.length === 1) {
    return {
      speaker: lines[0].speaker,
      quote: lines[0].text,
      isQuoted: true,
      lines,
    };
  }

  return {
    speaker: speakers.join(" & "),
    quote: lines
      .map((l) => (l.speaker ? `${l.speaker}: "${l.text}"` : l.text))
      .join("\n"),
    isQuoted: true,
    lines,
  };
};

/**
 * Whether a message is worth reading aloud - skips GIF links and short
 * chatter ("ah", "?????") that ends up in quote channels
 */
export const isQuotable = (quote: EnrichedQuote): boolean => {
  const withoutUrls = quote.content.replace(URL_PATTERN, "").trim();
  if (!withoutUrls) return false;
  if (quote.isQuoted) return true;
  return withoutUrls.split(/\s+/).length >= 4;
};

/**
 * Optional: Batch AI parsing for complex quotes (use sparingly)
 */
export const batchParseWithAI = async (contents: string[]): Promise<any[]> => {
  if (contents.length === 0) return [];

  try {
    return await OpenAIService.batchParseQuotes(contents);
  } catch (error) {
    logger.error(
      "Batch AI parsing failed, falling back to regex parsing:",
      error,
    );
    return contents.map((content, index) => ({
      index,
      ...parseQuote(content),
    }));
  }
};

/**
 * Enriches Discord messages with quote parsing and metadata
 */
export const enrichMessages = (messages: Message[]): EnrichedQuote[] => {
  return messages.map((msg) => {
    const parsed = parseQuote(msg.content);
    return {
      id: msg.id,
      content: msg.content,
      parsedQuote: parsed.quote,
      speaker: parsed.speaker,
      isQuoted: parsed.isQuoted,
      lines: parsed.lines,
      poster: {
        id: msg.author.id,
        username: msg.author.username,
        displayName: msg.author.displayName || msg.author.username,
      },
      timestamp: msg.createdAt.toISOString(),
      url: msg.url,
    };
  });
};

/**
 * Fetches and parses quotes from a text channel
 */
export const fetchAndParseQuotes = async (
  channel: TextChannel,
  options: QuoteSearchOptions = {},
): Promise<QuoteSearchResult> => {
  const {
    limit = API_CONFIG.DEFAULT_QUOTE_LIMIT,
    userId,
    username,
    random = false,
  } = options;

  // Fetch messages with content - embrace the flow of stored wisdom
  const messages = (
    await channel.messages.fetch({
      limit: Math.min(limit, API_CONFIG.MAX_QUOTE_LIMIT),
      cache: false,
    })
  ).filter((msg: Message) => msg.content && msg.content.length > 0);

  if (messages.size === 0) {
    return { quotes: [], totalFound: 0 };
  }

  const messagesArray = Array.from(messages.values());

  // Fast regex parsing first - no AI calls in loops!
  let enrichedQuotes = enrichMessages(messagesArray);

  // Filter by user if specified - channel the wisdom of a specific soul
  if (userId || username) {
    enrichedQuotes = enrichedQuotes.filter((quote) => {
      // Check if filtering by poster (who submitted the quote)
      const posterMatch =
        (userId && quote.poster.id === userId) ||
        (username &&
          (quote.poster.username.toLowerCase() === username.toLowerCase() ||
            quote.poster.displayName.toLowerCase() === username.toLowerCase()));

      // Check if filtering by speaker (who said the quote)
      const speakerMatch =
        quote.isQuoted &&
        quote.speaker &&
        username &&
        quote.speaker.toLowerCase().includes(username.toLowerCase());

      return posterMatch || speakerMatch;
    });
  }

  return {
    quotes: enrichedQuotes,
    totalFound: enrichedQuotes.length,
  };
};

/** The server's quotes channel: the first text channel matching QUOTE_CHANNEL_NAMES */
export const findQuoteChannel = (guild: Guild): TextChannel | undefined => {
  for (const name of QUOTE_CHANNEL_NAMES) {
    const found = guild.channels.cache.find(
      (channel) =>
        channel.name.toLowerCase().includes(name.toLowerCase()) &&
        channel.type === CHANNEL_TYPES.GUILD_TEXT,
    );
    if (found) return found as TextChannel;
  }
  return undefined;
};

/**
 * Gets a random quote from a channel with enhanced parsing
 */
export const getRandomQuote = async (
  channel: TextChannel,
  options: Omit<QuoteSearchOptions, "limit" | "random"> = {},
): Promise<EnrichedQuote | null> => {
  const { quotes } = await fetchAndParseQuotes(channel, {
    ...options,
    random: true,
  });

  if (quotes.length === 0) {
    return null;
  }

  // Prefer real quotes; fall back to anything if the filter leaves nothing
  const quotable = quotes.filter(isQuotable);
  const pool = quotable.length > 0 ? quotable : quotes;

  return pool[Math.floor(Math.random() * pool.length)];
};
