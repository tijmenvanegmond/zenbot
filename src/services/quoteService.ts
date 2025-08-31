import { Message, TextChannel } from "discord.js";
import { logger } from "../utils/logger";
import { OpenAIService } from "./openaiService";
import { ParsedQuote, EnrichedQuote, QuoteSearchOptions, QuoteSearchResult, API_CONFIG } from "../types";


/**
 * Smart quote parsing - fast regex with multiple format support
 */
export const parseQuote = (content: string): ParsedQuote => {
  // Fast regex patterns for common quote formats
  const quotePatterns = [
    /^(.+?):\s*["'](.+)["']$/,           // Name: "quote" or Name: 'quote'  
    /^(.+?):\s*"(.+)"$/,                 // Name: "quote"
    /^(.+?):\s*'(.+)'$/,                 // Name: 'quote'
    /^(.+?):\s*(.+)$/,                   // Name: anything else
  ];
  
  for (const pattern of quotePatterns) {
    const match = content.match(pattern);
    if (match) {
      return {
        speaker: match[1].trim(),
        quote: match[2].trim(),
        isQuoted: true
      };
    }
  }
  
  return {
    speaker: null,
    quote: content,
    isQuoted: false
  };
};

/**
 * Optional: Batch AI parsing for complex quotes (use sparingly)
 */
export const batchParseWithAI = async (contents: string[]): Promise<any[]> => {
  if (contents.length === 0) return [];
  
  try {
    return await OpenAIService.batchParseQuotes(contents);
  } catch (error) {
    logger.error('Batch AI parsing failed, falling back to regex parsing:', error);
    return contents.map((content, index) => ({ index, ...parseQuote(content) }));
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
      poster: {
        id: msg.author.id,
        username: msg.author.username,
        displayName: msg.author.displayName || msg.author.username
      },
      timestamp: msg.createdAt.toISOString(),
      url: msg.url
    };
  });
};

/**
 * Fetches and parses quotes from a text channel
 */
export const fetchAndParseQuotes = async (
  channel: TextChannel, 
  options: QuoteSearchOptions = {}
): Promise<QuoteSearchResult> => {
  const { limit = API_CONFIG.DEFAULT_QUOTE_LIMIT, userId, username, random = false } = options;
  
  // Fetch messages with content - embrace the flow of stored wisdom
  const messages = (await channel.messages.fetch({ 
    limit: Math.min(limit, API_CONFIG.MAX_QUOTE_LIMIT),
    cache: false,
  })).filter((msg: Message) => msg.content && msg.content.length > 0);

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
      const posterMatch = (
        (userId && quote.poster.id === userId) ||
        (username && (
          quote.poster.username.toLowerCase() === username.toLowerCase() ||
          quote.poster.displayName.toLowerCase() === username.toLowerCase()
        ))
      );
      
      // Check if filtering by speaker (who said the quote)
      const speakerMatch = quote.isQuoted && quote.speaker && username && 
        quote.speaker.toLowerCase().includes(username.toLowerCase());
      
      return posterMatch || speakerMatch;
    });
  }
  
  return {
    quotes: enrichedQuotes,
    totalFound: enrichedQuotes.length
  };
};

/**
 * Gets a random quote from a channel with enhanced parsing
 */
export const getRandomQuote = async (
  channel: TextChannel,
  options: Omit<QuoteSearchOptions, 'limit' | 'random'> = {}
): Promise<EnrichedQuote | null> => {
  const { quotes } = await fetchAndParseQuotes(channel, { ...options, random: true });
  
  if (quotes.length === 0) {
    return null;
  }
  
  return quotes[Math.floor(Math.random() * quotes.length)];
};