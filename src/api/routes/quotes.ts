import { FastifyInstance } from "fastify";
import { Client, VoiceChannel, TextChannel, Message } from "discord.js";
import { createTTSStream } from "../../voice/tts";
import PlayResourceInVoiceChannel from "../../voice/playInVoiceChannel";
import OpenAI from "openai";
import { logger } from "../../utils/logger";

export default async function quotesRoutes(fastify: FastifyInstance, { discordClient }: { discordClient: Client }) {
  
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  // Smart quote parsing - fast regex with optional AI enhancement
  const parseQuote = (content: string) => {
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
  
  // Optional: Batch AI parsing for complex quotes (use sparingly)
  const batchParseWithAI = async (contents: string[]) => {
    if (contents.length === 0) return [];
    
    try {
      const batchContent = contents.map((c, i) => `${i}: ${c}`).join('\n');
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{
          role: "system", 
          content: `Parse multiple Discord quotes. Return JSON array: [{"index": 0, "speaker": "name or null", "quote": "actual quote", "isQuoted": true/false}]`
        }, {
          role: "user",
          content: batchContent
        }],
        temperature: 0.1,
        max_tokens: 1000
      });
      
      return JSON.parse(response.choices[0].message.content || '[]');
    } catch (error) {
      logger.error('Batch AI parsing failed:', error);
      return contents.map((content, index) => ({ index, ...parseQuote(content) }));
    }
  };
  
  // Quote Operations - Channel the wisdom of stored messages
  // Get quotes from a specific text channel
  fastify.get("/guilds/:guildId/channels/:channelId/quotes", async function handler(request: any, reply) {
    const { guildId, channelId } = request.params;
    const { limit = 100, random = false, userId, username } = request.query;
    
    const guild = discordClient.guilds.cache.get(guildId);
    if (!guild) {
      reply.code(404).send({ error: "Guild not found" });
      return;
    }
    
    const channel = guild.channels.cache.get(channelId);
    if (!channel || channel.type !== 0) { // GUILD_TEXT = 0
      reply.code(404).send({ error: "Text channel not found" });
      return;
    }
    
    try {
      const quoteChannel = channel as TextChannel;
      
      // Fetch messages with content - embrace the flow of stored wisdom
      const messages = (await quoteChannel.messages.fetch({ 
        limit: Math.min(parseInt(limit) || 100, 100),
        cache: false,
      })).filter((msg: Message) => msg.content && msg.content.length > 0);

      if (messages.size === 0) {
        reply.send({ 
          quotes: [],
          count: 0,
          message: "No quotes found in this channel - the wisdom flows elsewhere"
        });
        return;
      }

      let messagesArray = Array.from(messages.values());
      
      // Fast regex parsing first - no AI calls in loops!
      const quotesWithParsing = messagesArray.map((msg) => {
        const parsed = parseQuote(msg.content);
        return {
          msg,
          parsed,
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
      
      // Filter by user if specified - channel the wisdom of a specific soul
      let filteredQuotes = quotesWithParsing;
      if (userId || username) {
        filteredQuotes = quotesWithParsing.filter(({ msg, parsed }) => {
          // Check if filtering by poster (who submitted the quote)
          const posterMatch = (
            (userId && msg.author.id === userId) ||
            (username && (
              msg.author.username.toLowerCase() === username.toLowerCase() ||
              msg.author.displayName?.toLowerCase() === username.toLowerCase()
            ))
          );
          
          // Check if filtering by speaker (who said the quote) - AI-enhanced matching
          const speakerMatch = parsed.isQuoted && parsed.speaker && username && 
            parsed.speaker.toLowerCase().includes(username.toLowerCase());
          
          return posterMatch || speakerMatch;
        });
        
        if (filteredQuotes.length === 0) {
          reply.send({ 
            quotes: [],
            count: 0,
            message: `No quotes found from or about ${username || userId} - their wisdom remains unspoken in this channel`,
            filter: { userId, username }
          });
          return;
        }
      }

      const quotes = filteredQuotes.map(quote => ({
        id: quote.id,
        content: quote.content,
        parsedQuote: quote.parsedQuote,
        speaker: quote.speaker,
        isQuoted: quote.isQuoted,
        poster: quote.poster,
        timestamp: quote.timestamp,
        url: quote.url
      }));

      // If random is requested, return a single random quote
      if (random === 'true') {
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
        const response: any = { 
          quote: randomQuote,
          channel: {
            id: quoteChannel.id,
            name: quoteChannel.name
          },
          wisdom: userId || username ? `Experience the focused wisdom of ${randomQuote.poster.displayName}` : "Experience tranquility through random knowledge"
        };
        
        if (userId || username) {
          response.filter = { userId, username };
        }
        
        reply.send(response);
        return;
      }

      const response: any = { 
        quotes,
        count: quotes.length,
        channel: {
          id: quoteChannel.id,
          name: quoteChannel.name
        }
      };
      
      if (userId || username) {
        response.filter = { userId, username };
        response.wisdom = `Channeling the collected wisdom of ${quotes[0]?.poster.displayName || username || userId}`;
      }
      
      reply.send(response);
    } catch (error: any) {
      logger.error(`Error fetching quotes:`, error);
      reply.code(500).send({ 
        error: "Failed to fetch quotes from channel", 
        details: error.message 
      });
    }
  });

  // Play random quote from channel as TTS in voice channel
  fastify.post("/guilds/:guildId/voice-channels/:voiceChannelId/quote-tts", async function handler(request: any, reply) {
    const { guildId, voiceChannelId } = request.params;
    const { quoteChannelId } = request.body;
    
    if (!quoteChannelId) {
      reply.code(400).send({ error: "quoteChannelId is required in request body" });
      return;
    }
    
    const guild = discordClient.guilds.cache.get(guildId);
    if (!guild) {
      reply.code(404).send({ error: "Guild not found" });
      return;
    }
    
    const voiceChannel = guild.channels.cache.get(voiceChannelId);
    if (!voiceChannel || voiceChannel.type !== 2) {
      reply.code(404).send({ error: "Voice channel not found" });
      return;
    }
    
    const quoteChannel = guild.channels.cache.get(quoteChannelId);
    if (!quoteChannel || quoteChannel.type !== 0) {
      reply.code(404).send({ error: "Quote text channel not found" });
      return;
    }
    
    try {
      const textChannel = quoteChannel as TextChannel;
      
      // Fetch messages with content - like gathering orbs of wisdom
      const messages = (await textChannel.messages.fetch({ 
        limit: 100,
        cache: false,
      })).filter((msg: Message) => msg.content && msg.content.length > 0);

      if (messages.size === 0) {
        reply.code(404).send({ 
          error: "No quotes found in the specified channel",
          wisdom: "The well of knowledge runs dry"
        });
        return;
      }

      const messagesArray = Array.from(messages.values());
      const randomMessage = messagesArray[Math.floor(Math.random() * messagesArray.length)];
      
      // Create TTS audio resource with the quote
      const resource = await createTTSStream(randomMessage.content);
      
      // Play in the specified voice channel
      await PlayResourceInVoiceChannel(voiceChannel as VoiceChannel, resource);
      
      logger.info(`API: Quote TTS played in ${voiceChannel.name}: "${randomMessage.content}"`);
      
      reply.send({ 
        success: true,
        message: `Quote TTS played in voice channel: ${voiceChannel.name}`,
        quote: {
          id: randomMessage.id,
          content: randomMessage.content,
          author: {
            id: randomMessage.author.id,
            username: randomMessage.author.username,
            displayName: randomMessage.author.displayName || randomMessage.author.username
          },
          timestamp: randomMessage.createdAt.toISOString()
        },
        channels: {
          voice: {
            id: voiceChannel.id,
            name: voiceChannel.name
          },
          quote: {
            id: textChannel.id,
            name: textChannel.name
          }
        },
        wisdom: "Let the words of the past guide the present"
      });
    } catch (error: any) {
      logger.error(`Error playing quote TTS:`, error);
      reply.code(500).send({ 
        error: "Failed to play quote TTS", 
        details: error.message 
      });
    }
  });
}