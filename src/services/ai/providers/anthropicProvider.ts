/**
 * Anthropic Provider Implementation
 * Supports Claude models with conversation memory
 */

// Optional import - only available if @anthropic-ai/sdk is installed
let Anthropic: any;
try {
  Anthropic = require('@anthropic-ai/sdk');
} catch (error) {
  console.warn('⚠️ @anthropic-ai/sdk not installed - Anthropic provider disabled');
}
import { BaseAIProvider } from '../baseProvider';
import { 
  GenerationOptions, 
  StreamEvent, 
  Message,
  SessionStorage,
  AIServiceError
} from '../types';
import { logger } from '../../../utils/logger';

export class AnthropicProvider extends BaseAIProvider {
  readonly name = 'anthropic';
  readonly supportedModels = [
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022', 
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307'
  ];
  readonly supportsStreaming = true;
  readonly supportsFunctions = true; // Via tool use
  readonly supportsVision = true;

  private client: any;

  constructor(sessionStorage: SessionStorage, config: { apiKey: string; baseURL?: string } & Record<string, any>) {
    super(sessionStorage, config);
    
    if (!Anthropic) {
      throw new AIServiceError('Anthropic SDK not available. Install with: npm install @anthropic-ai/sdk', this.name, 'SDK_NOT_AVAILABLE');
    }
    
    if (!config.apiKey) {
      throw new AIServiceError('Anthropic API key is required', this.name, 'MISSING_API_KEY');
    }

    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL
    });
  }

  // ===== SIMPLE TEXT GENERATION =====

  async generateText(prompt: string, options: GenerationOptions = {}): Promise<string> {
    try {
      const response = await this.client.messages.create({
        model: options.model || 'claude-3-5-haiku-20241022',
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature || 0.7,
        system: options.systemPrompt,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new AIServiceError('Unexpected response type', this.name, 'INVALID_RESPONSE');
      }

      return content.text.trim();
    } catch (error) {
      logger.error('Anthropic text generation failed:', error);
      throw new AIServiceError(
        `Text generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.name,
        'GENERATION_FAILED',
        error instanceof Error ? error : undefined
      );
    }
  }

  async *generateTextStream(prompt: string, options: GenerationOptions = {}): AsyncIterable<StreamEvent> {
    try {
      yield { type: 'start' };

      const stream = await this.client.messages.create({
        model: options.model || 'claude-3-5-haiku-20241022',
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature || 0.7,
        system: options.systemPrompt,
        messages: [{ role: 'user', content: prompt }],
        stream: true
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield { type: 'delta', content: event.delta.text };
        }
      }

      yield { type: 'complete' };
    } catch (error) {
      logger.error('Anthropic streaming failed:', error);
      yield { 
        type: 'error', 
        metadata: { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        } 
      };
    }
  }

  // ===== CONVERSATION WITH MEMORY =====

  protected formatMessagesForProvider(messages: Message[]): { 
    system?: string;
    messages: any[];
  } {
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    return {
      system: systemMessage?.content,
      messages: conversationMessages.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }))
    };
  }

  protected async generateConversationResponse(
    formattedMessages: { system?: string; messages: any[] },
    options: GenerationOptions = {}
  ): Promise<string> {
    try {
      const response = await this.client.messages.create({
        model: options.model || 'claude-3-5-haiku-20241022',
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature || 0.7,
        system: formattedMessages.system,
        messages: formattedMessages.messages
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new AIServiceError('Unexpected response type', this.name, 'INVALID_RESPONSE');
      }

      return content.text.trim();
    } catch (error) {
      throw new AIServiceError(
        `Conversation generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.name,
        'GENERATION_FAILED',
        error instanceof Error ? error : undefined
      );
    }
  }

  async *generateConversationStream(
    formattedMessages: { system?: string; messages: any[] },
    options: GenerationOptions = {}
  ): AsyncIterable<StreamEvent> {
    try {
      yield { type: 'start' };

      const stream = await this.client.messages.create({
        model: options.model || 'claude-3-5-haiku-20241022',
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature || 0.7,
        system: formattedMessages.system,
        messages: formattedMessages.messages,
        stream: true
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield { type: 'delta', content: event.delta.text };
        }
      }

      yield { type: 'complete' };
    } catch (error) {
      logger.error('Anthropic conversation streaming failed:', error);
      yield { 
        type: 'error', 
        metadata: { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        } 
      };
    }
  }

  // Override conversation methods to use Anthropic format
  async continueConversation(
    sessionId: string,
    userMessage: string,
    options: GenerationOptions = {}
  ): Promise<string> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new AIServiceError(`Session ${sessionId} not found`, this.name, 'SESSION_NOT_FOUND');
    }

    // Add user message to history
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    };
    
    session.messages.push(userMsg);

    // Format messages for Anthropic
    const formattedMessages = this.formatMessagesForProvider(session.messages);
    
    try {
      // Generate response
      const response = await this.generateConversationResponse(formattedMessages, {
        ...options,
        model: options.model || session.metadata.model,
        temperature: options.temperature || session.metadata.temperature
      });

      // Add assistant response to history
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };
      
      session.messages.push(assistantMsg);

      // Trim history if needed
      await this.trimSessionHistory(session);

      // Update session
      session.updatedAt = new Date();
      await this.sessionStorage.update(sessionId, {
        messages: session.messages,
        updatedAt: session.updatedAt
      });

      logger.info(`💬 Anthropic conversation in session ${sessionId}: ${response.substring(0, 100)}...`);
      return response;
      
    } catch (error) {
      logger.error(`❌ Anthropic conversation failed in session ${sessionId}:`, error);
      throw error; // Re-throw AIServiceError
    }
  }

  async *streamConversation(
    sessionId: string,
    userMessage: string,
    options: GenerationOptions = {}
  ): AsyncIterable<StreamEvent> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new AIServiceError(`Session ${sessionId} not found`, this.name, 'SESSION_NOT_FOUND');
    }

    // Add user message to history
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    };
    
    session.messages.push(userMsg);

    // Format messages for Anthropic
    const formattedMessages = this.formatMessagesForProvider(session.messages);
    
    let fullResponse = '';
    
    try {
      // Stream response
      for await (const event of this.generateConversationStream(formattedMessages, {
        ...options,
        model: options.model || session.metadata.model,
        temperature: options.temperature || session.metadata.temperature
      })) {
        if (event.type === 'delta' && event.content) {
          fullResponse += event.content;
        }
        yield event;
      }

      // Add complete response to history
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: fullResponse,
        timestamp: new Date()
      };
      
      session.messages.push(assistantMsg);

      // Trim history if needed
      await this.trimSessionHistory(session);

      // Update session
      session.updatedAt = new Date();
      await this.sessionStorage.update(sessionId, {
        messages: session.messages,
        updatedAt: session.updatedAt
      });
      
    } catch (error) {
      logger.error(`❌ Anthropic streaming failed in session ${sessionId}:`, error);
      yield { 
        type: 'error', 
        metadata: { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        } 
      };
    }
  }

  // ===== FUNCTION CALLING (via Tool Use) =====

  async callFunctions(
    sessionId: string,
    userMessage: string,
    functions: any[], // FunctionDefinition[], but simplified for now
    options: GenerationOptions = {}
  ): Promise<{ response: string; functionCalls: any[] }> {
    // Anthropic's tool use is more complex - for now, fall back to conversation
    // TODO: Implement proper tool use when needed
    const response = await this.continueConversation(sessionId, userMessage, options);
    return { response, functionCalls: [] };
  }

  // ===== HEALTH CHECK =====

  async healthCheck(): Promise<boolean> {
    try {
      // Simple test message to check API connectivity
      await this.client.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }]
      });
      return true;
    } catch (error) {
      logger.error('Anthropic health check failed:', error);
      return false;
    }
  }
}