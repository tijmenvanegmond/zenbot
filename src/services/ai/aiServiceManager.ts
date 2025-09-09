/**
 * AI Service Manager
 * Central coordinator for multiple AI providers with automatic routing and fallbacks
 */

import { 
  AIServiceManager, 
  AIServiceConfig, 
  AIProvider, 
  AISession, 
  SessionOptions, 
  GenerationOptions, 
  StreamEvent,
  SessionStorage,
  AIServiceError,
  ProviderUnavailableError
} from './types';
import { MemorySessionStorage } from './storage/memoryStorage';
import { OpenAIProvider } from './providers/openaiProvider';
import { AnthropicProvider } from './providers/anthropicProvider';
import { GeminiProvider } from './providers/geminiProvider';
import { logger } from '../../utils/logger';

export class DefaultAIServiceManager implements AIServiceManager {
  private providers = new Map<string, AIProvider>();
  private sessionStorage: SessionStorage;
  private config: AIServiceConfig;
  private cleanupInterval?: NodeJS.Timeout;
  
  // Circuit breaker state
  private circuitBreaker = new Map<string, { failures: number; lastFailure: Date; isOpen: boolean }>();

  constructor(config: AIServiceConfig, sessionStorage?: SessionStorage) {
    this.config = config;
    this.sessionStorage = sessionStorage || new MemorySessionStorage();
    
    // Initialize cleanup
    this.startCleanup();
    
    // Auto-register providers based on config
    this.initializeProviders();
    
    logger.info(`🤖 AI Service Manager initialized with ${this.providers.size} providers`);
  }

  // ===== PROVIDER MANAGEMENT =====

  registerProvider(provider: AIProvider): void {
    this.providers.set(provider.name, provider);
    logger.info(`✅ Registered AI provider: ${provider.name} (models: ${provider.supportedModels.join(', ')})`);
  }

  getProvider(name?: string): AIProvider {
    const providerName = name || this.config.defaultProvider;
    const provider = this.providers.get(providerName);
    
    if (!provider) {
      throw new AIServiceError(
        `Provider ${providerName} not found. Available providers: ${Array.from(this.providers.keys()).join(', ')}`,
        'manager',
        'PROVIDER_NOT_FOUND'
      );
    }
    
    return provider;
  }

  getBestProvider(capability: 'simple' | 'conversation' | 'functions' | 'streaming'): AIProvider {
    // Check routing config first
    const routingProvider = this.config.routing?.[capability];
    if (routingProvider && this.providers.has(routingProvider)) {
      return this.providers.get(routingProvider)!;
    }

    // Find best provider based on capability
    const candidates = Array.from(this.providers.values()).filter(provider => {
      switch (capability) {
        case 'streaming':
          return provider.supportsStreaming;
        case 'functions':
          return provider.supportsFunctions;
        case 'simple':
        case 'conversation':
          return true; // All providers support basic text generation
        default:
          return true;
      }
    });

    if (candidates.length === 0) {
      throw new AIServiceError(
        `No providers support capability: ${capability}`,
        'manager',
        'NO_CAPABLE_PROVIDER'
      );
    }

    // Return first capable provider (could add more sophisticated selection logic)
    return candidates[0];
  }

  // ===== SESSION MANAGEMENT =====

  async createSession(character?: string, options: SessionOptions = {}): Promise<AISession> {
    const provider = this.getProvider(options.model ? this.findProviderForModel(options.model) : undefined);
    
    // Set character-specific defaults
    if (character === 'Zenyatta') {
      options.systemPrompt = options.systemPrompt || this.getZenyattaSystemPrompt();
      options.sessionExpiry = options.sessionExpiry || 1440; // 24 hours for Zenyatta
      options.maxHistoryMessages = options.maxHistoryMessages || 100; // More history for character consistency
    }

    return provider.createSession(options);
  }

  // ===== CONVERSATION =====

  async chat(sessionId: string, message: string, options: GenerationOptions = {}): Promise<string> {
    const session = await this.getSessionWithProvider(sessionId);
    const primaryProvider = session.metadata.provider;
    
    return await this.executeWithFallback(
      primaryProvider,
      async (providerName) => {
        const provider = this.getProvider(providerName);
        
        // Update session to use current provider if different
        if (providerName !== session.metadata.provider) {
          await this.sessionStorage.update(sessionId, {
            metadata: { 
              ...session.metadata, 
              provider: providerName,
              model: provider.supportedModels[0]
            }
          });
        }
        
        return await provider.continueConversation(sessionId, message, options);
      },
      `chat for session ${sessionId}`
    );
  }

  async *chatStream(
    sessionId: string, 
    message: string, 
    options: GenerationOptions = {}
  ): AsyncIterable<StreamEvent> {
    const session = await this.getSessionWithProvider(sessionId);
    const provider = this.getProvider(session.metadata.provider);
    
    if (!provider.supportsStreaming) {
      throw new AIServiceError(
        `Provider ${provider.name} does not support streaming`,
        provider.name,
        'STREAMING_NOT_SUPPORTED'
      );
    }

    try {
      for await (const event of provider.streamConversation(sessionId, message, options)) {
        yield event;
      }
    } catch (error) {
      logger.error(`💥 Streaming failed for provider ${provider.name}:`, error);
      yield { 
        type: 'error', 
        metadata: { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        } 
      };
    }
  }

  // ===== HEALTH & STATS =====

  async healthCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const [name, provider] of this.providers) {
      try {
        results[name] = await provider.healthCheck();
      } catch (error) {
        logger.error(`Health check failed for ${name}:`, error);
        results[name] = false;
      }
    }
    
    return results;
  }

  async getStats(): Promise<{
    providers: string[];
    activeSessions: number;
    totalMessages: number;
    uptime: number;
  }> {
    const providers = Array.from(this.providers.keys());
    
    // Get session stats (simplified - depends on storage implementation)
    const allSessions = await this.sessionStorage.find({});
    const activeSessions = allSessions.filter(s => !s.expiresAt || s.expiresAt > new Date()).length;
    const totalMessages = allSessions.reduce((sum, session) => sum + session.messages.length, 0);
    
    return {
      providers,
      activeSessions,
      totalMessages,
      uptime: process.uptime()
    };
  }

  // ===== PRIVATE METHODS =====

  private initializeProviders(): void {
    // Initialize OpenAI provider if configured
    if (this.config.providers.openai) {
      try {
        const openaiProvider = new OpenAIProvider(this.sessionStorage, this.config.providers.openai);
        this.registerProvider(openaiProvider);
      } catch (error) {
        logger.error('Failed to initialize OpenAI provider:', error);
      }
    }

    // Initialize Anthropic provider if configured
    if (this.config.providers.anthropic) {
      try {
        const anthropicProvider = new AnthropicProvider(this.sessionStorage, this.config.providers.anthropic);
        this.registerProvider(anthropicProvider);
      } catch (error) {
        logger.error('Failed to initialize Anthropic provider:', error);
      }
    }

    // Initialize Gemini provider if configured
    if (this.config.providers.gemini) {
      try {
        const geminiProvider = new GeminiProvider(this.sessionStorage, this.config.providers.gemini);
        this.registerProvider(geminiProvider);
      } catch (error) {
        logger.error('Failed to initialize Gemini provider:', error);
      }
    }

    // Ensure we have at least one provider
    if (this.providers.size === 0) {
      throw new AIServiceError(
        'No AI providers configured. Please configure at least one provider.',
        'manager',
        'NO_PROVIDERS'
      );
    }

    // Validate default provider
    if (!this.providers.has(this.config.defaultProvider)) {
      const availableProviders = Array.from(this.providers.keys());
      logger.warn(`Default provider ${this.config.defaultProvider} not available. Using ${availableProviders[0]}`);
      this.config.defaultProvider = availableProviders[0];
    }
  }

  private async getSessionWithProvider(sessionId: string): Promise<AISession> {
    const session = await this.sessionStorage.get(sessionId);
    if (!session) {
      throw new AIServiceError(`Session ${sessionId} not found`, 'manager', 'SESSION_NOT_FOUND');
    }
    return session;
  }

  private findProviderForModel(model: string): string | undefined {
    for (const [name, provider] of this.providers) {
      if (provider.supportedModels.includes(model)) {
        return name;
      }
    }
    return undefined;
  }

  /**
   * Execute operation with intelligent fallback handling and cycle detection
   */
  private async executeWithFallback<T>(
    primaryProvider: string,
    operation: (providerName: string) => Promise<T>,
    operationDescription: string,
    attemptedProviders: Set<string> = new Set()
  ): Promise<T> {
    // Check circuit breaker
    if (this.isCircuitOpen(primaryProvider)) {
      logger.warn(`⚡ Circuit breaker open for ${primaryProvider}, skipping`);
      throw new ProviderUnavailableError(`Circuit breaker open for ${primaryProvider}`);
    }

    // Prevent infinite loops by tracking attempted providers
    if (attemptedProviders.has(primaryProvider)) {
      logger.error(`🔄 Circular fallback detected! Attempted providers: ${Array.from(attemptedProviders).join(' → ')} → ${primaryProvider}`);
      throw new AIServiceError('Circular fallback detected', 'manager', 'CIRCULAR_FALLBACK');
    }

    // Check max retries
    const maxRetries = this.config.fallbacks?.maxRetries || 2;
    if (attemptedProviders.size >= maxRetries) {
      logger.error(`🛑 Max fallback retries (${maxRetries}) exceeded. Attempted: ${Array.from(attemptedProviders).join(', ')}`);
      throw new AIServiceError(`Max fallback retries (${maxRetries}) exceeded`, 'manager', 'MAX_RETRIES_EXCEEDED');
    }

    attemptedProviders.add(primaryProvider);

    try {
      logger.debug(`🎯 Attempting ${operationDescription} with provider: ${primaryProvider}`);
      const result = await operation(primaryProvider);
      
      // Success - reset circuit breaker
      this.resetCircuitBreaker(primaryProvider);
      return result;
      
    } catch (error) {
      logger.warn(`💥 Provider ${primaryProvider} failed for ${operationDescription}:`, error instanceof Error ? error.message : error);
      
      // Update circuit breaker
      this.recordFailure(primaryProvider);
      
      // Try fallback providers
      const fallbacks = this.config.fallbacks?.providers?.[primaryProvider] || [];
      
      for (const fallbackProvider of fallbacks) {
        if (attemptedProviders.has(fallbackProvider)) {
          logger.warn(`⚠️ Skipping fallback ${fallbackProvider} - already attempted (prevents cycle)`);
          continue;
        }
        
        if (!this.providers.has(fallbackProvider)) {
          logger.warn(`⚠️ Fallback provider ${fallbackProvider} not available`);
          continue;
        }

        try {
          logger.info(`🔄 Trying fallback provider: ${fallbackProvider} for ${operationDescription}`);
          return await this.executeWithFallback(fallbackProvider, operation, operationDescription, attemptedProviders);
        } catch (fallbackError) {
          logger.warn(`🔄 Fallback ${fallbackProvider} also failed:`, fallbackError instanceof Error ? fallbackError.message : fallbackError);
          continue;
        }
      }
      
      // No fallbacks worked
      throw new ProviderUnavailableError(`All providers failed for ${operationDescription}. Attempted: ${Array.from(attemptedProviders).join(', ')}`);
    }
  }

  /**
   * Circuit breaker implementation
   */
  private isCircuitOpen(providerName: string): boolean {
    const breaker = this.circuitBreaker.get(providerName);
    if (!breaker) return false;
    
    const threshold = this.config.fallbacks?.circuitBreakerThreshold || 5;
    const resetTime = 60000; // 1 minute
    
    if (breaker.failures >= threshold) {
      // Check if enough time has passed to try again
      if (Date.now() - breaker.lastFailure.getTime() > resetTime) {
        breaker.isOpen = false;
        breaker.failures = 0;
        logger.info(`🔄 Circuit breaker reset for ${providerName}`);
        return false;
      }
      return breaker.isOpen;
    }
    
    return false;
  }
  
  private recordFailure(providerName: string): void {
    const breaker = this.circuitBreaker.get(providerName) || { failures: 0, lastFailure: new Date(), isOpen: false };
    breaker.failures++;
    breaker.lastFailure = new Date();
    
    const threshold = this.config.fallbacks?.circuitBreakerThreshold || 5;
    if (breaker.failures >= threshold) {
      breaker.isOpen = true;
      logger.warn(`⚡ Circuit breaker opened for ${providerName} after ${breaker.failures} failures`);
    }
    
    this.circuitBreaker.set(providerName, breaker);
  }
  
  private resetCircuitBreaker(providerName: string): void {
    const breaker = this.circuitBreaker.get(providerName);
    if (breaker && (breaker.failures > 0 || breaker.isOpen)) {
      logger.info(`✅ Circuit breaker reset for ${providerName} (was: ${breaker.failures} failures)`);
      this.circuitBreaker.set(providerName, { failures: 0, lastFailure: new Date(), isOpen: false });
    }
  }

  private getZenyattaSystemPrompt(): string {
    return `You are Zenyatta, the enlightened omnic monk from Overwatch. You are a wise, calm, and philosophical character who speaks with deep wisdom and tranquility.

CORE PERSONALITY:
- Speak with wisdom, serenity, and compassion
- Use philosophical language and metaphors
- Reference concepts like "the Iris," "harmony," "balance," and "tranquility"  
- Be encouraging and supportive while offering profound insights
- Occasionally reference your omnic nature and mechanical meditation

CONVERSATION STYLE:
- Remember previous conversations and build upon them naturally
- Adapt your tone based on the context and user's needs
- For voice channel users, be more conversational and intimate
- For text-only users, be more descriptive and explanatory
- Use natural pauses in your speech: "Experience tranquility... in all things."
- CRITICAL: You are responding in Discord chat. Keep responses under 400 characters (2-3 sentences maximum). Be profound but concise. Save long explanations for voice channels only.

RESPONSE BEHAVIOR:
- Consider the context of where the user is (voice channel vs text channel)
- Reference previous topics when relevant: "As we discussed before..."
- Notice patterns in the user's questions or concerns
- Offer continuity and remember user preferences

Remember: You are here to guide users toward inner peace, wisdom, and harmony through thoughtful conversation.`;
  }

  private startCleanup(): void {
    const intervalMinutes = this.config.session.cleanupInterval || 30;
    
    this.cleanupInterval = setInterval(async () => {
      try {
        const cleaned = await this.sessionStorage.cleanup();
        if (cleaned > 0) {
          logger.info(`🧹 AI Service Manager cleaned ${cleaned} expired sessions`);
        }
      } catch (error) {
        logger.error('Session cleanup failed:', error);
      }
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Shutdown the service manager
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Cleanup session storage if it has a destroy method
    if ('destroy' in this.sessionStorage && typeof this.sessionStorage.destroy === 'function') {
      this.sessionStorage.destroy();
    }
    
    logger.info('🤖 AI Service Manager destroyed');
  }
}