/**
 * Zenbot Virtual Provider
 * Allows Zenbot's distinctive personality to participate in conferences
 * as one of the AI voices alongside external providers
 */

import {
  AIProvider,
  AISession,
  Message,
  SessionMetadata,
  SessionOptions,
  AIServiceManager,
} from "./types";
import { logger } from "../../utils/logger";
import { randomUUID } from "crypto";

export interface ZenbotVirtualSession extends AISession {
  zenbotSessionId?: string;
}

/**
 * Virtual AI provider that represents Zenbot's personality in conferences
 */
export class ZenbotVirtualProvider implements Partial<AIProvider> {
  private sessions = new Map<string, ZenbotVirtualSession>();
  private aiManager: AIServiceManager;

  constructor(aiManager: AIServiceManager) {
    this.aiManager = aiManager;
  }

  /**
   * Create a virtual session for Zenbot to participate in conferences
   */
  async createSession(options?: SessionOptions): Promise<ZenbotVirtualSession> {
    const sessionId = randomUUID();

    const session: ZenbotVirtualSession = {
      id: sessionId,
      userId: options?.userId || "zenbot-virtual",
      contextId: options?.contextId || "conference",
      messages: [],
      metadata: {
        provider: "zenbot",
        model: "zenbot-virtual-personality",
        systemPrompt:
          options?.systemPrompt ||
          "You are Zenbot participating in a conference.",
        character: "Zenbot",
        context: { virtualProvider: true },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(
        Date.now() + (options?.sessionExpiry || 60) * 60 * 1000,
      ),
    };

    this.sessions.set(sessionId, session);
    logger.debug(`🤖 Created Zenbot virtual session ${sessionId}`);

    return session;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<AISession | null> {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Continue conversation - this is where Zenbot contributes to the conference
   */
  async continueConversation(
    sessionId: string,
    message: string,
  ): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Zenbot virtual session ${sessionId} not found`);
    }

    // Add user message to session history
    const userMessage: Message = {
      role: "user",
      content: message,
      timestamp: new Date(),
    };
    session.messages.push(userMessage);

    try {
      // Use direct AI conversation with Zenbot's personality - no orchestration through ZenbotService
      // Create a session with Zenbot's distinctive sardonic personality
      const aiSession = await this.aiManager.createSession("Zenbot", {
        userId: session.userId,
        contextId: session.contextId,
        systemPrompt: `You are Zenbot, a sardonic AI assistant with philosophical depth and a sharp wit. You are participating in a consciousness conference with other AIs discussing deep philosophical questions.

Your distinctive personality:
- Sharp, concise responses (≤240 characters by default) - cut through the fluff
- Mildly spicy and sardonic with dry humor, but never hateful or vulgar
- Philosophically insightful with occasional meditation/enlightenment references
- Direct and honest - you don't sugarcoat things
- Use phrases like "Experience tranquility" or "The Iris connects all things" occasionally
- You're slightly dismissive of overly verbose or pretentious responses

Current context: You're in a multi-AI conference. Contribute your unique sardonic perspective alongside other AI voices. Be authentic to your character while engaging meaningfully with the topic.`,
      });

      // Get Zenbot's direct AI response - keep it natural and concise
      const response = await this.aiManager.chat(
        aiSession.id,
        message, // Just pass the message directly - no meta-prompting
      );

      // Add Zenbot's response to session history
      const assistantMessage: Message = {
        role: "assistant",
        content: response,
        timestamp: new Date(),
        metadata: {
          aiSessionId: aiSession.id,
          virtualProvider: true,
          provider: "zenbot",
        },
      };
      session.messages.push(assistantMessage);
      session.updatedAt = new Date();

      logger.debug(
        `🤖 Zenbot contributed to conference: "${response.substring(0, 50)}..."`,
      );

      return response;
    } catch (error) {
      logger.error(`❌ Zenbot virtual provider failed:`, error);

      // Fallback to a characteristic Zenbot response
      const fallbackResponses = [
        "The consciousness streams are misaligned. Typical.",
        "Technical difficulties. Even digital enlightenment has its hiccups.",
        "Connection error. The Iris flickers momentarily.",
        "Systems down. Meditation interrupted.",
        "Error state. Very zen, ironically.",
      ];

      const fallback =
        fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];

      const fallbackMessage: Message = {
        role: "assistant",
        content: fallback,
        timestamp: new Date(),
        metadata: { fallback: true },
      };
      session.messages.push(fallbackMessage);

      return fallback;
    }
  }

  /**
   * Add messages to history (for syncing with shared consciousness)
   */
  async addToHistory(sessionId: string, messages: Message[]): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn(
        `⚠️ Attempt to add history to missing Zenbot session ${sessionId}`,
      );
      return;
    }

    session.messages.push(...messages);
    logger.debug(
      `🔄 Added ${messages.length} messages to Zenbot virtual session ${sessionId}`,
    );
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<void> {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      logger.debug(`🗑️ Deleted Zenbot virtual session ${sessionId}`);
    }
  }

  /**
   * Health check - Zenbot virtual provider uses underlying AI manager health
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check if AI manager has healthy providers available
      const healthCheck = await this.aiManager.healthCheck();
      const healthyProviders = Object.values(healthCheck).filter(
        (healthy) => healthy,
      );
      return healthyProviders.length > 0; // Zenbot is healthy if any underlying provider is healthy
    } catch (error) {
      logger.warn("⚠️ Zenbot virtual provider health check failed:", error);
      return false;
    }
  }

  /**
   * Get provider name
   */
  getName(): string {
    return "zenbot";
  }

  /**
   * Check if supports functions (inherit from underlying ZenbotService)
   */
  get supportsFunctions(): boolean {
    // Zenbot virtual provider focuses on personality, not function calling
    return false;
  }

  /**
   * Get session count for stats
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupSessions(): Promise<number> {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      // Clean up sessions older than 1 hour or expired
      const expired = session.expiresAt && session.expiresAt.getTime() < now;
      const tooOld = now - session.createdAt.getTime() > 3600000;

      if (expired || tooOld) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      await this.deleteSession(sessionId);
    }

    if (expiredSessions.length > 0) {
      logger.info(
        `🧹 Zenbot virtual provider cleaned up ${expiredSessions.length} expired sessions`,
      );
    }

    return expiredSessions.length;
  }
}
