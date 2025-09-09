/**
 * AI Service Abstraction Layer - Types and Interfaces
 * Supports multiple AI providers with unified session management and conversation memory
 */

// ===== CORE MESSAGE TYPES =====

export interface Message {
  id?: string;
  role: "system" | "user" | "assistant" | "function";
  content: string;
  timestamp?: Date;
  metadata?: Record<string, any>;
}

export interface FunctionCall {
  name: string;
  arguments: Record<string, any>;
  id?: string;
}

export interface FunctionResult {
  id: string;
  name: string;
  result: any;
  success: boolean;
  error?: string;
}

// ===== SESSION MANAGEMENT =====

export interface AISession {
  id: string;
  userId?: string;
  contextId?: string; // Guild, channel, etc.
  messages: Message[];
  metadata: SessionMetadata;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export interface SessionMetadata {
  provider: string;
  model: string;
  systemPrompt?: string;
  maxMessages?: number;
  temperature?: number;
  character?: string; // e.g., "Zenyatta"
  context?: Record<string, any>; // Discord context, voice channel info, etc.
}

// ===== GENERATION OPTIONS =====

export interface GenerationOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
  systemPrompt?: string;
  stream?: boolean;
}

export interface SessionOptions extends GenerationOptions {
  sessionId?: string;
  userId?: string;
  contextId?: string;
  maxHistoryMessages?: number;
  persistSession?: boolean;
  sessionExpiry?: number; // minutes
}

export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

// ===== STREAMING TYPES =====

export interface StreamEvent {
  type:
    | "start"
    | "delta"
    | "function_call"
    | "function_result"
    | "complete"
    | "error";
  content?: string;
  functionCall?: FunctionCall;
  functionResult?: FunctionResult;
  metadata?: Record<string, any>;
}

// ===== PROVIDER INTERFACE =====

export interface AIProvider {
  readonly name: string;
  readonly supportedModels: string[];
  readonly supportsStreaming: boolean;
  readonly supportsFunctions: boolean;
  readonly supportsVision: boolean;

  // ===== SESSION MANAGEMENT =====

  /**
   * Create a new conversation session with optional context
   */
  createSession(options?: SessionOptions): Promise<AISession>;

  /**
   * Get an existing session by ID
   */
  getSession(sessionId: string): Promise<AISession | null>;

  /**
   * Update session metadata (context, system prompt, etc.)
   */
  updateSession(
    sessionId: string,
    updates: Partial<SessionMetadata>,
  ): Promise<AISession>;

  /**
   * Delete a session and its history
   */
  deleteSession(sessionId: string): Promise<void>;

  /**
   * List sessions for a user/context
   */
  listSessions(userId?: string, contextId?: string): Promise<AISession[]>;

  /**
   * Clean up expired sessions
   */
  cleanupSessions(): Promise<number>; // Returns count of cleaned sessions

  // ===== CONVERSATION WITH MEMORY =====

  /**
   * Continue conversation in an existing session
   */
  continueConversation(
    sessionId: string,
    userMessage: string,
    options?: GenerationOptions,
  ): Promise<string>;

  /**
   * Stream conversation response in an existing session
   */
  streamConversation(
    sessionId: string,
    userMessage: string,
    options?: GenerationOptions,
  ): AsyncIterable<StreamEvent>;

  /**
   * Add messages to session history without generating response
   */
  addToHistory(sessionId: string, messages: Message[]): Promise<void>;

  /**
   * Get conversation history for a session
   */
  getHistory(sessionId: string, limit?: number): Promise<Message[]>;

  // ===== SIMPLE GENERATION (STATELESS) =====

  /**
   * Simple text generation without session memory
   */
  generateText(prompt: string, options?: GenerationOptions): Promise<string>;

  /**
   * Stream text generation without session memory
   */
  generateTextStream(
    prompt: string,
    options?: GenerationOptions,
  ): AsyncIterable<StreamEvent>;

  // ===== FUNCTION CALLING =====

  /**
   * Generate response with function calling in a session
   */
  callFunctions(
    sessionId: string,
    userMessage: string,
    functions: FunctionDefinition[],
    options?: GenerationOptions,
  ): Promise<{
    response: string;
    functionCalls: FunctionCall[];
  }>;

  // ===== PROVIDER MANAGEMENT =====

  /**
   * Health check for the provider
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get provider-specific configuration
   */
  getConfig(): Record<string, any>;
}

// ===== SESSION STORAGE INTERFACE =====

export interface SessionStorage {
  /**
   * Store session data
   */
  save(session: AISession): Promise<void>;

  /**
   * Retrieve session by ID
   */
  get(sessionId: string): Promise<AISession | null>;

  /**
   * Update existing session
   */
  update(
    sessionId: string,
    updates: Partial<AISession>,
  ): Promise<AISession | null>;

  /**
   * Delete session
   */
  delete(sessionId: string): Promise<void>;

  /**
   * Find sessions by criteria
   */
  find(criteria: {
    userId?: string;
    contextId?: string;
    character?: string;
    createdAfter?: Date;
    expiredOnly?: boolean;
  }): Promise<AISession[]>;

  /**
   * Clean up expired sessions
   */
  cleanup(): Promise<number>;
}

// ===== AI SERVICE MANAGER =====

export interface AIServiceConfig {
  defaultProvider: string;
  providers: Record<string, any>; // Provider-specific config
  session: {
    defaultExpiry: number; // minutes
    maxMessages: number;
    cleanupInterval: number; // minutes
    storage: "memory" | "redis" | "database";
  };
  routing?: {
    simple?: string; // Provider for simple text generation
    conversation?: string; // Provider for conversations
    functions?: string; // Provider for function calling
    streaming?: string; // Provider for streaming
  };
  fallbacks?: {
    providers?: {
      [providerName: string]: string[]; // Fallback chain for each provider
    };
    maxRetries?: number; // Max fallback attempts per request (default: 2)
    circuitBreakerThreshold?: number; // Failures before circuit breaker opens (default: 5)
  };
}

export interface AIServiceManager {
  /**
   * Register an AI provider
   */
  registerProvider(provider: AIProvider): void;

  /**
   * Get a provider by name
   */
  getProvider(name?: string): AIProvider;

  /**
   * Get best provider for a specific capability
   */
  getBestProvider(
    capability: "simple" | "conversation" | "functions" | "streaming",
  ): AIProvider;

  /**
   * Create session with automatic provider selection
   */
  createSession(
    character?: string,
    options?: SessionOptions,
  ): Promise<AISession>;

  /**
   * Continue conversation with automatic provider routing
   */
  chat(
    sessionId: string,
    message: string,
    options?: GenerationOptions,
  ): Promise<string>;

  /**
   * Stream conversation with automatic provider routing
   */
  chatStream(
    sessionId: string,
    message: string,
    options?: GenerationOptions,
  ): AsyncIterable<StreamEvent>;

  /**
   * Health check all providers
   */
  healthCheck(): Promise<Record<string, boolean>>;

  /**
   * Get service statistics
   */
  getStats(): Promise<{
    providers: string[];
    activeSessions: number;
    totalMessages: number;
    uptime: number;
  }>;
}

// ===== ZENBOT-SPECIFIC EXTENSIONS =====

export interface ZenbotSessionContext {
  discordGuild?: string;
  discordChannel?: string;
  discordUser?: {
    id: string;
    username: string;
    displayName?: string;
  };
  voiceChannel?: {
    id: string;
    name: string;
    memberCount: number;
  };
  lastAction?: {
    type: string;
    timestamp: Date;
    success: boolean;
  };
}

export interface ZenbotSession extends AISession {
  character: "Zenbot";
  metadata: SessionMetadata & {
    context: ZenbotSessionContext;
    mood: "zen" | "wise" | "playful" | "mysterious" | "sassy";
    lastQuote?: string;
    functionCallsEnabled: boolean;
  };
}


export class AIServiceError extends Error {
  constructor(
    message: string,
    public provider: string,
    public code?: string,
    public cause?: Error,
  ) {
    super(message);
    this.name = "AIServiceError";
  }
}

export class SessionNotFoundError extends AIServiceError {
  constructor(sessionId: string, provider: string) {
    super(`Session ${sessionId} not found`, provider, "SESSION_NOT_FOUND");
  }
}

export class ProviderUnavailableError extends AIServiceError {
  constructor(provider: string, cause?: Error) {
    super(
      `Provider ${provider} is unavailable`,
      provider,
      "PROVIDER_UNAVAILABLE",
      cause,
    );
  }
}
