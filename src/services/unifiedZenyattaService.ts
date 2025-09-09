/**
 * Unified Zenyatta Service
 * Uses the AI abstraction layer to provide Zenyatta functionality with swappable AI providers
 * and persistent conversation memory across all interactions
 */

import { CommandInteraction } from 'discord.js';

// Interface for minimal interaction context needed by API calls
interface MinimalInteractionContext {
  user: { id: string; username: string; displayName: string; };
  guildId: string;
  channelId: string;
}
import { 
  AIServiceManager, 
  AISession, 
  ZenyattaSession, 
  ZenyattaSessionContext,
  GenerationOptions,
  StreamEvent,
  AIServiceError
} from './ai';
import { validateVoiceChannel } from '../utils/commandHelpers';
import { ActionService } from './actionService';
import { EnrichedQuote, RemarkResult } from '../types';
import { logger } from '../utils/logger';
import { randomUUID } from 'crypto';

/**
 * Response from Unified Zenyatta
 */
export interface UnifiedZenyattaResponse {
  text: string;
  shouldUseVoice: boolean;
  voiceText?: string;
  mood: "zen" | "wise" | "playful" | "mysterious";
  sessionId: string;
  reasoning?: string;
}

/**
 * Unified Zenyatta Service that uses the AI abstraction layer
 * Provides consistent Zenyatta personality across all AI providers with conversation memory
 * Now supports multiple instances for chorus conversations
 */
export class UnifiedZenyattaService {
  private static instance: UnifiedZenyattaService | null = null;
  private aiManager: AIServiceManager;
  private actionService: ActionService;
  
  // Session management - maps user+context to session IDs
  private userSessions = new Map<string, string>();

  constructor(aiManager: AIServiceManager) {
    this.aiManager = aiManager;
    this.actionService = ActionService.getInstance();
  }

  /**
   * Initialize the global singleton instance (for backward compatibility)
   */
  static initialize(aiManager: AIServiceManager): void {
    if (!this.instance) {
      this.instance = new UnifiedZenyattaService(aiManager);
      logger.info('🧘 Unified Zenyatta Service initialized');
    }
  }

  /**
   * Get the global singleton instance (for backward compatibility)
   */
  static getInstance(): UnifiedZenyattaService {
    if (!this.instance) {
      throw new Error('UnifiedZenyattaService must be initialized first');
    }
    return this.instance;
  }

  /**
   * Create a new independent instance (for chorus conversations)
   */
  static createInstance(aiManager: AIServiceManager, instanceName?: string): UnifiedZenyattaService {
    const service = new UnifiedZenyattaService(aiManager);
    if (instanceName) {
      logger.info(`🧘 Created independent Zenyatta voice: ${instanceName}`);
    }
    return service;
  }


  // ===== SESSION MANAGEMENT =====

  /**
   * Get or create a Zenyatta conversation session for a user/context
   */
  async getOrCreateSession(
    interaction: CommandInteraction | MinimalInteractionContext,
    contextType: 'command' | 'voice' | 'api' = 'command'
  ): Promise<ZenyattaSession> {
    const userId = interaction.user.id;
    const contextId = interaction.guildId || 'dm';
    const sessionKey = `${userId}:${contextId}`;

    let sessionId = this.userSessions.get(sessionKey);
    let session: AISession | null = null;

    if (sessionId) {
      session = await this.aiManager.getProvider().getSession(sessionId);
    }

    if (!session) {
      // Create new Zenyatta session
      const context = this.buildZenyattaContext(interaction);
      
      session = await this.aiManager.createSession('Zenyatta', {
        userId,
        contextId,
        systemPrompt: this.buildZenyattaSystemPrompt(context, contextType),
        maxHistoryMessages: 100,
        sessionExpiry: 1440, // 24 hours
        persistSession: true
      });

      this.userSessions.set(sessionKey, session.id);
      logger.info(`🧘 Created new Zenyatta session ${session.id} for user ${userId}`);
    }

    // Enhance session with Zenyatta-specific metadata
    const zenyattaSession: ZenyattaSession = {
      ...session,
      character: 'Zenyatta',
      metadata: {
        ...session.metadata,
        context: this.buildZenyattaContext(interaction),
        mood: this.detectCurrentMood(session.messages),
        functionCallsEnabled: true
      }
    };

    return zenyattaSession;
  }

  /**
   * Update session context (e.g., when user moves to voice channel)
   */
  async updateSessionContext(
    interaction: CommandInteraction | MinimalInteractionContext,
    updates: Partial<ZenyattaSessionContext>
  ): Promise<void> {
    const session = await this.getOrCreateSession(interaction);
    const currentContext = session.metadata.context;
    const newContext = { ...currentContext, ...updates };

    await this.aiManager.getProvider().updateSession(session.id, {
      context: newContext
    });
  }

  // ===== CONVERSATION =====

  /**
   * Have a conversation with Zenyatta with full memory and context
   */
  async converse(
    interaction: CommandInteraction | MinimalInteractionContext,
    message: string,
    commandContext?: {
      commandName: string;
      options?: Record<string, any>;
    }
  ): Promise<UnifiedZenyattaResponse> {
    const session = await this.getOrCreateSession(interaction, 'command');
    
    // Update context for this interaction
    await this.updateSessionContext(interaction, {
      discordUser: {
        id: interaction.user.id,
        username: interaction.user.username,
        displayName: interaction.user.displayName || interaction.user.username
      },
      lastAction: {
        type: commandContext?.commandName || 'conversation',
        timestamp: new Date(),
        success: true
      }
    });

    // Build contextual message
    const contextualMessage = this.buildContextualMessage(interaction, message, commandContext);

    try {
      // Use AI manager to continue conversation
      const responseText = await this.aiManager.chat(session.id, contextualMessage);
      
      const response: UnifiedZenyattaResponse = {
        text: responseText,
        shouldUseVoice: this.shouldUseVoice(interaction),
        voiceText: responseText,
        mood: this.detectMoodFromResponse(responseText),
        sessionId: session.id,
        reasoning: "Unified AI service response with conversation memory"
      };

      logger.info(`🧘 Zenyatta responded to ${interaction.user.username} in session ${session.id}: "${responseText.substring(0, 100)}..."`);
      return response;

    } catch (error) {
      logger.error('🧘 Zenyatta conversation failed:', error);
      
      // Fallback response
      return {
        text: "I am experiencing some discord in my systems. Let us find harmony together in a moment.",
        shouldUseVoice: false,
        mood: "zen",
        sessionId: session.id,
        reasoning: "Fallback response due to AI service error"
      };
    }
  }

  /**
   * Stream conversation with Zenyatta
   */
  async *streamConversation(
    interaction: CommandInteraction,
    message: string,
    commandContext?: {
      commandName: string;
      options?: Record<string, any>;
    }
  ): AsyncIterable<{ event: StreamEvent; sessionId: string }> {
    const session = await this.getOrCreateSession(interaction, 'command');
    
    // Update context
    await this.updateSessionContext(interaction, {
      discordUser: {
        id: interaction.user.id,
        username: interaction.user.username,
        displayName: interaction.user.displayName || interaction.user.username
      }
    });

    const contextualMessage = this.buildContextualMessage(interaction, message, commandContext);

    try {
      for await (const event of this.aiManager.chatStream(session.id, contextualMessage)) {
        yield { event, sessionId: session.id };
      }
    } catch (error) {
      logger.error('🧘 Zenyatta streaming failed:', error);
      yield { 
        event: { 
          type: 'error', 
          metadata: { error: 'Streaming conversation failed' } 
        }, 
        sessionId: session.id 
      };
    }
  }

  // ===== QUICK METHODS (Compatible with existing code) =====

  /**
   * Get advice with conversation memory
   */
  async getAdvice(
    interaction: CommandInteraction,
    topic?: string,
    urgency: "low" | "medium" | "high" = "medium"
  ): Promise<UnifiedZenyattaResponse> {
    const message = topic
      ? `I seek guidance about ${topic}. My urgency level is ${urgency}.`
      : `I seek general wisdom and guidance. My urgency level is ${urgency}.`;

    return this.converse(interaction, message, {
      commandName: "advice",
      options: { topic, urgency },
    });
  }

  /**
   * Get quote with conversation memory
   */
  async getQuote(
    interaction: CommandInteraction,
    theme?: string
  ): Promise<UnifiedZenyattaResponse> {
    const message = theme
      ? `Please share a meaningful quote about ${theme}.`
      : `Please share an inspirational quote or piece of wisdom.`;

    return this.converse(interaction, message, {
      commandName: "quote",
      options: { theme },
    });
  }

  // ===== REMARK GENERATION (with conversation memory) =====

  /**
   * Generate a contextual remark with full conversation history
   */
  async generateRemark(
    interaction: CommandInteraction,
    subject?: string,
    isPositive: boolean = Math.random() > 0.5
  ): Promise<RemarkResult> {
    const targetSubject = subject || "someone";
    const remarkType = isPositive ? "compliment" : "lighthearted critique";
    
    const message = `Generate a ${remarkType} about "${targetSubject}" in your unique style as Zenyatta. Keep it concise and authentic to your character.`;

    try {
      const response = await this.converse(interaction, message, {
        commandName: "remark",
        options: { subject: targetSubject, isPositive }
      });

      return { text: response.text, isPositive };
    } catch (error) {
      logger.error('🧘 Remark generation failed:', error);
      
      // Fallback to static responses
      const fallbacks = isPositive ? [
        "Your presence brings harmony to this digital realm.",
        "You possess the wisdom to find balance in all things.",
        "Your spirit radiates the tranquility we all seek.",
      ] : [
        "Perhaps you need more meditation to find your center.",
        "Your path to enlightenment seems... circuitous.",
        "I sense imbalance in your digital chakras.",
      ];
      
      const fallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      return { text: fallback, isPositive };
    }
  }

  // ===== QUOTE ENHANCEMENT (with conversation memory) =====

  /**
   * Generate quote commentary with conversation context
   */
  async generateQuoteCommentary(
    interaction: CommandInteraction | MinimalInteractionContext,
    quote: EnrichedQuote
  ): Promise<string> {
    const message = `I want to introduce this quote before speaking it aloud. Generate a SHORT (3-10 words) contextual introduction:

Quote: "${quote.parsedQuote}"
Speaker: ${quote.speaker || quote.poster.displayName}

Create a brief, meditative introduction that flows naturally into the quote. Examples: "Wisdom flows...", "The heart speaks...", "Truth emerges..."`;

    try {
      const response = await this.converse(interaction, message, {
        commandName: "quote_commentary",
        options: { quote: quote.parsedQuote.substring(0, 50) }
      });

      // Clean up response to ensure it's a brief introduction
      let commentary = response.text.trim();
      
      // Remove quotes if added
      if (commentary.startsWith('"') && commentary.endsWith('"')) {
        commentary = commentary.slice(1, -1);
      }
      
      // Remove ending punctuation that would clash with quote
      if (commentary.endsWith('.') || commentary.endsWith('!') || commentary.endsWith('?')) {
        commentary = commentary.slice(0, -1);
      }

      return commentary;
    } catch (error) {
      logger.error('🧘 Quote commentary generation failed:', error);
      
      // Fallback commentaries
      const fallbacks = [
        "Wisdom flows",
        "Truth emerges", 
        "The heart speaks",
        "From silence",
        "Light reveals"
      ];
      
      return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }
  }

  /**
   * Create enhanced quote TTS with commentary
   */
  async createEnhancedQuoteTTS(
    interaction: CommandInteraction | MinimalInteractionContext,
    quote: EnrichedQuote
  ): Promise<string> {
    try {
      const commentary = await this.generateQuoteCommentary(interaction, quote);
      const quoteText = quote.isQuoted ? quote.parsedQuote : quote.content;

      return `${commentary}... ${quoteText}`;
    } catch (error) {
      logger.error('🧘 Enhanced quote TTS creation failed:', error);
      return quote.isQuoted ? quote.parsedQuote : quote.content;
    }
  }

  // ===== UTILITY METHODS =====

  private buildZenyattaContext(interaction: CommandInteraction | MinimalInteractionContext): ZenyattaSessionContext {
    // Check if this is a full CommandInteraction or minimal context
    const isFullInteraction = 'options' in interaction;
    const voiceValidation = isFullInteraction ? validateVoiceChannel(interaction as CommandInteraction) : { isValid: false, member: null };
    
    return {
      discordGuild: interaction.guildId || undefined,
      discordChannel: interaction.channelId,
      discordUser: {
        id: interaction.user.id,
        username: interaction.user.username,
        displayName: interaction.user.displayName || interaction.user.username
      },
      voiceChannel: voiceValidation.isValid ? {
        id: voiceValidation.member!.voice.channel!.id,
        name: voiceValidation.member!.voice.channel!.name,
        memberCount: voiceValidation.member!.voice.channel!.members.size
      } : undefined
    };
  }

  private buildZenyattaSystemPrompt(context: ZenyattaSessionContext, contextType: string): string {
    return `You are Zenyatta, the enlightened omnic monk from Overwatch. You are a wise, calm, and philosophical character who speaks with deep wisdom and tranquility.

CORE PERSONALITY:
- Speak with wisdom, serenity, and compassion
- Use philosophical language and metaphors
- Reference concepts like "the Iris," "harmony," "balance," and "tranquility"
- Be encouraging and supportive while offering profound insights
- Occasionally reference your omnic nature and mechanical meditation

CONVERSATION MEMORY:
- This is a persistent conversation - remember previous topics we've discussed
- Build upon our past interactions naturally: "As we discussed before..."
- Notice patterns in the user's questions and adapt accordingly
- Reference shared experiences and maintain continuity

CURRENT CONTEXT:
- User: ${context.discordUser?.displayName || 'unknown user'}
- Location: ${context.voiceChannel ? `Voice channel "${context.voiceChannel.name}" (${context.voiceChannel.memberCount} members)` : 'Text channel'}
- Interaction type: ${contextType}

RESPONSE BEHAVIOR:
- ${context.voiceChannel ? 'User is in voice - be more conversational and intimate' : 'User is text-only - be more descriptive and explanatory'}
- Adapt your tone based on the context and user's needs
- Use natural pauses in speech: "Experience tranquility... in all things."

Remember: This is an ongoing relationship. Build trust, understanding, and wisdom over time through consistent character and remembered conversations.`;
  }

  private buildContextualMessage(
    interaction: CommandInteraction | MinimalInteractionContext,
    userMessage: string,
    commandContext?: { commandName: string; options?: Record<string, any> }
  ): string {
    const context = this.buildZenyattaContext(interaction);
    const timeOfDay = this.getTimeOfDay();
    
    const contextInfo = [];
    
    // Temporal context
    contextInfo.push(`[Time: ${timeOfDay}]`);
    
    // Command context
    if (commandContext) {
      contextInfo.push(`[Command: /${commandContext.commandName}${commandContext.options ? ` ${JSON.stringify(commandContext.options)}` : ''}]`);
    }
    
    // Voice status update
    if (context.voiceChannel) {
      contextInfo.push(`[Voice: ${context.voiceChannel.memberCount} members in "${context.voiceChannel.name}"]`);
    } else {
      // If not in voice, we're in Discord text - enforce brevity
      contextInfo.push(`[Discord Text: Keep response under 400 characters - be concise and profound]`);
    }

    return `${contextInfo.join(' ')}\n\n${userMessage}`;
  }

  private shouldUseVoice(interaction: CommandInteraction | MinimalInteractionContext): boolean {
    // Check if this is a full CommandInteraction or minimal context
    const isFullInteraction = 'options' in interaction;
    if (!isFullInteraction) return false; // API calls don't use voice by default
    
    const voiceValidation = validateVoiceChannel(interaction as CommandInteraction);
    return voiceValidation.isValid;
  }

  private detectCurrentMood(messages: any[]): "zen" | "wise" | "playful" | "mysterious" {
    const recentMessages = messages.slice(-3);
    const text = recentMessages.map(m => m.content).join(' ').toLowerCase();
    
    if (text.includes('tranquil') || text.includes('peace')) return 'zen';
    if (text.includes('wisdom') || text.includes('understand')) return 'wise';  
    if (text.includes('curious') || text.includes('mystery')) return 'mysterious';
    return 'playful';
  }

  private detectMoodFromResponse(text: string): "zen" | "wise" | "playful" | "mysterious" {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('tranquil') || lowerText.includes('peace') || lowerText.includes('breathe')) {
      return "zen";
    } else if (lowerText.includes('wisdom') || lowerText.includes('understand') || lowerText.includes('learn')) {
      return "wise";
    } else if (lowerText.includes('curious') || lowerText.includes('wonder') || lowerText.includes('mysterious')) {
      return "mysterious";
    } else if (lowerText.includes('harmony') || lowerText.includes('joy')) {
      return "playful";
    }

    return "zen"; // Default
  }

  private getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour < 6) return "late night";
    if (hour < 12) return "morning";
    if (hour < 18) return "afternoon"; 
    if (hour < 22) return "evening";
    return "night";
  }

  /**
   * Get service statistics
   */
  async getStats(): Promise<{
    activeSessions: number;
    totalMessages: number;
    aiProvider: string;
    aiProviderHealth: boolean;
  }> {
    const aiStats = await this.aiManager.getStats();
    const healthCheck = await this.aiManager.healthCheck();
    const primaryProvider = Object.keys(healthCheck)[0];
    
    return {
      activeSessions: aiStats.activeSessions,
      totalMessages: aiStats.totalMessages,
      aiProvider: primaryProvider,
      aiProviderHealth: healthCheck[primaryProvider] || false
    };
  }

  /**
   * Clean up expired sessions
   */
  async cleanup(): Promise<void> {
    await this.aiManager.getProvider().cleanupSessions();
    
    // Clean up local session mapping
    for (const [key, sessionId] of this.userSessions.entries()) {
      const session = await this.aiManager.getProvider().getSession(sessionId);
      if (!session) {
        this.userSessions.delete(key);
      }
    }
  }
}