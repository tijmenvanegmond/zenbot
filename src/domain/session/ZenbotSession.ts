import { User, VoiceChannel, CommandInteraction } from 'discord.js';
import { ZenbotEventQueue } from '../queue/ZenbotEventQueue';
import { 
  ZenbotEvent, 
  AdviceRequestEvent, 
  QuoteRequestEvent, 
  TTSRequestEvent, 
  ConversationEvent,
  CommandExecutionEvent,
  AIResponseEvent 
} from '../events/ZenbotEvent';
import { logger } from '../../utils/logger';

/**
 * Individual Zenbot session for a user
 */
export class ZenbotSession {
  public readonly sessionId: string;
  public readonly userId: string;
  public readonly username: string;
  private eventQueue: ZenbotEventQueue;
  private activeVoiceChannel?: string;
  private lastActivity: Date = new Date();
  private activityContext?: { type: string; name: string; updatedAt: Date };
  private presenceContext?: any;

  constructor(user: User, eventQueue: ZenbotEventQueue) {
    this.sessionId = `session_${user.id}_${Date.now()}`;
    this.userId = user.id;
    this.username = user.displayName || user.username;
    this.eventQueue = eventQueue;

    // Register for AI responses
    this.eventQueue.onResponse(this.sessionId, this.handleAIResponse.bind(this));
    
    logger.info(`🧘 Created Zenbot session for ${this.username} (${this.sessionId})`);
  }

  /**
   * Request advice from Zenbot
   */
  async advice(request: { topic?: string; context?: string; urgency?: 'low' | 'medium' | 'high' }): Promise<{ voice: string; text: string; actions: any[] }> {
    const event: AdviceRequestEvent = {
      id: `advice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'advice_request',
      timestamp: new Date(),
      sessionId: this.sessionId,
      userId: this.userId,
      data: request
    };

    return this.processEventAndWaitForResponse(event);
  }

  /**
   * Request a quote from Zenbot
   */
  async quote(request: { theme?: string; author?: string; mood?: 'zen' | 'playful' | 'wise' | 'mysterious' } = {}): Promise<{ voice: string; text: string; actions: any[] }> {
    const event: QuoteRequestEvent = {
      id: `quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'quote_request',
      timestamp: new Date(),
      sessionId: this.sessionId,
      userId: this.userId,
      data: request
    };

    return this.processEventAndWaitForResponse(event);
  }

  /**
   * Request TTS from Zenbot
   */
  async tts(text: string, voiceChannelId: string, voice?: string): Promise<{ voice: string; text: string; actions: any[] }> {
    const event: TTSRequestEvent = {
      id: `tts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'tts_request',
      timestamp: new Date(),
      sessionId: this.sessionId,
      userId: this.userId,
      data: { text, voiceChannelId, voice }
    };

    this.activeVoiceChannel = voiceChannelId;
    return this.processEventAndWaitForResponse(event);
  }

  /**
   * Send a conversational message to Zenbot
   */
  async converse(message: string, context?: string, voiceChannelId?: string): Promise<{ voice: string; text: string; actions: any[] }> {
    const event: ConversationEvent = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'conversation',
      timestamp: new Date(),
      sessionId: this.sessionId,
      userId: this.userId,
      data: { message, context, voiceChannelId }
    };

    if (voiceChannelId) {
      this.activeVoiceChannel = voiceChannelId;
    }

    return this.processEventAndWaitForResponse(event);
  }

  /**
   * Execute any Discord command through the unified session system
   */
  async executeCommand(
    commandName: string, 
    commandOptions: Record<string, any>, 
    interaction: CommandInteraction
  ): Promise<{ voice: string; text: string; actions: any[] }> {
    const event: CommandExecutionEvent = {
      id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'command_execution',
      timestamp: new Date(),
      sessionId: this.sessionId,
      userId: this.userId,
      data: {
        commandName,
        commandOptions,
        interaction: {
          guildId: interaction.guildId,
          channelId: interaction.channelId,
          userId: interaction.user.id,
          username: interaction.user.username,
          member: interaction.member ? {
            voiceChannelId: (interaction.member as any)?.voice?.channelId || undefined
          } : null
        },
        guildId: interaction.guildId || undefined,
        channelId: interaction.channelId || undefined,
        voiceChannelId: (interaction.member as any)?.voice?.channelId || undefined
      }
    };

    // Update voice channel if user is in one
    if (event.data.voiceChannelId) {
      this.activeVoiceChannel = event.data.voiceChannelId;
    }

    return this.processEventAndWaitForResponse(event);
  }

  /**
   * Set the active voice channel
   */
  setVoiceChannel(channelId: string): void {
    this.activeVoiceChannel = channelId;
  }

  /**
   * Set activity context for AI responses
   */
  setActivityContext(type: string, name: string): void {
    this.activityContext = {
      type,
      name,
      updatedAt: new Date()
    };
    
    logger.debug(`🧘 Updated activity context for ${this.username}: ${type} - ${name}`);
  }

  /**
   * Update presence context from Discord presence data
   */
  updatePresenceContext(presenceData: any): void {
    this.presenceContext = presenceData;
  }

  /**
   * Check if session is still active (within last 30 minutes)
   */
  isActive(): boolean {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    return this.lastActivity > thirtyMinutesAgo;
  }

  /**
   * Clean up session resources
   */
  destroy(): void {
    this.eventQueue.removeResponseHandler(this.sessionId);
    logger.info(`🧘 Destroyed Zenbot session for ${this.username} (${this.sessionId})`);
  }

  /**
   * Process an event and wait for AI response
   */
  private async processEventAndWaitForResponse(event: ZenbotEvent): Promise<{ voice: string; text: string; actions: any[] }> {
    return new Promise(async (resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        reject(new Error('AI response timeout'));
      }, 15000); // 15 second timeout

      // Store resolver for when response arrives
      this.pendingResponse = {
        eventId: event.id,
        resolve: (response) => {
          clearTimeout(timeout);
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      };

      // Update activity
      this.lastActivity = new Date();

      // Queue the event
      try {
        await this.eventQueue.enqueue(event);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  private pendingResponse?: {
    eventId: string;
    resolve: (response: any) => void;
    reject: (error: any) => void;
  };

  /**
   * Handle AI response from the event queue
   */
  private async handleAIResponse(responseEvent: AIResponseEvent): Promise<void> {
    logger.debug(`Received AI response for session ${this.sessionId}`);

    if (this.pendingResponse && this.pendingResponse.eventId === responseEvent.data.originalEventId) {
      const response = responseEvent.data.response;
      
      // Resolve the waiting promise
      this.pendingResponse.resolve({
        voice: response.voice || response.text,
        text: response.text,
        actions: response.actions || []
      });

      this.pendingResponse = undefined;
    }
  }
}
