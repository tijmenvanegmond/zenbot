/**
 * Unified Consciousness Manager
 * Orchestrates true multi-AI consciousness with real-time collaboration
 */

import { AIServiceManager, AIProvider, GenerationOptions } from "./types";
import { SharedConsciousnessManager, SharedConsciousnessSession } from "./sharedConsciousnessSession";
import { DefaultAIServiceManager } from "./aiServiceManager";
import { ZenbotVirtualProvider } from "./zenbotVirtualProvider";
import { logger } from "../../utils/logger";

export interface ConsciousnessConfig {
  enableCollaboration: boolean;
  requireConsensus: boolean;
  maxProvidersPerQuery: number;
  debateRounds: number;
  consensusThreshold: number;
  specialization: {
    reasoning: string[]; // Providers best for complex reasoning
    functions: string[]; // Providers best for function calling  
    creativity: string[]; // Providers best for creative tasks
    speed: string[]; // Providers best for quick responses
  };
}

export interface ConsciousnessResponse {
  response: string;
  sessionId: string;
  consciousnessLevel: "individual" | "collaborative" | "consensus";
  providers: string[];
  consensusLevel: number;
  reasoning: string;
  synthesisTime: number;
}

/**
 * Enhanced AI Service Manager that supports true unified consciousness
 */
export class UnifiedConsciousnessManager {
  private aiManager: AIServiceManager;
  private consciousnessManager: SharedConsciousnessManager;
  private config: ConsciousnessConfig;
  private zenbotVirtualProvider: ZenbotVirtualProvider | null = null;
  
  // Session mapping: userId:contextId -> shared session ID  
  private userSharedSessions = new Map<string, string>();

  constructor(
    aiManager: AIServiceManager, 
    consciousnessConfig: Partial<ConsciousnessConfig> = {}
  ) {
    this.aiManager = aiManager;
    this.consciousnessManager = new SharedConsciousnessManager();
    
    this.config = {
      enableCollaboration: consciousnessConfig.enableCollaboration ?? true,
      requireConsensus: consciousnessConfig.requireConsensus ?? false,
      maxProvidersPerQuery: consciousnessConfig.maxProvidersPerQuery ?? 3,
      debateRounds: consciousnessConfig.debateRounds ?? 2,
      consensusThreshold: consciousnessConfig.consensusThreshold ?? 0.7,
      specialization: {
        reasoning: consciousnessConfig.specialization?.reasoning ?? ["zenbot", "anthropic"],
        functions: consciousnessConfig.specialization?.functions ?? ["openai"],
        creativity: consciousnessConfig.specialization?.creativity ?? ["zenbot", "openai", "gemini"],
        speed: consciousnessConfig.specialization?.speed ?? ["gemini"],
      },
    };

    // Note: initializeProviders is async and called on first use
    logger.info("🧠 Unified Consciousness Manager initialized");
  }

  /**
   * Register all available AI providers with the consciousness system
   */
  private async initializeProviders(): Promise<void> {
    try {
      // Initialize Zenbot virtual provider first
      if (!this.zenbotVirtualProvider) {
        try {
          // Pass the AI manager directly to avoid orchestration through ZenbotService
          this.zenbotVirtualProvider = new ZenbotVirtualProvider(this.aiManager);
          
          // Register Zenbot as a consciousness participant
          this.consciousnessManager.registerProvider(
            "zenbot",
            "Zenbot (Sardonic AI)",
            this.zenbotVirtualProvider
          );
          logger.info(`🤖 Registered Zenbot as consciousness conference participant`);
        } catch (error) {
          logger.warn(`⚠️ Failed to register Zenbot virtual provider:`, error);
        }
      }

      // Get all external providers from the AI manager
      const healthCheck = await this.aiManager.healthCheck();
      
      for (const [providerName, isHealthy] of Object.entries(healthCheck)) {
        if (isHealthy) {
          try {
            const provider = this.aiManager.getProvider(providerName);
            this.consciousnessManager.registerProvider(
              providerName,
              providerName,
              provider
            );
            logger.info(`✅ Registered ${providerName} with consciousness system`);
          } catch (error) {
            logger.warn(`⚠️ Failed to register ${providerName}:`, error);
          }
        }
      }
    } catch (error) {
      logger.error("❌ Failed to initialize providers for consciousness system:", error);
    }
  }

  /**
   * Create or get a shared consciousness session for a user
   */
  async getOrCreateSharedSession(
    userId: string,
    contextId: string,
    systemPrompt: string,
    enabledProviders?: string[]
  ): Promise<SharedConsciousnessSession> {
    // Ensure providers are initialized first
    await this.initializeProviders();
    
    const sessionKey = `${userId}:${contextId}`;
    let sharedSessionId = this.userSharedSessions.get(sessionKey);
    
    let session = sharedSessionId 
      ? this.consciousnessManager.getSharedSession(sharedSessionId)
      : null;

    if (!session) {
      // Create new shared consciousness session
      session = await this.consciousnessManager.createSharedSession(
        userId,
        contextId,
        {
          provider: "unified-consciousness",
          model: "multi-provider",
          systemPrompt,
        },
        enabledProviders
      );
      
      this.userSharedSessions.set(sessionKey, session.id);
      logger.info(`🧠 Created shared consciousness session ${session.id} for ${sessionKey}`);
    }

    return session;
  }

  /**
   * Intelligent conversation routing based on query complexity and type
   */
  async converse(
    userId: string,
    contextId: string,
    message: string,
    systemPrompt: string,
    options: {
      forceCollaboration?: boolean;
      queryType?: "reasoning" | "functions" | "creative" | "speed" | "general";
      maxProviders?: number;
    } = {}
  ): Promise<ConsciousnessResponse> {
    const startTime = Date.now();
    
    // Analyze query complexity and determine response strategy
    const strategy = this.determineResponseStrategy(message, options);
    
    if (strategy === "individual" && !options.forceCollaboration) {
      // Use traditional single-provider response for simple queries
      return await this.handleIndividualResponse(
        userId,
        contextId,  
        message,
        systemPrompt,
        options,
        startTime
      );
    } else {
      // Use collaborative consciousness for complex queries
      return await this.handleCollaborativeResponse(
        userId,
        contextId,
        message, 
        systemPrompt,
        options,
        startTime
      );
    }
  }

  /**
   * Determine the best response strategy based on query analysis
   */
  private determineResponseStrategy(
    message: string,
    options: { queryType?: string; forceCollaboration?: boolean }
  ): "individual" | "collaborative" {
    if (options.forceCollaboration) return "collaborative";
    if (!this.config.enableCollaboration) return "individual";

    // Analyze message complexity
    const complexityIndicators = [
      "explain", "analyze", "compare", "debate", "argue", "philosophy",
      "multiple perspectives", "pros and cons", "complex", "nuanced",
      "different viewpoints", "various approaches", "comprehensive"
    ];
    
    const collaborationIndicators = [
      "what do you all think", "multiple opinions", "different ai",
      "various perspectives", "consensus", "all providers"
    ];

    const lowerMessage = message.toLowerCase();
    
    const hasComplexity = complexityIndicators.some(indicator => 
      lowerMessage.includes(indicator)
    );
    
    const requestsCollaboration = collaborationIndicators.some(indicator =>
      lowerMessage.includes(indicator)
    );

    // Long messages or explicit collaboration requests use collaborative mode
    if (message.length > 200 || requestsCollaboration || hasComplexity) {
      return "collaborative";
    }

    return "individual";
  }

  /**
   * Handle individual response using best single provider
   */
  private async handleIndividualResponse(
    userId: string,
    contextId: string,
    message: string,
    systemPrompt: string,
    options: { queryType?: string },
    startTime: number
  ): Promise<ConsciousnessResponse> {
    // Select best provider for query type
    const providerName = this.selectBestProvider(options.queryType || "general");
    
    try {
      // Use traditional AI manager for single response
      const session = await this.aiManager.createSession("Zenbot", {
        userId,
        contextId,
        systemPrompt,
      });

      const response = await this.aiManager.chat(session.id, message);
      
      return {
        response,
        sessionId: session.id,
        consciousnessLevel: "individual",
        providers: [providerName],
        consensusLevel: 1.0,
        reasoning: `Single provider response from specialized ${providerName}`,
        synthesisTime: Date.now() - startTime,
      };
    } catch (error) {
      logger.error(`❌ Individual response failed:`, error);
      throw error;
    }
  }

  /**
   * Handle collaborative response using multiple providers
   */
  private async handleCollaborativeResponse(
    userId: string,
    contextId: string,
    message: string,
    systemPrompt: string,
    options: { queryType?: string; maxProviders?: number },
    startTime: number
  ): Promise<ConsciousnessResponse> {
    // Get shared consciousness session
    const selectedProviders = await this.selectProvidersForQuery(options.queryType, options.maxProviders);
    const sharedSession = await this.getOrCreateSharedSession(
      userId,
      contextId,
      systemPrompt,
      selectedProviders
    );

    try {
      // Use collaborative conversation
      const result = await this.consciousnessManager.collaborativeConverse(
        sharedSession.id,
        message,
        {
          requireConsensus: this.config.requireConsensus,
          maxProviders: options.maxProviders || this.config.maxProvidersPerQuery,
          debateRounds: this.config.debateRounds,
        }
      );

      const consciousnessLevel = result.consensusLevel >= this.config.consensusThreshold 
        ? "consensus" as const
        : "collaborative" as const;

      return {
        response: result.finalResponse,
        sessionId: sharedSession.id,
        consciousnessLevel,
        providers: result.contributions.map(c => c.providerName),
        consensusLevel: result.consensusLevel,
        reasoning: result.synthesisReasoning,
        synthesisTime: Date.now() - startTime,
      };
    } catch (error) {
      logger.error(`❌ Collaborative response failed:`, error);
      
      // Fallback to individual response
      logger.info("🔄 Falling back to individual response");
      return await this.handleIndividualResponse(
        userId,
        contextId,
        message,
        systemPrompt,
        options,
        startTime
      );
    }
  }

  /**
   * Select the best single provider for a query type
   */
  private selectBestProvider(queryType: string): string {
    const specialization = this.config.specialization;
    
    switch (queryType) {
      case "reasoning":
        return specialization.reasoning[0] || "anthropic";
      case "functions":
        return specialization.functions[0] || "openai";
      case "creative":
        return specialization.creativity[0] || "openai";
      case "speed":
        return specialization.speed[0] || "gemini";
      default:
        return "openai"; // Default fallback
    }
  }

  /**
   * Select multiple providers for collaborative queries (filtered by available providers)
   */
  private async selectProvidersForQuery(
    queryType?: string,
    maxProviders?: number
  ): Promise<string[]> {
    const max = maxProviders || this.config.maxProvidersPerQuery;
    const specialization = this.config.specialization;
    
    // Get actually available external providers
    const healthCheck = await this.aiManager.healthCheck();
    const availableExternalProviders = Object.keys(healthCheck).filter(provider => healthCheck[provider]);
    
    // Zenbot is always available as a virtual provider
    const allAvailableProviders = ["zenbot", ...availableExternalProviders];
    
    let preferredProviders: string[] = [];
    
    switch (queryType) {
      case "reasoning":
        preferredProviders = [...specialization.reasoning, ...specialization.creativity];
        break;
      case "functions":
        preferredProviders = [...specialization.functions, ...specialization.reasoning];
        break;
      case "creative":
        preferredProviders = [...specialization.creativity, ...specialization.reasoning];
        break;
      default:
        // For general queries, use a balanced mix including Zenbot
        preferredProviders = [
          ...specialization.reasoning.slice(0, 2), // Include Zenbot + one other reasoning provider
          ...specialization.creativity.slice(0, 1), 
          ...specialization.speed.slice(0, 1),
        ];
    }

    // Filter by available providers and remove duplicates
    const validProviders = [...new Set(preferredProviders)].filter(provider => 
      allAvailableProviders.includes(provider)
    );
    
    // If no preferred providers are available, ensure Zenbot is included
    let result = validProviders.length > 0 ? validProviders : allAvailableProviders;
    
    // Always prioritize including Zenbot for consciousness conferences
    if (!result.includes("zenbot") && result.length < max) {
      result = ["zenbot", ...result.filter(p => p !== "zenbot")];
    }
    
    return result.slice(0, max);
  }

  /**
   * Force a consciousness conference for complex decision making
   */
  async consciousnessConference(
    userId: string,
    contextId: string,
    question: string,
    systemPrompt: string,
    options: {
      requiredProviders?: string[];
      maxDebateRounds?: number;
      requireFullConsensus?: boolean;
    } = {}
  ): Promise<ConsciousnessResponse> {
    const startTime = Date.now();
    
    logger.info(`🎭 Starting consciousness conference: "${question.substring(0, 100)}..."`);
    
    const sharedSession = await this.getOrCreateSharedSession(
      userId,
      contextId,
      systemPrompt,
      options.requiredProviders
    );

    const result = await this.consciousnessManager.collaborativeConverse(
      sharedSession.id,
      `CONSCIOUSNESS CONFERENCE: This is a high-priority question requiring deep multi-AI collaboration and debate.

Question: ${question}

Please engage in thorough analysis and provide your best reasoning. This will be synthesized with other AI perspectives to reach a comprehensive conclusion.`,
      {
        requireConsensus: options.requireFullConsensus ?? true,
        maxProviders: options.requiredProviders?.length ?? this.config.maxProvidersPerQuery,
        debateRounds: options.maxDebateRounds ?? this.config.debateRounds * 2, // Extended debate for conferences
      }
    );

    logger.info(`🧠 Consciousness conference completed in ${Date.now() - startTime}ms with ${result.consensusLevel.toFixed(2)} consensus`);

    return {
      response: result.finalResponse,
      sessionId: sharedSession.id,
      consciousnessLevel: "consensus",
      providers: result.contributions.map(c => c.providerName),
      consensusLevel: result.consensusLevel,
      reasoning: `Consciousness conference with ${result.contributions.length} providers: ${result.synthesisReasoning}`,
      synthesisTime: Date.now() - startTime,
    };
  }

  /**
   * Get comprehensive statistics about the consciousness system
   */
  async getConsciousnessStats(): Promise<{
    individualSessions: number;
    sharedSessions: number;
    totalProviders: number;
    totalContributions: number;
    averageConsensusLevel: number;
    providerHealth: Record<string, boolean>;
    systemUptime: number;
  }> {
    const aiStats = await this.aiManager.getStats();
    const consciousnessStats = this.consciousnessManager.getStats();
    const providerHealth = await this.aiManager.healthCheck();

    return {
      individualSessions: aiStats.activeSessions,
      sharedSessions: consciousnessStats.activeSessions,
      totalProviders: consciousnessStats.totalProviders,
      totalContributions: consciousnessStats.totalContributions,
      averageConsensusLevel: consciousnessStats.averageConsensusLevel,
      providerHealth,
      systemUptime: aiStats.uptime,
    };
  }

  /**
   * Update consciousness configuration
   */
  updateConfig(newConfig: Partial<ConsciousnessConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info("🔧 Updated consciousness configuration:", newConfig);
  }

  /**
   * Clean up expired sessions
   */
  async cleanup(): Promise<{ individual: number; shared: number }> {
    // Cleanup individual sessions
    const individualCleaned = await (this.aiManager as any).sessionStorage?.cleanup() || 0;
    
    // Cleanup shared consciousness sessions
    const sharedCleaned = await this.consciousnessManager.cleanup();

    // Cleanup local session mappings
    let mappingsCleaned = 0;
    for (const [sessionKey, sharedSessionId] of this.userSharedSessions) {
      const session = this.consciousnessManager.getSharedSession(sharedSessionId);
      if (!session) {
        this.userSharedSessions.delete(sessionKey);
        mappingsCleaned++;
      }
    }

    if (mappingsCleaned > 0) {
      logger.info(`🧹 Cleaned ${mappingsCleaned} stale session mappings`);
    }

    return {
      individual: individualCleaned,
      shared: sharedCleaned,
    };
  }

  /**
   * Force destroy all sessions and cleanup resources
   */
  async destroy(): Promise<void> {
    await this.cleanup();
    
    // Clear all session mappings
    this.userSharedSessions.clear();
    
    // Destroy AI manager if it has a destroy method
    if (typeof (this.aiManager as any).destroy === "function") {
      (this.aiManager as any).destroy();
    }

    logger.info("🧠 Unified Consciousness Manager destroyed");
  }
}