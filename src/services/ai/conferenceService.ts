/**
 * Standalone Conference Service
 * External conference stream manager that can coordinate multiple AI instances
 * including Zenbot as a participant (not orchestrator)
 */

import { DefaultAIServiceManager } from "./aiServiceManager";
import { UnifiedConferenceManager } from "./unifiedConferenceManager";
import { ZenbotVirtualProvider } from "./zenbotVirtualProvider";
import { logger } from "../../utils/logger";

export interface ConferenceStreamConfig {
  includeZenbot: boolean;
  maxProviders: number;
  debateRounds: number;
  requireConsensus: boolean;
  providerFilter?: "all" | "reasoning" | "creative" | "fast";
}

export interface ConferenceStreamResult {
  response: string;
  providers: string[];
  consensusLevel: number;
  conferenceLevel: "individual" | "collaborative" | "consensus";
  reasoning: string;
  synthesisTime: number;
}

/**
 * Standalone conference service that manages multi-AI streams
 * Independent of any individual AI instance
 */
export class ConferenceService {
  private static instance: ConferenceService | null = null;
  private conferenceManager: UnifiedConferenceManager | null = null;
  private aiManager: DefaultAIServiceManager | null = null;

  private constructor() {}

  /**
   * Get the singleton conference service instance
   */
  static getInstance(): ConferenceService {
    if (!ConferenceService.instance) {
      ConferenceService.instance = new ConferenceService();
    }
    return ConferenceService.instance;
  }

  /**
   * Initialize the conference service with AI providers (public method)
   */
  async initialize(): Promise<void> {
    if (this.conferenceManager) {
      logger.debug("🧠 Conference service already initialized");
      return; // Already initialized
    }

    try {
      logger.info("🧠 Initializing standalone conference service...");

      // Create fresh AI manager using our centralized config (NO ANTHROPIC)
      this.aiManager = new DefaultAIServiceManager({
        defaultProvider: "gemini",
        providers: {
          openai: { apiKey: process.env.OPENAI_API_KEY },
          // anthropic: { apiKey: process.env.ANTHROPIC_API_KEY }, // DISABLED
          gemini: { apiKey: process.env.GOOGLE_AI_API_KEY },
        },
        session: {
          defaultExpiry: 60, // 1 hour
          maxMessages: 100,
          cleanupInterval: 30,
          storage: "memory",
        },
        routing: {
          simple: "gemini",
          conversation: "gemini",
          functions: "openai",
          streaming: "gemini",
        },
      });

      // AI manager initializes providers in constructor automatically

      // Create unified conference manager
      this.conferenceManager = new UnifiedConferenceManager(this.aiManager, {
        enableCollaboration: true,
        requireConsensus: false,
        maxProvidersPerQuery: 2, // Reduce to speed up
        debateRounds: 1, // Reduce from 2 to 1 for speed
        consensusThreshold: 0.7,
        specialization: {
          reasoning: ["zenbot", "gemini"],
          functions: ["openai"],
          creativity: ["zenbot", "gemini", "openai"],
          speed: ["gemini"],
        },
      });

      logger.info("🧠 Standalone conference service initialized");
    } catch (error) {
      logger.error("❌ Failed to initialize conference service:", error);
      throw error;
    }
  }

  /**
   * Create a conference stream: 1 Zenbot + 2 generic AIs (as requested)
   */
  async createConferenceStream(
    userId: string,
    contextId: string,
    question: string,
    config: ConferenceStreamConfig = {
      includeZenbot: true,
      maxProviders: 3,
      debateRounds: 2,
      requireConsensus: false,
    },
  ): Promise<ConferenceStreamResult> {
    await this.initialize();

    if (!this.conferenceManager) {
      throw new Error("Conference service not initialized");
    }

    try {
      logger.info(
        `🧠 Creating conference stream: "${question.substring(0, 100)}..."`,
      );

      // For the requested architecture: 1 Zenbot + 2 generic AIs
      const systemPrompt = `You are participating in a multi-AI conference stream to analyze and debate complex questions.

Your role:
- Provide thoughtful analysis from your unique AI perspective
- Engage with other AIs' viewpoints constructively  
- Contribute to building consensus or acknowledging valid disagreements
- Maintain your authentic voice while collaborating

Current question requires deep philosophical and practical analysis.`;

      // Execute conference
      const result = await this.conferenceManager.conference(
        userId,
        contextId,
        question,
        systemPrompt,
        {
          maxDebateRounds: config.debateRounds,
          requireFullConsensus: config.requireConsensus,
          // This will create 1 Zenbot + 2 external AIs based on availability
        },
      );

      logger.info(
        `🧠 Conference stream completed with ${(result.consensusLevel * 100).toFixed(1)}% consensus`,
      );

      return {
        response: result.response,
        providers: result.providers,
        consensusLevel: result.consensusLevel,
        conferenceLevel: result.conferenceLevel,
        reasoning: result.reasoning,
        synthesisTime: result.synthesisTime,
      };
    } catch (error) {
      logger.error("❌ Conference stream failed:", error);
      throw error;
    }
  }

  /**
   * Get conference service health status
   */
  async getHealthStatus(): Promise<{
    initialized: boolean;
    availableProviders: string[];
    totalProviders: number;
  }> {
    if (!this.conferenceManager || !this.aiManager) {
      logger.debug("🧠 Conference service not initialized yet");
      return {
        initialized: false,
        availableProviders: [],
        totalProviders: 0,
      };
    }

    try {
      const healthCheck = await this.aiManager.healthCheck();
      const availableProviders = Object.keys(healthCheck).filter(
        (p) => healthCheck[p],
      );

      logger.debug(
        `🧠 Conference health check: AI providers ${availableProviders.join(", ")} are healthy`,
      );

      return {
        initialized: true,
        availableProviders: ["zenbot", ...availableProviders], // Zenbot is always available
        totalProviders: availableProviders.length + 1, // +1 for Zenbot
      };
    } catch (error) {
      logger.error("❌ Failed to get conference health status:", error);
      return {
        initialized: false,
        availableProviders: [],
        totalProviders: 0,
      };
    }
  }

  /**
   * Cleanup conference service resources
   */
  async cleanup(): Promise<void> {
    if (this.conferenceManager) {
      await this.conferenceManager.cleanup();
      this.conferenceManager = null;
    }

    if (this.aiManager) {
      // Cleanup AI manager if it has a destroy method
      if (typeof (this.aiManager as any).destroy === "function") {
        (this.aiManager as any).destroy();
      }
      this.aiManager = null;
    }

    logger.info("🧠 Conference service cleaned up");
  }
}
