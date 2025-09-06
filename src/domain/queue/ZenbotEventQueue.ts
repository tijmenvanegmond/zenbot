import { ZenbotEvent, AIResponseEvent } from '../events/ZenbotEvent';
import { AIProcessor } from '../ai/AIProcessor';
import { ContextFilter, MoodFilter, ContentFilter, CommandFilter } from '../filters/EventFilter';
import { ActionHandler, ActionContext } from '../actions/ActionHandler';
import { logger } from '../../utils/logger';
import { Client } from 'discord.js';

/**
 * Event queue that processes events through filters and AI
 */
export class ZenbotEventQueue {
  private queue: ZenbotEvent[] = [];
  private processing: boolean = false;
  private aiProcessor: AIProcessor;
  private eventHandlers: Map<string, (event: AIResponseEvent) => Promise<void>> = new Map();
  private client?: Client;
  private zenbot?: any; // Will be injected

  constructor() {
    this.aiProcessor = new AIProcessor();
    this.setupFilters();
  }

  /**
   * Initialize with Discord client and Zenbot instance
   */
  initialize(client: Client, zenbot: any): void {
    this.client = client;
    this.zenbot = zenbot;
  }

  /**
   * Set up default event filters
   */
  private setupFilters(): void {
    this.aiProcessor.addFilter(new ContextFilter());
    this.aiProcessor.addFilter(new MoodFilter());
    this.aiProcessor.addFilter(new ContentFilter());
    this.aiProcessor.addFilter(new CommandFilter());
  }

  /**
   * Add an event to the processing queue
   */
  async enqueue(event: ZenbotEvent): Promise<void> {
    this.queue.push(event);
    logger.debug(`Event queued: ${event.type} (${event.id})`);
    
    if (!this.processing) {
      await this.processQueue();
    }
  }

  /**
   * Register a handler for AI response events
   */
  onResponse(sessionId: string, handler: (event: AIResponseEvent) => Promise<void>): void {
    this.eventHandlers.set(sessionId, handler);
  }

  /**
   * Remove response handler
   */
  removeResponseHandler(sessionId: string): void {
    this.eventHandlers.delete(sessionId);
  }

  /**
   * Process all events in the queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    logger.debug(`Processing ${this.queue.length} events in queue`);

    while (this.queue.length > 0) {
      const event = this.queue.shift()!;
      
      try {
        logger.debug(`Processing event: ${event.type} (${event.id})`);
        
        // Process through AI pipeline
        const response = await this.aiProcessor.processEvent(event);
        
        // Execute actions if we have the necessary context
        if (this.client && this.zenbot && response.data.response.actions && response.data.response.actions.length > 0) {
          await this.executeActions(response, event);
        }
        
        // Send response to registered handler
        const handler = this.eventHandlers.get(event.sessionId);
        if (handler) {
          await handler(response);
        } else {
          logger.warn(`No response handler for session: ${event.sessionId}`);
        }

        logger.debug(`Event processed successfully: ${event.id}`);

      } catch (error) {
        logger.error(`Error processing event ${event.id}:`, error);
      }
    }

    this.processing = false;
  }

  /**
   * Execute actions from AI response
   */
  private async executeActions(response: AIResponseEvent, originalEvent: ZenbotEvent): Promise<void> {
    if (!this.client || !this.zenbot) {
      logger.warn('Cannot execute actions: missing client or zenbot');
      return;
    }

    const context: ActionContext = {
      client: this.client,
      zenbot: this.zenbot,
      sessionId: originalEvent.sessionId,
      userId: originalEvent.userId,
      guildId: originalEvent.data?.guildId,
      channelId: originalEvent.data?.channelId,
      voiceChannelId: originalEvent.data?.voiceChannelId
    };

    await ActionHandler.executeActions(response.data.response.actions || [], context);
  }

  /**
   * Get queue statistics
   */
  getStats(): { queueLength: number; processing: boolean; handlers: number } {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      handlers: this.eventHandlers.size
    };
  }
}
