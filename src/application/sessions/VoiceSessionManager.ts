import { EventEmitter } from 'events';
import { VoiceSession, TTSRequest } from './VoiceSession';
import { QuoteRequest } from '../../domain/commands/QuoteCommand';
import { logger } from '../../utils/logger';

export class VoiceSessionManager {
  private sessions = new Map<string, VoiceSession>();
  
  constructor(
    private eventBus: EventEmitter,
    private voiceService: any, // Will be VoiceService interface
    private ttsService: any    // Will be TTSService interface  
  ) {
    this.setupEventHandlers();
  }
  
  private setupEventHandlers(): void {
    // Start concurrent listening session
    this.eventBus.on('voice.session.start', async (data) => {
      logger.info(`🎧 Starting voice session for channel ${data.channelId}, duration: ${data.duration}ms`);
      
      const session = new VoiceSession(
        data.sessionId,
        data.channelId, 
        data.userId, 
        data.duration
      );
      
      this.sessions.set(session.sessionId, session);
      
      // Start concurrent operations: listening AND TTS processing
      try {
        await Promise.allSettled([
          this.startListening(session),
          this.processTTSQueue(session)
        ]);
      } catch (error) {
        logger.error('Error in voice session:', error);
      } finally {
        this.cleanupSession(session.sessionId);
      }
    });
    
    // Handle voice transcription within active session
    this.eventBus.on('voice.transcribed', async (data) => {
      const session = this.getActiveSessionForChannel(data.channelId);
      if (session?.isActive()) {
        logger.info(`🎤 Voice transcribed in active session: "${data.text}"`);
        
        // Emit command detection (handled by CommandHandler)
        this.eventBus.emit('voice.command.detected', {
          text: data.text,
          userId: data.userId,
          channelId: data.channelId,
          sessionId: session.sessionId
        });
      } else {
        logger.info(`🎤 Voice transcribed but no active session for channel ${data.channelId}`);
      }
    });
    
    // Handle TTS requests from commands
    this.eventBus.on('tts.request', (data) => {
      const session = this.getActiveSessionForChannel(data.channelId);
      if (session?.isActive()) {
        logger.info(`🔊 Queueing TTS in session: "${data.text}"`);
        session.queueTTS({
          text: data.text,
          channelId: data.channelId,
          priority: data.priority || 'normal',
          userId: data.userId,
          timestamp: new Date()
        });
      } else {
        // No active session - play TTS immediately (non-concurrent mode)
        logger.info(`🔊 Playing TTS immediately (no active session): "${data.text}"`);
        this.ttsService.playInChannel(data.text, data.channelId).catch((error: any) => {
          logger.error('Error playing immediate TTS:', error);
        });
      }
    });

    // Handle quote requests from commands
    this.eventBus.on('quote.request', async (data) => {
      try {
        await this.handleQuoteRequest(data);
      } catch (error) {
        logger.error('Error handling quote request:', error);
      }
    });
    
    // Handle session end requests
    this.eventBus.on('voice.session.end', async (data) => {
      const session = this.getActiveSessionForChannel(data.channelId);
      if (session) {
        logger.info(`🎧 Ending voice session for channel ${data.channelId}, reason: ${data.reason}`);
        
        if (data.delay) {
          setTimeout(() => {
            this.endSession(session.sessionId, data.reason);
          }, data.delay);
        } else {
          this.endSession(session.sessionId, data.reason);
        }
      }
    });
    
    // Handle interaction completion (session continues)
    this.eventBus.on('voice.interaction.completed', (data) => {
      const session = this.getActiveSessionForChannel(data.channelId);
      if (session && data.shouldContinueListening) {
        session.keepAlive();
        logger.info(`🎧 Session continues after ${data.interactionType} interaction`);
      }
    });
  }
  
  private async startListening(session: VoiceSession): Promise<void> {
    logger.info(`🎧 Starting listening for session ${session.sessionId}`);
    
    try {
      // This will be implemented by the voice service
      // It should emit 'voice.transcribed' events while the session is active
      await this.voiceService.startListening(session.channelId, session.duration);
    } catch (error) {
      logger.error(`Error in listening for session ${session.sessionId}:`, error);
    }
    
    logger.info(`🎧 Listening ended for session ${session.sessionId}`);
  }
  
  private async processTTSQueue(session: VoiceSession): Promise<void> {
    logger.info(`🔊 Starting TTS processor for session ${session.sessionId}`);
    
    while (session.isActive()) {
      const ttsRequest = session.getNextTTS();
      
      if (ttsRequest) {
        try {
          logger.info(`🔊 Playing TTS: "${ttsRequest.text}"`);
          await this.ttsService.playInChannel(ttsRequest.text, ttsRequest.channelId);
          
          this.eventBus.emit('tts.completed', {
            channelId: ttsRequest.channelId,
            text: ttsRequest.text,
            sessionId: session.sessionId
          });
        } catch (error) {
          logger.error('Error playing TTS:', error);
        }
      } else {
        // No TTS in queue, wait a bit before checking again
        await this.sleep(200);
      }
    }
    
    logger.info(`🔊 TTS processor ended for session ${session.sessionId}`);
  }
  
  private getActiveSessionForChannel(channelId: string): VoiceSession | null {
    for (const session of this.sessions.values()) {
      if (session.channelId === channelId && session.isActive()) {
        return session;
      }
    }
    return null;
  }
  
  private endSession(sessionId: string, reason?: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.end();
      logger.info(`🎧 Session ${sessionId} ended. Reason: ${reason || 'timeout'}`);
      
      // Emit event for voice service to cleanup
      this.eventBus.emit('voice.session.cleanup', {
        sessionId,
        channelId: session.channelId,
        reason
      });
    }
  }
  
  private cleanupSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    logger.info(`🎧 Session ${sessionId} cleaned up`);
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Public methods for monitoring
  getActiveSessionsCount(): number {
    return Array.from(this.sessions.values()).filter(s => s.isActive()).length;
  }
  
  getSessionStatus(sessionId: string) {
    return this.sessions.get(sessionId)?.getStatus();
  }
  
  private async handleQuoteRequest(request: QuoteRequest): Promise<void> {
    logger.info(`🔊 Processing quote request for channel ${request.channelId}`);
    
    // Emit infrastructure event to handle the actual quote fetching
    this.eventBus.emit('infrastructure.quote.fetch', request);
  }
  
  getAllActiveSessions() {
    return Array.from(this.sessions.values())
      .filter(s => s.isActive())
      .map(s => s.getStatus());
  }
}