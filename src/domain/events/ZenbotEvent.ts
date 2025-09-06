/**
 * Base event interface for all Zenbot events
 */
export interface ZenbotEvent {
  id: string;
  type: string;
  timestamp: Date;
  sessionId: string;
  userId: string;
  data?: any;
  metadata?: Record<string, any>;
}

/**
 * Event when a user requests advice
 */
export interface AdviceRequestEvent extends ZenbotEvent {
  type: 'advice_request';
  data: {
    topic?: string;
    context?: string;
    urgency?: 'low' | 'medium' | 'high';
  };
}

/**
 * Event when a user requests a quote
 */
export interface QuoteRequestEvent extends ZenbotEvent {
  type: 'quote_request';
  data: {
    theme?: string;
    author?: string;
    mood?: 'zen' | 'playful' | 'wise' | 'mysterious';
  };
}

/**
 * Event when a user requests TTS
 */
export interface TTSRequestEvent extends ZenbotEvent {
  type: 'tts_request';
  data: {
    text: string;
    voiceChannelId: string;
    voice?: string;
  };
}

/**
 * Event when a user sends a conversational message
 */
export interface ConversationEvent extends ZenbotEvent {
  type: 'conversation';
  data: {
    message: string;
    context?: string;
    voiceChannelId?: string;
  };
}

/**
 * General command execution event - unified entry point for all commands
 */
export interface CommandExecutionEvent extends ZenbotEvent {
  type: 'command_execution';
  data: {
    commandName: string;
    commandOptions: Record<string, any>;
    interaction: any; // Discord interaction context
    guildId?: string;
    channelId?: string;
    voiceChannelId?: string;
  };
}

/**
 * Event when AI generates a response
 */
export interface AIResponseEvent extends ZenbotEvent {
  type: 'ai_response';
  data: {
    originalEventId: string;
    response: {
      voice?: string;
      text: string;
      mood?: 'zen' | 'playful' | 'wise' | 'mysterious';
      actions?: Array<{
        type: 'tts' | 'voice' | 'embed' | 'voiceLines' | 'channelRename';
        data: any;
      }>;
    };
  };
}
