/**
 * Google Gemini Provider Implementation
 * Supports Gemini models with conversation memory
 */

import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { BaseAIProvider } from "../baseProvider";
import {
  GenerationOptions,
  StreamEvent,
  Message,
  SessionStorage,
  AIServiceError,
  FunctionDefinition,
  FunctionCall,
} from "../types";
import { logger } from "../../../utils/logger";

export class GeminiProvider extends BaseAIProvider {
  readonly name = "gemini";
  readonly supportedModels = ["gemini-2.5-flash"];
  readonly supportsStreaming = true;
  readonly supportsFunctions = true; // Via function calling
  readonly supportsVision = true;

  private client: GoogleGenerativeAI;
  private models = new Map<string, GenerativeModel>();

  constructor(
    sessionStorage: SessionStorage,
    config: { apiKey: string; baseURL?: string } & Record<string, any>,
  ) {
    super(sessionStorage, config);

    if (!config.apiKey) {
      throw new AIServiceError(
        "Google AI API key is required",
        this.name,
        "MISSING_API_KEY",
      );
    }

    this.client = new GoogleGenerativeAI(config.apiKey);
  }

  private getModel(modelName: string = "gemini-2.5-flash"): GenerativeModel {
    if (!this.models.has(modelName)) {
      this.models.set(
        modelName,
        this.client.getGenerativeModel({ model: modelName }),
      );
    }
    return this.models.get(modelName)!;
  }

  // ===== SIMPLE TEXT GENERATION =====

  async generateText(
    prompt: string,
    options: GenerationOptions = {},
  ): Promise<string> {
    try {
      const model = this.getModel(options.model);

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options.temperature || 0.7,
          maxOutputTokens: options.maxTokens || 4000,
          topP: options.topP || 0.95,
          stopSequences: options.stopSequences,
        },
      });

      const response = await result.response;
      const text = response.text();

      if (!text) {
        throw new AIServiceError(
          "No response content received",
          this.name,
          "EMPTY_RESPONSE",
        );
      }

      return text.trim();
    } catch (error) {
      logger.error("Gemini text generation failed:", error);
      throw new AIServiceError(
        `Text generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        this.name,
        "GENERATION_FAILED",
        error instanceof Error ? error : undefined,
      );
    }
  }

  async *generateTextStream(
    prompt: string,
    options: GenerationOptions = {},
  ): AsyncIterable<StreamEvent> {
    try {
      yield { type: "start" };

      const model = this.getModel(options.model);

      const result = await model.generateContentStream({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options.temperature || 0.7,
          maxOutputTokens: options.maxTokens || 4000,
          topP: options.topP || 0.95,
          stopSequences: options.stopSequences,
        },
      });

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          yield { type: "delta", content: chunkText };
        }
      }

      yield { type: "complete" };
    } catch (error) {
      logger.error("Gemini streaming failed:", error);
      yield {
        type: "error",
        metadata: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  // ===== CONVERSATION WITH MEMORY =====

  protected formatMessagesForProvider(messages: Message[]): any[] {
    // Convert messages to Gemini format
    const geminiMessages = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        // Gemini doesn't have system role, so we'll prepend system message to first user message
        continue;
      }

      geminiMessages.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }

    // Add system message as context to first user message if present
    const systemMessage = messages.find((m) => m.role === "system");
    if (
      systemMessage &&
      geminiMessages.length > 0 &&
      geminiMessages[0].role === "user"
    ) {
      const originalText = geminiMessages[0].parts[0].text;
      geminiMessages[0].parts[0].text = `${systemMessage.content}\n\nUser: ${originalText}`;
    }

    return geminiMessages;
  }

  protected async generateConversationResponse(
    geminiMessages: any[],
    options: GenerationOptions = {},
  ): Promise<string> {
    try {
      const model = this.getModel(options.model);

      const result = await model.generateContent({
        contents: geminiMessages,
        generationConfig: {
          temperature: options.temperature || 0.7,
          maxOutputTokens: options.maxTokens || 4000,
          topP: options.topP || 0.95,
          stopSequences: options.stopSequences,
        },
      });

      const response = await result.response;

      // Enhanced debugging for Gemini responses
      logger.debug(
        `🔍 Gemini response candidates: ${response.candidates?.length || 0}`,
      );

      if (!response.candidates || response.candidates.length === 0) {
        logger.error("❌ Gemini returned no candidates");
        throw new AIServiceError(
          "No response candidates received from Gemini",
          this.name,
          "NO_CANDIDATES",
        );
      }

      const candidate = response.candidates[0];
      logger.debug(
        `🔍 Gemini candidate finish reason: ${candidate.finishReason}`,
      );

      if (candidate.finishReason && candidate.finishReason !== "STOP") {
        logger.warn(`⚠️ Gemini response blocked: ${candidate.finishReason}`);
        if (candidate.finishReason === "SAFETY") {
          throw new AIServiceError(
            "Response blocked by Gemini safety filters",
            this.name,
            "SAFETY_BLOCKED",
          );
        }
        throw new AIServiceError(
          `Response generation stopped: ${candidate.finishReason}`,
          this.name,
          "GENERATION_STOPPED",
        );
      }

      const text = response.text();
      logger.debug(`🔍 Gemini response text length: ${text?.length || 0}`);

      if (!text || text.trim().length === 0) {
        throw new AIServiceError(
          "No response content received",
          this.name,
          "EMPTY_RESPONSE",
        );
      }

      return text.trim();
    } catch (error) {
      throw new AIServiceError(
        `Conversation generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        this.name,
        "GENERATION_FAILED",
        error instanceof Error ? error : undefined,
      );
    }
  }

  async *generateConversationStream(
    geminiMessages: any[],
    options: GenerationOptions = {},
  ): AsyncIterable<StreamEvent> {
    try {
      yield { type: "start" };

      const model = this.getModel(options.model);

      const result = await model.generateContentStream({
        contents: geminiMessages,
        generationConfig: {
          temperature: options.temperature || 0.7,
          maxOutputTokens: options.maxTokens || 4000,
          topP: options.topP || 0.95,
          stopSequences: options.stopSequences,
        },
      });

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          yield { type: "delta", content: chunkText };
        }
      }

      yield { type: "complete" };
    } catch (error) {
      logger.error("Gemini conversation streaming failed:", error);
      yield {
        type: "error",
        metadata: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  // Override conversation methods to use Gemini format
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
      id: crypto.randomUUID(),
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };

    session.messages.push(userMsg);

    // Format messages for Gemini
    const geminiMessages = this.formatMessagesForProvider(session.messages);

    try {
      // Generate response
      const response = await this.generateConversationResponse(geminiMessages, {
        ...options,
        model: options.model || session.metadata.model,
        temperature: options.temperature || session.metadata.temperature,
      });

      // Add assistant response to history
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
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
        `💬 Gemini conversation in session ${sessionId}: ${response.substring(0, 100)}...`,
      );
      return response;
    } catch (error) {
      logger.error(
        `❌ Gemini conversation failed in session ${sessionId}:`,
        error,
      );
      throw error; // Re-throw AIServiceError
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
      id: crypto.randomUUID(),
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };

    session.messages.push(userMsg);

    // Format messages for Gemini
    const geminiMessages = this.formatMessagesForProvider(session.messages);

    let fullResponse = "";

    try {
      // Stream response
      for await (const event of this.generateConversationStream(
        geminiMessages,
        {
          ...options,
          model: options.model || session.metadata.model,
          temperature: options.temperature || session.metadata.temperature,
        },
      )) {
        if (event.type === "delta" && event.content) {
          fullResponse += event.content;
        }
        yield event;
      }

      // Add complete response to history
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
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
    } catch (error) {
      logger.error(
        `❌ Gemini streaming failed in session ${sessionId}:`,
        error,
      );
      yield {
        type: "error",
        metadata: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  // ===== FUNCTION CALLING =====

  async callFunctions(
    sessionId: string,
    userMessage: string,
    functions: FunctionDefinition[],
    options: GenerationOptions = {},
  ): Promise<{ response: string; functionCalls: FunctionCall[] }> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new AIServiceError(
        `Session ${sessionId} not found`,
        this.name,
        "SESSION_NOT_FOUND",
      );
    }

    // Record user message
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };
    session.messages.push(userMsg);

    // Format existing history for Gemini
    const geminiMessages = this.formatMessagesForProvider(session.messages);

    // Build Gemini function declarations
    const functionDeclarations = functions.map((fn) => ({
      name: fn.name,
      description: fn.description,
      parameters: fn.parameters, // Assumes already JSON schema style
    }));

    try {
      const model = this.getModel(options.model);
      const generationConfig = {
        temperature: options.temperature || session.metadata.temperature || 0.7,
        maxOutputTokens: options.maxTokens || 1000,
        topP: options.topP || 0.95,
        stopSequences: options.stopSequences,
      };

      const result = await model.generateContent({
        contents: geminiMessages,
        tools: functionDeclarations.length
          ? [
              {
                functionDeclarations: functionDeclarations as any,
              },
            ]
          : undefined,
        generationConfig,
      });

      const response = await result.response;
      if (!response) {
        throw new AIServiceError(
          "No response received from Gemini",
          this.name,
          "EMPTY_RESPONSE",
        );
      }

      const candidate = response.candidates?.[0];
      const parts: any[] = candidate?.content?.parts || [];

      const functionCalls: FunctionCall[] = [];
      const textParts: string[] = [];

      for (const part of parts) {
        if (part.functionCall) {
          try {
            const fc = part.functionCall;
            functionCalls.push({
              id: fc.id || crypto.randomUUID(),
              name: fc.name,
              arguments:
                typeof fc.args === "string"
                  ? JSON.parse(fc.args || "{}")
                  : fc.args || {},
            });
          } catch (err) {
            logger.warn("⚠️ Failed to parse Gemini function call args:", err);
          }
        } else if (part.text) {
          textParts.push(part.text);
        }
      }

      const responseText = textParts.join("\n").trim();

      // Store assistant message (even if only function calls)
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: responseText || (functionCalls.length ? "" : "(no response)"),
        timestamp: new Date(),
        metadata: functionCalls.length
          ? { functionCalls: functionCalls.map((f) => ({ name: f.name })) }
          : undefined,
      };
      session.messages.push(assistantMsg);

      await this.trimSessionHistory(session);
      session.updatedAt = new Date();
      await this.sessionStorage.update(sessionId, {
        messages: session.messages,
        updatedAt: session.updatedAt,
      });

      logger.debug(
        `🔧 Gemini function calling produced ${functionCalls.length} call(s) and ${responseText.length} text chars`,
      );

      return { response: responseText, functionCalls };
    } catch (error) {
      logger.error("Gemini function calling failed, falling back:", error);
      // Fallback: behave like normal conversation
      const fallback = await this.continueConversation(
        sessionId,
        userMessage,
        options,
      );
      return { response: fallback, functionCalls: [] };
    }
  }

  // ===== HEALTH CHECK =====

  async healthCheck(): Promise<boolean> {
    try {
      // Simple test generation to check API connectivity
      const model = this.getModel();
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: "Hello" }] }],
        generationConfig: { maxOutputTokens: 10 },
      });

      const response = await result.response;
      return !!response.text();
    } catch (error) {
      logger.error("Gemini health check failed:", error);
      return false;
    }
  }
}
