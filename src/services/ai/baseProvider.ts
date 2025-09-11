/**
 * Base AI Provider Implementation
 * Provides common session management functionality that all providers can extend
 */

import {
  AIProvider,
  AISession,
  SessionOptions,
  SessionMetadata,
  Message,
  SessionStorage,
  GenerationOptions,
  StreamEvent,
  AIServiceError,
} from "./types";
import { logger } from "../../utils/logger";
import { randomUUID } from "crypto";

export abstract class BaseAIProvider implements AIProvider {
  abstract readonly name: string;
  abstract readonly supportedModels: string[];
  abstract readonly supportsStreaming: boolean;
  abstract readonly supportsFunctions: boolean;
  abstract readonly supportsVision: boolean;

  protected sessionStorage: SessionStorage;
  protected config: Record<string, any>;

  constructor(
    sessionStorage: SessionStorage,
    config: Record<string, any> = {},
  ) {
    this.sessionStorage = sessionStorage;
    this.config = config;
  }

  // ===== ABSTRACT METHODS (MUST BE IMPLEMENTED BY PROVIDERS) =====

  /**
   * Provider-specific text generation implementation
   */
  abstract generateText(
    prompt: string,
    options?: GenerationOptions,
  ): Promise<string>;

  /**
   * Provider-specific streaming implementation
   */
  abstract generateTextStream(
    prompt: string,
    options?: GenerationOptions,
  ): AsyncIterable<StreamEvent>;

  /**
   * Provider-specific health check
   */
  abstract healthCheck(): Promise<boolean>;

  // ===== SESSION MANAGEMENT (COMMON IMPLEMENTATION) =====

  async createSession(options: SessionOptions = {}): Promise<AISession> {
    const sessionId = options.sessionId || randomUUID();
    const now = new Date();
    const expiresAt = options.sessionExpiry
      ? new Date(now.getTime() + options.sessionExpiry * 60 * 1000)
      : new Date(now.getTime() + 24 * 60 * 60 * 1000); // Default 24 hours

    const session: AISession = {
      id: sessionId,
      userId: options.userId,
      contextId: options.contextId,
      messages: [],
      metadata: {
        provider: this.name,
        model: options.model || this.supportedModels[0],
        systemPrompt: options.systemPrompt,
        maxMessages: options.maxHistoryMessages || 50,
        temperature: options.temperature || 0.7,
        character: "Zenbot",
        context: {},
      },
      createdAt: now,
      updatedAt: now,
      expiresAt: options.persistSession ? undefined : expiresAt,
    };

    // Add system message if provided
    if (options.systemPrompt) {
      session.messages.push({
        id: randomUUID(),
        role: "system",
        content: options.systemPrompt,
        timestamp: now,
      });
    }

    await this.sessionStorage.save(session);

    logger.info(
      `🤖 Created AI session ${sessionId} with provider ${this.name}`,
    );
    return session;
  }

  async getSession(sessionId: string): Promise<AISession | null> {
    return this.sessionStorage.get(sessionId);
  }

  async updateSession(
    sessionId: string,
    updates: Partial<SessionMetadata>,
  ): Promise<AISession> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new AIServiceError(
        `Session ${sessionId} not found`,
        this.name,
        "SESSION_NOT_FOUND",
      );
    }

    session.metadata = { ...session.metadata, ...updates };
    session.updatedAt = new Date();

    await this.sessionStorage.update(sessionId, {
      metadata: session.metadata,
      updatedAt: session.updatedAt,
    });
    return session;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.sessionStorage.delete(sessionId);
    logger.info(`🗑️ Deleted AI session ${sessionId}`);
  }

  async listSessions(
    userId?: string,
    contextId?: string,
  ): Promise<AISession[]> {
    return this.sessionStorage.find({ userId, contextId });
  }

  async cleanupSessions(): Promise<number> {
    const cleaned = await this.sessionStorage.cleanup();
    if (cleaned > 0) {
      logger.info(`🧹 Cleaned up ${cleaned} expired AI sessions`);
    }
    return cleaned;
  }

  // ===== CONVERSATION WITH MEMORY =====

  async continueConversation(
    sessionId: string,
    userMessage: string,
    options: GenerationOptions = {},
  ): Promise<string> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new AIServiceError(
        `Session ${sessionId} not found`,
        this.name,
        "SESSION_NOT_FOUND",
      );
    }

    // Add user message to history
    const userMsg: Message = {
      id: randomUUID(),
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };

    session.messages.push(userMsg);

    // Build conversation context
    const conversationPrompt = this.buildConversationPrompt(session, options);

    try {
      // Generate response
      const response = await this.generateText(conversationPrompt, {
        ...options,
        model: options.model || session.metadata.model,
        temperature: options.temperature || session.metadata.temperature,
      });

      // Add assistant response to history
      const assistantMsg: Message = {
        id: randomUUID(),
        role: "assistant",
        content: response,
        timestamp: new Date(),
      };

      session.messages.push(assistantMsg);

      // Trim history if needed
      await this.trimSessionHistory(session);

      // Update session
      session.updatedAt = new Date();
      await this.sessionStorage.update(sessionId, {
        messages: session.messages,
        updatedAt: session.updatedAt,
      });

      logger.info(
        `💬 AI conversation in session ${sessionId}: ${response.substring(0, 100)}...`,
      );
      return response;
    } catch (error) {
      logger.error(`❌ AI conversation failed in session ${sessionId}:`, error);
      throw new AIServiceError(
        `Conversation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        this.name,
        "GENERATION_FAILED",
        error instanceof Error ? error : undefined,
      );
    }
  }

  async *streamConversation(
    sessionId: string,
    userMessage: string,
    options: GenerationOptions = {},
  ): AsyncIterable<StreamEvent> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new AIServiceError(
        `Session ${sessionId} not found`,
        this.name,
        "SESSION_NOT_FOUND",
      );
    }

    // Add user message to history
    const userMsg: Message = {
      id: randomUUID(),
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };

    session.messages.push(userMsg);

    // Build conversation context
    const conversationPrompt = this.buildConversationPrompt(session, options);

    let fullResponse = "";

    try {
      yield { type: "start" };

      // Stream response
      for await (const event of this.generateTextStream(conversationPrompt, {
        ...options,
        model: options.model || session.metadata.model,
        temperature: options.temperature || session.metadata.temperature,
      })) {
        if (event.type === "delta" && event.content) {
          fullResponse += event.content;
        }
        yield event;
      }

      // Add complete response to history
      const assistantMsg: Message = {
        id: randomUUID(),
        role: "assistant",
        content: fullResponse,
        timestamp: new Date(),
      };

      session.messages.push(assistantMsg);

      // Trim history if needed
      await this.trimSessionHistory(session);

      // Update session
      session.updatedAt = new Date();
      await this.sessionStorage.update(sessionId, {
        messages: session.messages,
        updatedAt: session.updatedAt,
      });

      yield { type: "complete" };
    } catch (error) {
      logger.error(`❌ AI streaming failed in session ${sessionId}:`, error);
      yield {
        type: "error",
        metadata: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  async addToHistory(sessionId: string, messages: Message[]): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new AIServiceError(
        `Session ${sessionId} not found`,
        this.name,
        "SESSION_NOT_FOUND",
      );
    }

    session.messages.push(...messages);
    await this.trimSessionHistory(session);

    session.updatedAt = new Date();
    await this.sessionStorage.update(sessionId, {
      messages: session.messages,
      updatedAt: session.updatedAt,
    });
  }

  async getHistory(sessionId: string, limit?: number): Promise<Message[]> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new AIServiceError(
        `Session ${sessionId} not found`,
        this.name,
        "SESSION_NOT_FOUND",
      );
    }

    const messages = session.messages;
    return limit ? messages.slice(-limit) : messages;
  }

  // ===== FUNCTION CALLING (DEFAULT IMPLEMENTATION) =====

  async callFunctions(
    sessionId: string,
    userMessage: string,
    functions: any[],
    options: GenerationOptions = {},
  ): Promise<{ response: string; functionCalls: any[] }> {
    if (!this.supportsFunctions) {
      throw new AIServiceError(
        `Provider ${this.name} does not support function calling`,
        this.name,
        "FUNCTIONS_NOT_SUPPORTED",
      );
    }

    // Default implementation - subclasses should override for provider-specific function calling
    const response = await this.continueConversation(
      sessionId,
      userMessage,
      options,
    );
    return { response, functionCalls: [] };
  }

  // ===== UTILITY METHODS =====

  getConfig(): Record<string, any> {
    return this.config;
  }

  /**
   * Build conversation prompt from session history
   */
  protected buildConversationPrompt(
    session: AISession,
    options: GenerationOptions = {},
  ): string {
    const messages = session.messages;

    // Use system prompt from options or session
    const systemPrompt = options.systemPrompt || session.metadata.systemPrompt;

    if (systemPrompt && messages[0]?.role !== "system") {
      // Prepend system message if not already present
      const conversationMessages: Message[] = [
        { role: "system", content: systemPrompt, timestamp: new Date() },
        ...messages.filter((m) => m.role !== "system"),
      ];
      return this.formatMessagesForProvider(conversationMessages);
    }

    return this.formatMessagesForProvider(messages);
  }

  /**
   * Format messages for provider-specific format
   * Override in subclasses for provider-specific formatting
   */
  protected formatMessagesForProvider(messages: Message[]): any {
    return messages
      .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join("\n\n");
  }

  /**
   * Trim session history to stay within limits
   */
  protected async trimSessionHistory(session: AISession): Promise<void> {
    const maxMessages = session.metadata.maxMessages || 50;

    if (session.messages.length > maxMessages) {
      // Keep system message (if any) and trim from the middle
      const systemMessages = session.messages.filter(
        (m) => m.role === "system",
      );
      const otherMessages = session.messages.filter((m) => m.role !== "system");

      if (otherMessages.length > maxMessages - systemMessages.length) {
        const keepCount = maxMessages - systemMessages.length;
        const trimmed = otherMessages.slice(-keepCount);
        session.messages = [...systemMessages, ...trimmed];

        logger.info(
          `✂️ Trimmed session ${session.id} history to ${session.messages.length} messages`,
        );
      }
    }
  }
}
