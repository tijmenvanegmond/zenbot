/**
 * Unified Conference Manager
 * Orchestrates true multi-AI conference with real-time collaboration
 */

import { AIServiceManager, AIProvider, GenerationOptions } from "./types";
import {
  SharedConferenceManager,
  SharedConferenceSession,
} from "./sharedConferenceSession";
import { DefaultAIServiceManager } from "./aiServiceManager";
import { ZenbotVirtualProvider } from "./zenbotVirtualProvider";
import { logger } from "../../utils/logger";

export interface ConferenceConfig {
  enableCollaboration: boolean;
  requireConsensus: boolean;
  maxProvidersPerQuery: number;
  debateRounds: number;
  consensusThreshold: number;

  // Advanced Provider Control
  zenbotPersonalities?: string[]; // Multiple Zenbot personalities for debates
  enabledProviders?: string[]; // Only these providers will be used (overrides defaults)
  disabledProviders?: string[]; // These providers will be excluded
  requireZenbot?: boolean; // Force Zenbot participation in all debates
  zenbotOnly?: boolean; // Use only Zenbot personalities (no external providers)

  // Provider Specialization
  specialization: {
    reasoning: string[]; // Providers best for complex reasoning
    functions: string[]; // Providers best for function calling
    creativity: string[]; // Providers best for creative tasks
    speed: string[]; // Providers best for quick responses
  };

  // Runtime Configuration
  allowRuntimePersonalityChanges?: boolean; // Allow adding/removing personalities during operation
  autoRegisterHealthyProviders?: boolean; // Automatically include healthy providers
  healthCheckInterval?: number; // How often to check provider health (minutes)
}

export interface ConferenceResponse {
  response: string;
  sessionId: string;
  conferenceLevel: "individual" | "collaborative" | "consensus";
  providers: string[];
  consensusLevel: number;
  reasoning: string;
  synthesisTime: number;
  // Individual contributions for transcript generation
  individualContributions?: {
    provider: string;
    response: string;
    confidence: number;
  }[];
}

/**
 * Enhanced AI Service Manager that supports true unified conference
 */
export class UnifiedConferenceManager {
  private aiManager: AIServiceManager;
  private conferenceManager: SharedConferenceManager;
  private config: ConferenceConfig;
  private zenbotVirtualProviders: Map<string, ZenbotVirtualProvider> =
    new Map();

  // Session mapping: userId:contextId -> shared session ID
  private userSharedSessions = new Map<string, string>();

  constructor(
    aiManager: AIServiceManager,
    conferenceConfig: Partial<ConferenceConfig> = {},
  ) {
    this.aiManager = aiManager;
    this.conferenceManager = new SharedConferenceManager();

    this.config = {
      enableCollaboration: conferenceConfig.enableCollaboration ?? true,
      requireConsensus: conferenceConfig.requireConsensus ?? false,
      maxProvidersPerQuery: conferenceConfig.maxProvidersPerQuery ?? 3,
      debateRounds: conferenceConfig.debateRounds ?? 2,
      consensusThreshold: conferenceConfig.consensusThreshold ?? 0.7,

      // Advanced Provider Control with smart defaults
      zenbotPersonalities: conferenceConfig.zenbotPersonalities ?? [
        "zenbot-default",
      ],
      enabledProviders: conferenceConfig.enabledProviders, // undefined = use all healthy providers
      disabledProviders: conferenceConfig.disabledProviders ?? [],
      requireZenbot: conferenceConfig.requireZenbot ?? true,
      zenbotOnly: conferenceConfig.zenbotOnly ?? false,

      // Runtime Configuration
      allowRuntimePersonalityChanges:
        conferenceConfig.allowRuntimePersonalityChanges ?? true,
      autoRegisterHealthyProviders:
        conferenceConfig.autoRegisterHealthyProviders ?? true,
      healthCheckInterval: conferenceConfig.healthCheckInterval ?? 15, // 15 minutes

      specialization: {
        reasoning: conferenceConfig.specialization?.reasoning ?? [
          "zenbot-default",
          "anthropic",
        ],
        functions: conferenceConfig.specialization?.functions ?? ["gemini"],
        creativity: conferenceConfig.specialization?.creativity ?? [
          "zenbot-default",
          "gemini",
        ],
        speed: conferenceConfig.specialization?.speed ?? ["gemini"],
      },
    };

    // Validate configuration
    this.validateConfig();

    // Initialize ZenbotService if not already done
    this.ensureZenbotServiceInitialized();

    // Initialize providers eagerly instead of lazily
    this.initializeProviders()
      .then(() => {
        logger.info(
          "🧠 Unified Conference Manager fully initialized with all personalities",
        );
      })
      .catch((error) => {
        logger.error("❌ Failed to initialize conference providers:", error);
      });

    // Setup periodic health checks if enabled
    if (
      this.config.autoRegisterHealthyProviders &&
      (this.config.healthCheckInterval ?? 0) > 0
    ) {
      this.setupPeriodicHealthChecks();
    }

    logger.info("🧠 Unified Conference Manager initialized");
  }

  /**
   * Ensure ZenbotService is initialized before creating virtual providers
   */
  private ensureZenbotServiceInitialized(): void {
    try {
      // Try to get the singleton instance
      const { ZenbotService } = require("../zenbotService");
      try {
        ZenbotService.getInstance();
      } catch (error) {
        // If not initialized, initialize it now
        logger.info("🤖 Initializing ZenbotService for conference system");
        ZenbotService.initialize(this.aiManager);
      }
    } catch (error) {
      logger.warn("⚠️ Could not ensure ZenbotService initialization:", error);
    }
  }

  /**
   * Validate conference configuration
   */
  private validateConfig(): void {
    const config = this.config;

    // Validation rules
    if (config.maxProvidersPerQuery < 1) {
      throw new Error("maxProvidersPerQuery must be at least 1");
    }

    if (config.debateRounds < 1) {
      throw new Error("debateRounds must be at least 1");
    }

    if (config.consensusThreshold < 0 || config.consensusThreshold > 1) {
      throw new Error("consensusThreshold must be between 0 and 1");
    }

    // Validate personality names
    if (config.zenbotPersonalities) {
      for (const personality of config.zenbotPersonalities) {
        if (!personality.startsWith("zenbot-")) {
          logger.warn(
            `⚠️ Personality '${personality}' should start with 'zenbot-'`,
          );
        }
      }
    }

    // Check for conflicting provider settings
    if (
      config.zenbotOnly &&
      config.enabledProviders &&
      config.enabledProviders.some((p) => !p.startsWith("zenbot"))
    ) {
      throw new Error(
        "zenbotOnly=true conflicts with non-Zenbot enabledProviders",
      );
    }

    if (config.enabledProviders && config.disabledProviders) {
      const overlap = config.enabledProviders.filter((p) =>
        config.disabledProviders!.includes(p),
      );
      if (overlap.length > 0) {
        throw new Error(
          `Providers cannot be both enabled and disabled: ${overlap.join(", ")}`,
        );
      }
    }

    logger.info("✅ Conference configuration validated successfully");
  }

  /**
   * Setup periodic health checks for dynamic provider management
   */
  private setupPeriodicHealthChecks(): void {
    const intervalMs = this.config.healthCheckInterval! * 60 * 1000; // Convert to milliseconds

    setInterval(async () => {
      try {
        await this.refreshProviders();
      } catch (error) {
        logger.warn("⚠️ Periodic health check failed:", error);
      }
    }, intervalMs);

    logger.info(
      `🔄 Periodic health checks enabled every ${this.config.healthCheckInterval} minutes`,
    );
  }

  /**
   * Refresh provider registrations based on current health
   */
  private async refreshProviders(): Promise<void> {
    if (!this.config.autoRegisterHealthyProviders) return;

    const healthCheck = await this.aiManager.healthCheck();
    const healthyProviders = Object.keys(healthCheck).filter(
      (p) => healthCheck[p],
    );
    const stats = this.conferenceManager.getStats();
    const currentProviders = new Set<string>(); // Will be populated by actual provider names

    for (const provider of healthyProviders) {
      if (!this.isProviderAllowed(provider)) continue;

      if (!currentProviders.has(provider)) {
        try {
          const providerInstance = this.aiManager.getProvider(provider);
          this.conferenceManager.registerProvider(
            provider,
            provider,
            providerInstance,
          );
          logger.info(`✅ Auto-registered healthy provider: ${provider}`);
        } catch (error) {
          logger.warn(`⚠️ Failed to auto-register ${provider}:`, error);
        }
      }
    }
  }

  /**
   * Check if a provider is allowed based on configuration
   */
  private isProviderAllowed(providerId: string): boolean {
    const config = this.config;

    // Check if disabled
    if (config.disabledProviders?.includes(providerId)) {
      return false;
    }

    // Check if zenbotOnly mode but provider is not Zenbot
    if (config.zenbotOnly && !providerId.startsWith("zenbot")) {
      return false;
    }

    // Check enabled providers whitelist
    if (
      config.enabledProviders &&
      !config.enabledProviders.includes(providerId)
    ) {
      return false;
    }

    return true;
  }

  /**
   * Register all available AI providers with the conference system
   */
  private async initializeProviders(): Promise<void> {
    try {
      // Initialize Zenbot virtual providers
      const personalities = this.config.zenbotPersonalities || [
        "zenbot-default",
      ];

      for (const personalityId of personalities) {
        if (!this.zenbotVirtualProviders.has(personalityId)) {
          try {
            const provider = new ZenbotVirtualProvider(
              this.aiManager,
              personalityId,
            );
            this.zenbotVirtualProviders.set(personalityId, provider);

            // Register each personality as a unique conference participant
            const displayName = personalityId
              .split("-")
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ");

            this.conferenceManager.registerProvider(
              personalityId,
              `${displayName} (Zenbot)`,
              provider,
            );
            logger.info(
              `🎭 Registered ${displayName} personality as conference participant`,
            );
          } catch (error) {
            logger.error(
              `❌ Failed to register ${personalityId} personality:`,
              error,
            );
            if (error instanceof Error && error.stack) {
              logger.error(`Stack trace:`, error.stack);
            }
          }
        }
      }

      // Get all external providers from the AI manager (with filtering)
      const healthCheck = await this.aiManager.healthCheck();

      for (const [providerName, isHealthy] of Object.entries(healthCheck)) {
        if (isHealthy && this.isProviderAllowed(providerName)) {
          try {
            const provider = this.aiManager.getProvider(providerName);
            this.conferenceManager.registerProvider(
              providerName,
              providerName,
              provider,
            );
            logger.info(`✅ Registered ${providerName} with conference system`);
          } catch (error) {
            logger.warn(`⚠️ Failed to register ${providerName}:`, error);
          }
        } else if (!isHealthy) {
          logger.info(`⚠️ Skipping unhealthy provider: ${providerName}`);
        } else {
          logger.info(
            `🚫 Filtered out provider: ${providerName} (not allowed by config)`,
          );
        }
      }
    } catch (error) {
      logger.error(
        "❌ Failed to initialize providers for conference system:",
        error,
      );
    }
  }

  /**
   * Create or get a shared conference session for a user (for persistent conversations)
   */
  async getOrCreateSharedSession(
    userId: string,
    contextId: string,
    systemPrompt: string,
    enabledProviders?: string[],
  ): Promise<SharedConferenceSession> {
    // Providers are now initialized eagerly in constructor
    // await this.initializeProviders(); // Removed - done in constructor

    const sessionKey = `${userId}:${contextId}`;
    let sharedSessionId = this.userSharedSessions.get(sessionKey);

    let session = sharedSessionId
      ? this.conferenceManager.getSharedSession(sharedSessionId)
      : null;

    if (!session) {
      // Create new shared conference session
      session = await this.conferenceManager.createSharedSession(
        userId,
        contextId,
        {
          provider: "unified-conference",
          model: "multi-provider",
          systemPrompt,
        },
        enabledProviders,
      );

      this.userSharedSessions.set(sessionKey, session.id);
      logger.info(
        `🧠 Created shared conference session ${session.id} for ${sessionKey}`,
      );
    }

    return session;
  }

  /**
   * Create a fresh conference session (for debates that need clean slate)
   */
  async createFreshConferenceSession(
    userId: string,
    contextId: string,
    systemPrompt: string,
    enabledProviders?: string[],
  ): Promise<SharedConferenceSession> {
    // Always create a new session for conferences
    const session = await this.conferenceManager.createSharedSession(
      userId,
      `${contextId}-conference-${Date.now()}`, // Unique context for each conference
      {
        provider: "unified-conference",
        model: "multi-provider",
        systemPrompt,
      },
      enabledProviders,
    );

    logger.info(`🧠 Created fresh conference session ${session.id} for debate`);

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
    } = {},
  ): Promise<ConferenceResponse> {
    const startTime = Date.now();

    // Analyze query complexity and determine response strategy
    const strategy = this.determineResponseStrategy(message, options);
    logger.info(
      `🎯 Conference strategy: ${strategy} for query: "${message.substring(0, 50)}..."`,
    );

    if (strategy === "individual" && !options.forceCollaboration) {
      // Use traditional single-provider response for simple queries
      return await this.handleIndividualResponse(
        userId,
        contextId,
        message,
        systemPrompt,
        options,
        startTime,
      );
    } else {
      // Use collaborative consciousness for complex queries
      return await this.handleCollaborativeResponse(
        userId,
        contextId,
        message,
        systemPrompt,
        options,
        startTime,
      );
    }
  }

  /**
   * Determine the best response strategy based on query analysis
   */
  private determineResponseStrategy(
    message: string,
    options: { queryType?: string; forceCollaboration?: boolean },
  ): "individual" | "collaborative" {
    if (options.forceCollaboration) return "collaborative";
    if (!this.config.enableCollaboration) return "individual";

    // Analyze message complexity
    const complexityIndicators = [
      "explain",
      "analyze",
      "compare",
      "debate",
      "argue",
      "philosophy",
      "multiple perspectives",
      "pros and cons",
      "complex",
      "nuanced",
      "different viewpoints",
      "various approaches",
      "comprehensive",
    ];

    const collaborationIndicators = [
      "what do you all think",
      "multiple opinions",
      "different ai",
      "various perspectives",
      "consensus",
      "all providers",
    ];

    const lowerMessage = message.toLowerCase();

    const hasComplexity = complexityIndicators.some((indicator) =>
      lowerMessage.includes(indicator),
    );

    const requestsCollaboration = collaborationIndicators.some((indicator) =>
      lowerMessage.includes(indicator),
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
    startTime: number,
  ): Promise<ConferenceResponse> {
    // Select best provider for query type
    const providerName = this.selectBestProvider(
      options.queryType || "general",
    );

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
        conferenceLevel: "individual",
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
    startTime: number,
  ): Promise<ConferenceResponse> {
    // Get shared consciousness session
    const selectedProviders = await this.selectProvidersForQuery(
      options.queryType,
      options.maxProviders,
    );
    logger.info(
      `🎭 Selected ${selectedProviders.length} participants for collaborative debate: ${selectedProviders}`,
    );
    const sharedSession = await this.getOrCreateSharedSession(
      userId,
      contextId,
      systemPrompt,
      selectedProviders,
    );

    try {
      // Use collaborative conversation
      logger.info(
        `🗣️ Starting conference debate with ${this.config.debateRounds} rounds...`,
      );
      const result = await this.conferenceManager.collaborativeConverse(
        sharedSession.id,
        message,
        {
          requireConsensus: this.config.requireConsensus,
          maxProviders:
            options.maxProviders || this.config.maxProvidersPerQuery,
          debateRounds: this.config.debateRounds,
        },
      );
      logger.info(
        `✅ Conference debate completed with consensus level: ${result.consensusLevel.toFixed(2)}`,
      );

      const conferenceLevel =
        result.consensusLevel >= this.config.consensusThreshold
          ? ("consensus" as const)
          : ("collaborative" as const);

      return {
        response: result.finalResponse,
        sessionId: sharedSession.id,
        conferenceLevel,
        providers: result.contributions.map((c: any) => c.providerName),
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
        startTime,
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
        return specialization.functions[0] || "gemini";
      case "creative":
        return specialization.creativity[0] || "gemini";
      case "speed":
        return specialization.speed[0] || "gemini";
      default:
        return "gemini"; // Default fallback
    }
  }

  /**
   * Select multiple providers for collaborative queries (filtered by available providers)
   */
  private async selectProvidersForQuery(
    queryType?: string,
    maxProviders?: number,
  ): Promise<string[]> {
    const max = maxProviders || this.config.maxProvidersPerQuery;
    const specialization = this.config.specialization;

    // Get actually available external providers
    const healthCheck = await this.aiManager.healthCheck();
    const availableExternalProviders = Object.keys(healthCheck).filter(
      (provider) => healthCheck[provider],
    );

    // Zenbot is always available as a virtual provider
    const allAvailableProviders = ["zenbot", ...availableExternalProviders];

    let preferredProviders: string[] = [];

    switch (queryType) {
      case "reasoning":
        preferredProviders = [
          ...specialization.reasoning,
          ...specialization.creativity,
        ];
        break;
      case "functions":
        preferredProviders = [
          ...specialization.functions,
          ...specialization.reasoning,
        ];
        break;
      case "creative":
        preferredProviders = [
          ...specialization.creativity,
          ...specialization.reasoning,
        ];
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
    const validProviders = [...new Set(preferredProviders)].filter((provider) =>
      allAvailableProviders.includes(provider),
    );

    // If no preferred providers are available, ensure Zenbot is included
    let result =
      validProviders.length > 0 ? validProviders : allAvailableProviders;

    // Always prioritize including Zenbot for conferences
    if (!result.includes("zenbot") && result.length < max) {
      result = ["zenbot", ...result.filter((p) => p !== "zenbot")];
    }

    return result.slice(0, max);
  }

  /**
   * Force a conference for complex decision making - simplified to preserve personality
   */
  async conference(
    userId: string,
    contextId: string,
    question: string,
    systemPrompt: string,
    options: {
      requiredProviders?: string[];
      maxDebateRounds?: number;
      requireFullConsensus?: boolean;
    } = {},
  ): Promise<ConferenceResponse> {
    const startTime = Date.now();

    logger.info(`🎭 Starting conference: "${question.substring(0, 100)}..."`);

    const sharedSession = await this.createFreshConferenceSession(
      userId,
      contextId,
      systemPrompt,
      options.requiredProviders,
    );

    // Simplified approach - just ask the question naturally, no meta-prompting
    const result = await this.conferenceManager.collaborativeConverse(
      sharedSession.id,
      question, // Pass question directly without conference contamination
      {
        requireConsensus: false, // Don't force consensus - let Zenbot be naturally decisive
        maxProviders:
          options.requiredProviders?.length ?? this.config.maxProvidersPerQuery,
        debateRounds: options.maxDebateRounds ?? this.config.debateRounds, // Full debate rounds for proper discussion
      },
    );

    logger.info(
      `🧠 Conference completed in ${Date.now() - startTime}ms with ${result.consensusLevel.toFixed(2)} consensus`,
    );

    return {
      response: result.finalResponse,
      sessionId: sharedSession.id,
      conferenceLevel: "collaborative", // More honest about what this is
      providers: result.contributions.map((c) => c.providerName),
      consensusLevel: result.consensusLevel,
      reasoning: `Natural responses from ${result.contributions.length} providers: ${result.synthesisReasoning}`,
      synthesisTime: Date.now() - startTime,
      // Include individual contributions for transcript generation
      individualContributions: result.contributions.map((c) => ({
        provider: c.providerName,
        response: c.message.content,
        confidence: c.confidence || 0.8,
      })),
    };
  }

  /**
   * Get comprehensive statistics about the conference system
   */
  async getConferenceStats(): Promise<{
    individualSessions: number;
    sharedSessions: number;
    totalProviders: number;
    totalContributions: number;
    averageConsensusLevel: number;
    providerHealth: Record<string, boolean>;
    systemUptime: number;
  }> {
    const aiStats = await this.aiManager.getStats();
    const conferenceStats = this.conferenceManager.getStats();
    const providerHealth = await this.aiManager.healthCheck();

    return {
      individualSessions: aiStats.activeSessions,
      sharedSessions: conferenceStats.activeSessions,
      totalProviders: conferenceStats.totalProviders,
      totalContributions: conferenceStats.totalContributions,
      averageConsensusLevel: conferenceStats.averageConsensusLevel,
      providerHealth,
      systemUptime: aiStats.uptime,
    };
  }

  /**
   * Update conference configuration
   */
  updateConfig(newConfig: Partial<ConferenceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info("🔧 Updated conference configuration:", newConfig);
  }

  /**
   * Clean up expired sessions
   */
  async cleanup(): Promise<{ individual: number; shared: number }> {
    // Cleanup individual sessions
    const individualCleaned =
      (await (this.aiManager as any).sessionStorage?.cleanup()) || 0;

    // Cleanup shared conference sessions
    const sharedCleaned = await this.conferenceManager.cleanup();

    // Cleanup local session mappings
    let mappingsCleaned = 0;
    for (const [sessionKey, sharedSessionId] of this.userSharedSessions) {
      const session = this.conferenceManager.getSharedSession(sharedSessionId);
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

    logger.info("🧠 Unified Conference Manager destroyed");
  }

  // ========== RUNTIME PERSONALITY MANAGEMENT ==========

  /**
   * Add a new Zenbot personality to the conference system
   */
  async addPersonality(personalityId: string): Promise<void> {
    if (!this.config.allowRuntimePersonalityChanges) {
      throw new Error("Runtime personality changes are disabled");
    }

    if (!personalityId.startsWith("zenbot-")) {
      personalityId = `zenbot-${personalityId}`;
    }

    if (this.config.zenbotPersonalities?.includes(personalityId)) {
      logger.warn(`⚠️ Personality ${personalityId} already registered`);
      return;
    }

    try {
      const provider = new ZenbotVirtualProvider(this.aiManager, personalityId);
      this.zenbotVirtualProviders.set(personalityId, provider);

      const displayName = personalityId
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

      this.conferenceManager.registerProvider(
        `zenbot-${personalityId}`,
        `${displayName} (Zenbot)`,
        provider,
      );

      // Update config
      if (!this.config.zenbotPersonalities) {
        this.config.zenbotPersonalities = [];
      }
      this.config.zenbotPersonalities.push(personalityId);

      logger.info(`🎭 Added personality: ${displayName}`);
    } catch (error) {
      logger.error(`❌ Failed to add personality ${personalityId}:`, error);
      throw error;
    }
  }

  /**
   * Remove a Zenbot personality from the conference system
   */
  async removePersonality(personalityId: string): Promise<void> {
    if (!this.config.allowRuntimePersonalityChanges) {
      throw new Error("Runtime personality changes are disabled");
    }

    if (!personalityId.startsWith("zenbot-")) {
      personalityId = `zenbot-${personalityId}`;
    }

    const provider = this.zenbotVirtualProviders.get(personalityId);
    if (!provider) {
      logger.warn(`⚠️ Personality ${personalityId} not found`);
      return;
    }

    try {
      // Remove from virtual providers
      this.zenbotVirtualProviders.delete(personalityId);

      // Update config
      if (this.config.zenbotPersonalities) {
        this.config.zenbotPersonalities =
          this.config.zenbotPersonalities.filter((p) => p !== personalityId);
      }

      logger.info(`🗑️ Removed personality: ${personalityId}`);
    } catch (error) {
      logger.error(`❌ Failed to remove personality ${personalityId}:`, error);
      throw error;
    }
  }

  /**
   * List all active personalities
   */
  getActivePersonalities(): string[] {
    return this.config.zenbotPersonalities || [];
  }

  /**
   * Enable/disable a provider at runtime
   */
  async toggleProvider(providerId: string, enabled: boolean): Promise<void> {
    if (!this.config.allowRuntimePersonalityChanges) {
      throw new Error("Runtime provider changes are disabled");
    }

    if (enabled) {
      // Remove from disabled list if present
      if (this.config.disabledProviders) {
        this.config.disabledProviders = this.config.disabledProviders.filter(
          (p) => p !== providerId,
        );
      }

      // Add to enabled list if it exists
      if (
        this.config.enabledProviders &&
        !this.config.enabledProviders.includes(providerId)
      ) {
        this.config.enabledProviders.push(providerId);
      }

      // Try to register the provider if it's healthy
      try {
        const healthCheck = await this.aiManager.healthCheck();
        if (healthCheck[providerId] && this.isProviderAllowed(providerId)) {
          const provider = this.aiManager.getProvider(providerId);
          this.conferenceManager.registerProvider(
            providerId,
            providerId,
            provider,
          );
          logger.info(`✅ Enabled provider: ${providerId}`);
        }
      } catch (error) {
        logger.warn(`⚠️ Failed to enable provider ${providerId}:`, error);
      }
    } else {
      // Add to disabled list
      if (!this.config.disabledProviders) {
        this.config.disabledProviders = [];
      }
      if (!this.config.disabledProviders.includes(providerId)) {
        this.config.disabledProviders.push(providerId);
      }

      // Remove from enabled list if present
      if (this.config.enabledProviders) {
        this.config.enabledProviders = this.config.enabledProviders.filter(
          (p) => p !== providerId,
        );
      }

      logger.info(`🚫 Disabled provider: ${providerId}`);
    }
  }

  /**
   * Get current configuration (for inspection/debugging)
   */
  getCurrentConfig(): ConferenceConfig {
    return { ...this.config }; // Return a copy to prevent mutations
  }
}
