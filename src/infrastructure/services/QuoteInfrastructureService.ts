import { EventEmitter } from 'events';
import { Client, TextChannel, VoiceChannel } from 'discord.js';
import { QuoteRequest, QuoteCommand } from '../../domain/commands/QuoteCommand';
import { getRandomQuote } from './quoteService';
import { ZenyattaService } from './zenyattaService';
import { logger } from '../../utils/logger';
import { CHANNEL_TYPES, QUOTE_CHANNEL_NAMES } from '../../config';

/**
 * Infrastructure service that handles quote requests from the domain layer
 * Translates domain events into Discord API calls and infrastructure operations
 */
export class QuoteInfrastructureService {
  constructor(
    private client: Client,
    private eventBus: EventEmitter
  ) {
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.eventBus.on('infrastructure.quote.fetch', async (request: QuoteRequest) => {
      try {
        await this.handleQuoteRequest(request);
      } catch (error) {
        logger.error('Error handling infrastructure quote request:', error);
        this.eventBus.emit('quote.error', {
          requestId: request.userId + request.channelId,
          error: 'FETCH_ERROR',
          message: 'Failed to process quote request'
        });
      }
    });
  }

  private async handleQuoteRequest(request: QuoteRequest): Promise<void> {
    logger.info(`📖 Processing quote infrastructure request for channel ${request.channelId}`);

    // Resolve the quote channel
    const quoteChannel = await this.resolveQuoteChannel(request);
    if (!quoteChannel) {
      this.eventBus.emit('quote.error', {
        requestId: request.userId + request.channelId,
        error: 'NO_QUOTES_CHANNEL',
        targetUser: request.targetUsername
      });
      return;
    }

    // Validate channel type
    if (quoteChannel.type !== CHANNEL_TYPES.GUILD_TEXT) {
      this.eventBus.emit('quote.error', {
        requestId: request.userId + request.channelId,
        error: 'INVALID_CHANNEL_TYPE',
        targetUser: request.targetUsername
      });
      return;
    }

    // Fetch random quote
    const randomQuote = await getRandomQuote(quoteChannel, {
      userId: request.targetUserId,
      username: request.targetUsername,
    });

    if (!randomQuote) {
      this.eventBus.emit('quote.error', {
        requestId: request.userId + request.channelId,
        error: 'NO_QUOTES_FOUND',
        targetUser: request.targetUsername
      });
      return;
    }

    // Generate enhanced TTS with Zenyatta's contextual commentary
    const enhancedText = await ZenyattaService.createEnhancedQuoteTTS(randomQuote);

    // Create response message using domain logic
    const responseMessage = QuoteCommand.formatQuoteResponse(randomQuote, quoteChannel.name);

    // Emit TTS request for the enhanced text
    this.eventBus.emit('tts.request', {
      text: enhancedText,
      channelId: request.channelId,
      priority: 'normal',
      userId: request.userId,
      concurrent: false
    });

    // Emit success event with response data
    this.eventBus.emit('quote.success', {
      requestId: request.userId + request.channelId,
      quote: randomQuote,
      responseMessage,
      enhancedText,
      channelName: quoteChannel.name
    });

    logger.info(`📖 Quote processed successfully for channel ${request.channelId}`);
  }

  private async resolveQuoteChannel(request: QuoteRequest): Promise<TextChannel | null> {
    // If a specific channel was provided, use it
    if (request.quoteChannelId) {
      const channel = this.client.channels.cache.get(request.quoteChannelId);
      return channel as TextChannel || null;
    }

    // Find default quotes channel in the guild
    const channel = this.client.channels.cache.get(request.channelId);
    if (!channel || !('guild' in channel)) {
      return null;
    }

    const guild = (channel as any).guild;
    
    // Look for common quote channel names
    for (const name of QUOTE_CHANNEL_NAMES) {
      const foundChannel = guild.channels.cache.find(
        (guildChannel: any) => 
          guildChannel.name.toLowerCase().includes(name.toLowerCase()) && 
          guildChannel.type === CHANNEL_TYPES.GUILD_TEXT
      );
      if (foundChannel) {
        return foundChannel as TextChannel;
      }
    }

    return null;
  }
}
