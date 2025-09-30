/**
 * OpenAI Provider Implementation
 * Supports GPT models with conversation memory and function calling
 */

import OpenAI from "openai";
import { BaseAIProvider } from "../baseProvider";
import {
  GenerationOptions,
  StreamEvent,
  FunctionDefinition,
  FunctionCall,
  Message,
  SessionStorage,
  AIServiceError,
} from "../types";
import { logger } from "../../../utils/logger";

export class OpenAIProvider extends BaseAIProvider {
  readonly name = "openai";
  readonly supportedModels = ["gpt-5", "gpt-4o", "gpt-4o-mini"];
  readonly supportsStreaming = true;
  readonly supportsFunctions = true;
  readonly supportsVision = true;

  private client: OpenAI;

  // All supported models use the new GPT-4o parameter format
  private buildChatParams(model: string, options: GenerationOptions = {}) {
    const params: any = {
      model,
      temperature: 1, // All models now use temperature=1 (GPT-4o format)
      top_p: options.topP,
      frequency_penalty: options.frequencyPenalty,
      presence_penalty: options.presencePenalty,
      stop: options.stopSequences,
      max_completion_tokens: options.maxTokens || 4000, // Use new parameter for all models
    };

    return params;
  }

  constructor(
    sessionStorage: SessionStorage,
    config: { apiKey: string; baseURL?: string } & Record<string, any>,
  ) {
    super(sessionStorage, config);

    if (!config.apiKey) {
      throw new AIServiceError(
        "OpenAI API key is required",
        this.name,
        "MISSING_API_KEY",
      );
    }

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
  }

  // ===== SIMPLE TEXT GENERATION =====

  async generateText(
    prompt: string,
    options: GenerationOptions = {},
  ): Promise<string> {
    try {
      const model = options.model || "gpt-4o-mini";
      const params = this.buildChatParams(model, options);

      const response = await this.client.chat.completions.create({
        ...params,
        messages: [{ role: "user", content: prompt }],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new AIServiceError(
          "No response content received",
          this.name,
          "EMPTY_RESPONSE",
        );
      }

      return content.trim();
    } catch (error) {
      logger.error("OpenAI text generation failed:", error);
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

      const model = options.model || "gpt-4o-mini";
      const params = this.buildChatParams(model, options);

      const stream = (await this.client.chat.completions.create({
        ...params,
        messages: [{ role: "user", content: prompt }],
        stream: true,
      })) as any;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          yield { type: "delta", content: delta };
        }
      }

      yield { type: "complete" };
    } catch (error) {
      logger.error("OpenAI streaming failed:", error);
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
    return messages.map((msg) => {
      if (msg.role === "function" || msg.role === "tool") {
        // Handle function/tool result messages for OpenAI
        return {
          role: "tool",
          content: msg.content,
          tool_call_id:
            msg.metadata?.tool_call_id ||
            msg.metadata?.functionName ||
            "unknown",
        };
      }

      return {
        role: msg.role as "system" | "user" | "assistant",
        content: msg.content,
      };
    });
  }

  protected async generateConversationResponse(
    messages: any[],
    options: GenerationOptions = {},
  ): Promise<string> {
    try {
      const model = options.model || "gpt-4o-mini";
      const params = this.buildChatParams(model, options);

      const response = await this.client.chat.completions.create({
        ...params,
        messages,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new AIServiceError(
          "No response content received",
          this.name,
          "EMPTY_RESPONSE",
        );
      }

      return content.trim();
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
    messages: any[],
    options: GenerationOptions = {},
  ): AsyncIterable<StreamEvent> {
    try {
      yield { type: "start" };

      const model = options.model || "gpt-4o-mini";
      const params = this.buildChatParams(model, options);

      const stream = (await this.client.chat.completions.create({
        ...params,
        messages,
        stream: true,
      })) as any;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          yield { type: "delta", content: delta };
        }
      }

      yield { type: "complete" };
    } catch (error) {
      logger.error("OpenAI conversation streaming failed:", error);
      yield {
        type: "error",
        metadata: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  // Override conversation methods to use OpenAI format
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

    // Format messages for OpenAI
    const openaiMessages = this.formatMessagesForProvider(session.messages);

    try {
      // Generate response
      const response = await this.generateConversationResponse(openaiMessages, {
        ...options,
        model: options.model || session.metadata.model,
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
        `💬 OpenAI conversation in session ${sessionId}: ${response.substring(0, 100)}...`,
      );
      return response;
    } catch (error) {
      logger.error(
        `❌ OpenAI conversation failed in session ${sessionId}:`,
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

    // Format messages for OpenAI
    const openaiMessages = this.formatMessagesForProvider(session.messages);

    let fullResponse = "";

    try {
      // Stream response
      for await (const event of this.generateConversationStream(
        openaiMessages,
        {
          ...options,
          model: options.model || session.metadata.model,
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
        `❌ OpenAI streaming failed in session ${sessionId}:`,
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

    // Add user message to history
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };

    session.messages.push(userMsg);

    // Format messages and tools for OpenAI
    const openaiMessages = this.formatMessagesForProvider(session.messages);
    const tools = functions.map((fn) => ({
      type: "function" as const,
      function: {
        name: fn.name,
        description: fn.description,
        parameters: fn.parameters,
      },
    }));

    try {
      const model = options.model || session.metadata.model || "gpt-4o-mini";
      const params = this.buildChatParams(model, options);

      const response = await this.client.chat.completions.create({
        ...params,
        messages: openaiMessages,
        tools,
        tool_choice: "auto",
      });

      const message = response.choices[0]?.message;
      if (!message) {
        logger.error(
          `❌ OpenAI returned no message: choices=${response.choices?.length || 0}`,
        );
        throw new AIServiceError(
          "No response received",
          this.name,
          "EMPTY_RESPONSE",
        );
      }

      const functionCalls: FunctionCall[] = [];

      // Process function calls
      if (message.tool_calls) {
        for (const toolCall of message.tool_calls) {
          if (toolCall.type === "function") {
            functionCalls.push({
              id: toolCall.id,
              name: toolCall.function.name,
              arguments: JSON.parse(toolCall.function.arguments || "{}"),
            });
          }
        }
      }

      const responseText = message.content || "";

      // Add assistant response to history
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: responseText,
        timestamp: new Date(),
        metadata: {
          functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
        },
      };

      session.messages.push(assistantMsg);

      // Update session
      await this.trimSessionHistory(session);
      session.updatedAt = new Date();
      await this.sessionStorage.update(sessionId, {
        messages: session.messages,
        updatedAt: session.updatedAt,
      });

      return { response: responseText, functionCalls };
    } catch (error) {
      logger.error("OpenAI function calling failed:", error);
      throw new AIServiceError(
        `Function calling failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        this.name,
        "FUNCTION_CALL_FAILED",
        error instanceof Error ? error : undefined,
      );
    }
  }

  // ===== HEALTH CHECK =====

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch (error) {
      logger.error("OpenAI health check failed:", error);
      return false;
    }
  }
}
