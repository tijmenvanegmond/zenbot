import { FastifyInstance } from "fastify";
import { Client, VoiceChannel, TextChannel } from "discord.js";
import { VoiceService } from "../../services/voiceService";
import { GuildService } from "../../services/guildService";
import { logger } from "../../utils/logger";
import {
  fetchAndParseQuotes,
  getRandomQuote,
} from "../../services/quoteService";
import { ZenyattaAssistantService } from "../../services/zenyattaAssistantService";
import { CHANNEL_TYPES } from "../../config";

export default async function quotesRoutes(
  fastify: FastifyInstance,
  { discordClient }: { discordClient: Client },
) {
  // Quote parsing logic moved to services/quoteService.ts

  // Quote Operations - Channel the wisdom of stored messages
  // Get quotes from a specific text channel
  fastify.get(
    "/guilds/:guildId/channels/:channelId/quotes",
    async function handler(request: any, reply) {
      const { guildId, channelId } = request.params;
      const { limit = 100, random = false, userId, username } = request.query;

      const guild = discordClient.guilds.cache.get(guildId);
      if (!guild) {
        reply.code(404).send({ error: "Guild not found" });
        return;
      }

      const channel = guild.channels.cache.get(channelId);
      if (!channel || channel.type !== CHANNEL_TYPES.GUILD_TEXT) {
        reply.code(404).send({ error: "Text channel not found" });
        return;
      }

      try {
        const quoteChannel = channel as TextChannel;

        // Use service layer for quote fetching and parsing
        const { quotes, totalFound } = await fetchAndParseQuotes(quoteChannel, {
          limit: Math.min(parseInt(limit) || 100, 100),
          userId,
          username,
        });

        if (totalFound === 0) {
          const userFilter =
            userId || username ? ` from or about ${username || userId}` : "";
          reply.send({
            quotes: [],
            count: 0,
            message: `No quotes found${userFilter} in this channel - the wisdom flows elsewhere`,
          });
          return;
        }

        // If random is requested, return a single random quote
        if (random === "true") {
          const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
          const response: any = {
            quote: randomQuote,
            channel: {
              id: quoteChannel.id,
              name: quoteChannel.name,
            },
            wisdom:
              userId || username
                ? `Experience the focused wisdom of ${randomQuote.poster.displayName}`
                : "Experience tranquility through random knowledge",
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
            name: quoteChannel.name,
          },
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
          details: error.message,
        });
      }
    },
  );

  // Play random quote from channel as TTS in voice channel
  fastify.post(
    "/guilds/:guildId/voice-channels/:voiceChannelId/quote-tts",
    async function handler(request: any, reply) {
      const { guildId, voiceChannelId } = request.params;
      const { quoteChannelId } = request.body;

      if (!quoteChannelId) {
        reply
          .code(400)
          .send({ error: "quoteChannelId is required in request body" });
        return;
      }

      const guild = discordClient.guilds.cache.get(guildId);
      if (!guild) {
        reply.code(404).send({ error: "Guild not found" });
        return;
      }

      const voiceChannel = guild.channels.cache.get(voiceChannelId);
      if (!voiceChannel || voiceChannel.type !== CHANNEL_TYPES.GUILD_VOICE) {
        reply.code(404).send({ error: "Voice channel not found" });
        return;
      }

      const quoteChannel = guild.channels.cache.get(quoteChannelId);
      if (!quoteChannel || quoteChannel.type !== CHANNEL_TYPES.GUILD_TEXT) {
        reply.code(404).send({ error: "Quote text channel not found" });
        return;
      }

      try {
        const textChannel = quoteChannel as TextChannel;

        // Use service layer to get random quote with enhanced parsing
        const randomQuote = await getRandomQuote(textChannel);

        if (!randomQuote) {
          reply.code(404).send({
            error: "No quotes found in the specified channel",
            wisdom: "The well of knowledge runs dry",
          });
          return;
        }

        // Generate enhanced TTS with Zenyatta's contextual commentary
        const enhancedText =
          await ZenyattaAssistantService.getInstance().createEnhancedQuoteTTS(
            randomQuote,
          );

        // Play enhanced TTS in the specified voice channel
        await VoiceService.playTTSInChannel(
          voiceChannel as VoiceChannel,
          enhancedText,
        );

        logger.info(
          `API: Enhanced quote TTS played in ${voiceChannel.name}: "${enhancedText.substring(0, 100)}..."`,
        );

        reply.send({
          success: true,
          message: `Quote TTS played in voice channel: ${voiceChannel.name}`,
          quote: {
            id: randomQuote.id,
            content: randomQuote.content,
            parsedQuote: randomQuote.parsedQuote,
            speaker: randomQuote.speaker,
            isQuoted: randomQuote.isQuoted,
            author: randomQuote.poster,
            timestamp: randomQuote.timestamp,
          },
          channels: {
            voice: {
              id: voiceChannel.id,
              name: voiceChannel.name,
            },
            quote: {
              id: textChannel.id,
              name: textChannel.name,
            },
          },
          wisdom: "Let the words of the past guide the present",
        });
      } catch (error: any) {
        logger.error(`Error playing quote TTS:`, error);
        reply.code(500).send({
          error: "Failed to play quote TTS",
          details: error.message,
        });
      }
    },
  );
}
