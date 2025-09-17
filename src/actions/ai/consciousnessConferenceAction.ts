import {
  ZenAction,
  ActionContext,
  ActionParameters,
  ActionResult,
} from "../actionTypes";
import { ZenbotService } from "../../services/zenbotService";
import { logger } from "../../utils/logger";

export class ConsciousnessConferenceAction implements ZenAction {
  name = "consciousness_conference";
  description = "Convene multi-AI consciousness conference for complex questions and decisions";
  category = "ai" as const;

  permissions = {
    allowedSources: ["command", "api", "ai"],
  };

  schema = {
    name: "consciousness_conference",
    description: "Convene a multi-AI consciousness conference for complex questions requiring deep analysis and multiple perspectives",
    parameters: {
      type: "object" as const,
      properties: {
        question: {
          type: "string" as const,
          description: "The complex question or decision that needs multi-AI deliberation",
        },
        require_consensus: {
          type: "boolean" as const,
          description: "Whether to require full consensus from all AI providers (default: false)",
        },
        debate_rounds: {
          type: "number" as const,
          description: "Number of debate rounds for refinement (1-5, default: 2)",
        },
        max_providers: {
          type: "number" as const,
          description: "Maximum number of AI providers to include (1-3, default: 3)",
        },
        provider_filter: {
          type: "string" as const,
          description: "Filter providers by capability",
          enum: ["all", "reasoning", "creative", "fast"],
        },
      },
      required: ["question"],
    },
  };

  async execute(
    context: ActionContext,
    parameters: ActionParameters,
  ): Promise<ActionResult> {
    try {
      const {
        question,
        require_consensus = false,
        debate_rounds = 2,
        max_providers = 3,
        provider_filter = "all",
      } = parameters;

      if (!question || typeof question !== "string") {
        return {
          success: false,
          error: "Question is required for consciousness conference",
          shouldRespond: true,
          responseText: "I need a question to convene the consciousness conference.",
        };
      }

      // Get ZenbotService instance
      const zenbotService = ZenbotService.getInstance();
      
      // Check if consciousness conference is available
      if (!zenbotService.isConsciousnessAvailable()) {
        return {
          success: false,
          error: "Consciousness conference requires at least 2 AI providers",
          shouldRespond: true,
          responseText: "The consciousness conference needs multiple AI providers. Only single-AI responses are currently available.",
        };
      }

      logger.info(`🧠 Starting consciousness conference for ${context.user.username}: "${question.substring(0, 100)}..."`);

      const startTime = Date.now();

      // Create minimal interaction context for ZenbotService
      const interactionContext = {
        user: {
          id: context.user.id,
          username: context.user.username,
          displayName: context.user.displayName || context.user.username,
        },
        guild: context.guild || { id: "api-context", name: "API Context" },
        channel: { id: "conference-channel", name: "Consciousness Conference" },
      };

      // Execute consciousness conference via ZenbotService
      const result = await zenbotService.consciousnessConference(
        interactionContext,
        question,
        {
          requireConsensus: require_consensus,
          debateRounds: Math.max(1, Math.min(5, debate_rounds)),
          maxProviders: Math.max(1, Math.min(3, max_providers)),
          providerFilter: provider_filter as "all" | "reasoning" | "creative" | "fast",
        }
      );

      const duration = Date.now() - startTime;
      
      logger.info(`🎭 Consciousness conference completed in ${duration}ms with ${(result.consensusLevel * 100).toFixed(1)}% consensus`);

      // Format response based on consciousness level
      let responseText = result.response;
      if (result.consensusLevel < 0.7 && result.providers.length > 1) {
        responseText = `**Multi-AI Conference Result** (${(result.consensusLevel * 100).toFixed(0)}% consensus):\n\n${result.response}`;
      } else if (result.providers.length > 1) {
        responseText = `**Unified AI Consciousness**: ${result.response}`;
      } else {
        responseText = `**AI Response**: ${result.response}`;
      }

      return {
        success: true,
        message: `Consciousness conference completed with ${result.providers.length} providers`,
        data: {
          question,
          response: result.response,
          providers: result.providers,
          consensusLevel: result.consensusLevel,
          consciousnessLevel: result.consciousnessLevel,
          reasoning: result.reasoning,
          synthesisTime: result.synthesisTime,
          debateRounds: debate_rounds,
          requireConsensus: require_consensus,
          totalDuration: duration,
        },
        shouldRespond: true,
        responseText,
        useVoice: context.voiceChannel ? true : false,
      };
    } catch (error) {
      logger.error("🧠 Consciousness conference action failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        shouldRespond: true,
        responseText: "The consciousness conference encountered an error. The digital minds are temporarily misaligned.",
      };
    }
  }

  validate(parameters: ActionParameters): boolean {
    if (!parameters.question || typeof parameters.question !== "string") {
      return false;
    }
    
    if (parameters.question.length > 1000) {
      return false;
    }
    
    if (parameters.debate_rounds && (parameters.debate_rounds < 1 || parameters.debate_rounds > 5)) {
      return false;
    }
    
    if (parameters.max_providers && (parameters.max_providers < 1 || parameters.max_providers > 3)) {
      return false;
    }
    
    const validFilters = ["all", "reasoning", "creative", "fast"];
    if (parameters.provider_filter && !validFilters.includes(parameters.provider_filter)) {
      return false;
    }
    
    return true;
  }
}