import { EventEmitter } from 'events';
import { Client } from 'discord.js';
import { CommandRegistry } from '../domain/commands/CommandRegistry';
import { CommandHandler } from './CommandHandler';
import { VoiceSessionManager } from './sessions/VoiceSessionManager';
import { VoiceService } from './services/VoiceService';
import { TTSService } from './services/TTSService';
import { QuoteInfrastructureService } from '../infrastructure/services/QuoteInfrastructureService';
import { logger } from '../utils/logger';

/**
 * Main orchestrator for Zenbot's hybrid command/event system
 * Coordinates all components: commands, events, sessions, and services
 */
export class ZenbotOrchestrator {
  private eventBus: EventEmitter;
  private commandRegistry!: CommandRegistry;
  private commandHandler!: CommandHandler;
  private voiceSessionManager!: VoiceSessionManager;
  private voiceService!: VoiceService;
  private ttsService!: TTSService;
  private quoteInfrastructureService!: QuoteInfrastructureService;
  
  constructor(private client: Client) {
    this.eventBus = new EventEmitter();
    
    // Increase max listeners to handle concurrent operations
    this.eventBus.setMaxListeners(50);
    
    this.initializeComponents();
    this.setupGlobalErrorHandling();
    
    logger.info('🧘 Zenbot Orchestrator initialized - Experience tranquility');
  }
  
  private initializeComponents(): void {
    // Core services
    this.voiceService = new VoiceService(this.client, this.eventBus);
    this.ttsService = new TTSService(this.client, this.voiceService);
    
    // Infrastructure services
    this.quoteInfrastructureService = new QuoteInfrastructureService(this.client, this.eventBus);
    
    // Domain layer
    this.commandRegistry = new CommandRegistry(this.eventBus);
    
    // Application layer
    this.commandHandler = new CommandHandler(this.commandRegistry, this.eventBus);
    this.voiceSessionManager = new VoiceSessionManager(
      this.eventBus,
      this.voiceService,
      this.ttsService
    );
    
    logger.info('🧘 All components initialized successfully');
  }
  
  private setupGlobalErrorHandling(): void {
    this.eventBus.on('error', (error) => {
      logger.error('EventBus error:', error);
    });
    
    // Handle uncaught errors in event handlers
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
  }
  
  // Public interface for Discord integration
  getCommandHandler(): CommandHandler {
    return this.commandHandler;
  }
  
  getCommandRegistry(): CommandRegistry {
    return this.commandRegistry;
  }

  getEventBus(): EventEmitter {
    return this.eventBus;
  }
  
  // Get available commands information
  getAvailableCommands() {
    return this.commandRegistry.getAllCommands();
  }
  
  // Health check and monitoring
  getSystemStatus() {
    return {
      eventBusListeners: this.eventBus.listenerCount,
      activeSessions: this.voiceSessionManager.getActiveSessionsCount(),
      registeredCommands: this.commandRegistry.getAllCommands().length,
      timestamp: new Date().toISOString()
    };
  }
  
  // Graceful shutdown
  async shutdown(): Promise<void> {
    logger.info('🧘 Shutting down Zenbot Orchestrator...');
    
    try {
      // Remove all event listeners
      this.eventBus.removeAllListeners();
      
      logger.info('🧘 Zenbot Orchestrator shutdown complete');
    } catch (error) {
      logger.error('Error during shutdown:', error);
    }
  }
}