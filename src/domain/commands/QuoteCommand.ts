import { Command, CommandInput, CommandContext, CommandResult } from './Command';

export interface QuoteRequest {
  userId: string;
  channelId: string;
  quoteChannelId?: string;
  targetUserId?: string;
  targetUsername?: string;
}

export interface QuoteResult {
  quote: {
    id: string;
    content: string;
    parsedQuote: string;
    speaker: string | null;
    isQuoted: boolean;
    poster: {
      id: string;
      username: string;
      displayName: string;
    };
    timestamp: string;
    url: string;
  } | null;
  enhancedText?: string;
  responseMessage: string;
  error?: string;
}

export class QuoteCommand extends Command {
  readonly name = 'quote';
  readonly description = 'Reads a random quote from the quotes channel with intelligent parsing';

  // Discord slash command data for registration
  getSlashCommandData() {
    return {
      name: 'quote',
      description: this.description,
      options: [
        {
          name: 'quote_channel',
          description: 'The channel to pull quotes from (defaults to quotes channel)',
          type: 7, // CHANNEL
          required: false
        },
        {
          name: 'user',
          description: 'Filter quotes from or about a specific user',
          type: 6, // USER
          required: false
        }
      ]
    };
  }

  canHandle(input: CommandInput): boolean {
    if (input.type === 'slash') {
      return input.text === 'quote';
    }
    if (input.type === 'internal') {
      return input.text === 'quote';
    }
    return false;
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const quoteRequest = this.buildQuoteRequest(context);
    
    // Validate that we have a voice channel for TTS
    if (!this.isValidVoiceContext(context)) {
      return CommandResult.error("You must be in a voice channel to use the quote command");
    }

    // Emit event to infrastructure layer to handle quote fetching
    this.emit('quote.request', quoteRequest);
    
    return CommandResult.success("Quote request initiated", {
      quoteChannelId: quoteRequest.quoteChannelId,
      targetUser: quoteRequest.targetUserId || quoteRequest.targetUsername,
      userId: quoteRequest.userId,
      channelId: quoteRequest.channelId
    });
  }

  private buildQuoteRequest(context: CommandContext): QuoteRequest {
    const quoteChannel = context.getOption('quote_channel') as any;
    const targetUser = context.getOption('user') as any;
    
    return {
      userId: context.userId,
      channelId: context.channelId,
      quoteChannelId: quoteChannel?.id,
      targetUserId: targetUser?.id,
      targetUsername: targetUser?.username
    };
  }

  private isValidVoiceContext(context: CommandContext): boolean {
    // This is a domain rule: quotes require voice channel presence for TTS
    // The infrastructure layer will handle the actual validation
    return true; // Domain layer trusts that context is valid when it reaches here
  }

  /**
   * Domain method to generate response message based on quote data
   */
  static formatQuoteResponse(quote: QuoteResult['quote'], channelName: string): string {
    if (!quote) {
      return "No quotes found in the specified channel";
    }

    let responseContent = `💬 **Quote from #${channelName}:** `;
    
    if (quote.isQuoted && quote.speaker) {
      responseContent += `${quote.speaker} said: "${quote.parsedQuote}"`;
      if (quote.poster.username !== quote.speaker) {
        responseContent += ` (shared by ${quote.poster.displayName})`;
      }
    } else {
      responseContent += `"${quote.content}" (by ${quote.poster.displayName})`;
    }

    return responseContent;
  }

  /**
   * Domain method to determine error messages for quote scenarios
   */
  static getQuoteErrorMessage(error: string, targetUser?: string): string {
    switch (error) {
      case 'NO_QUOTES_CHANNEL':
        return "No quotes channel found. Please specify a channel or create a channel with 'quotes' in the name.";
      case 'INVALID_CHANNEL_TYPE':
        return "Please provide a valid text channel";
      case 'NO_QUOTES_FOUND':
        const userFilter = targetUser ? ` from or about ${targetUser}` : "";
        return `No quotes found${userFilter} in the quote channel`;
      case 'FETCH_ERROR':
        return "An error occurred while trying to fetch quotes";
      default:
        return "An unexpected error occurred while processing the quote request";
    }
  }
}
