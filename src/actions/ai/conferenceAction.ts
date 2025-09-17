import {
  ZenAction,
  ActionContext,
  ActionParameters,
  ActionResult,
} from "../actionTypes";
import { ConferenceService } from "../../services/ai/conferenceService";
import { logger } from "../../utils/logger";

export class ConferenceAction implements ZenAction {
  name = "conference";
  description =
    "Convene multi-AI conference for complex questions and decisions";
  category = "ai" as const;

  permissions = {
    allowedSources: ["command", "api", "ai"],
  };

  schema = {
    name: "conference",
    description:
      "Convene a multi-AI conference for complex questions requiring deep analysis and multiple perspectives",
    parameters: {
      type: "object" as const,
      properties: {
        question: {
          type: "string" as const,
          description:
            "The complex question or decision that needs multi-AI deliberation",
        },
        require_consensus: {
          type: "boolean" as const,
          description:
            "Whether to require full consensus from all AI providers (default: false)",
        },
        debate_rounds: {
          type: "number" as const,
          description:
            "Number of debate rounds for refinement (1-5, default: 2)",
        },
        max_providers: {
          type: "number" as const,
          description:
            "Maximum number of AI providers to include (1-3, default: 3)",
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
          error: "Question is required for conference",
          shouldRespond: true,
          responseText: "I need a question to convene the conference.",
        };
      }

      // Get external conference service instance
      const conferenceService = ConferenceService.getInstance();

      // Initialize conference service (lazy initialization)
      logger.info("🧠 Initializing conference service...");
      try {
        await conferenceService.initialize();
      } catch (error) {
        logger.error("❌ Failed to initialize conference service:", error);
        return {
          success: false,
          error: "Failed to initialize conference service",
          shouldRespond: true,
          responseText:
            "The conference service could not be initialized. Technical difficulties in the digital realm.",
        };
      }

      // Check if conference service is available
      const healthStatus = await conferenceService.getHealthStatus();
      logger.info(
        `🧠 Health status: initialized=${healthStatus.initialized}, providers=[${healthStatus.availableProviders.join(", ")}], total=${healthStatus.totalProviders}`,
      );

      if (
        !healthStatus.initialized ||
        healthStatus.availableProviders.length < 2
      ) {
        return {
          success: false,
          error: "Conference requires at least 2 AI providers",
          shouldRespond: true,
          responseText:
            "The conference needs multiple AI providers. Only single-AI responses are currently available.",
        };
      }

      logger.info(
        `🧠 Creating conference stream for ${context.user.username}: "${question.substring(0, 100)}..."`,
      );
      logger.info(
        `🧠 Available providers: ${healthStatus.availableProviders.join(", ")}`,
      );

      const startTime = Date.now();

      // Execute external conference stream: 1 Zenbot + 2 generic AIs
      const result = await conferenceService.createConferenceStream(
        context.user.id,
        context.guild?.id || "api-context",
        question,
        {
          includeZenbot: true, // Always include Zenbot as requested
          maxProviders: Math.max(1, Math.min(3, max_providers)),
          debateRounds: Math.max(1, Math.min(5, debate_rounds)),
          requireConsensus: require_consensus,
          providerFilter: provider_filter as
            | "all"
            | "reasoning"
            | "creative"
            | "fast",
        },
      );

      const duration = Date.now() - startTime;

      logger.info(
        `🎭 Conference completed in ${duration}ms with ${(result.consensusLevel * 100).toFixed(1)}% consensus`,
      );

      // Format response based on consciousness level
      let responseText = result.response;
      if (result.consensusLevel < 0.7 && result.providers.length > 1) {
        responseText = `**Multi-AI Conference Result** (${(result.consensusLevel * 100).toFixed(0)}% consensus):\n\n${result.response}`;
      } else if (result.providers.length > 1) {
        responseText = `**Unified AI Conference**: ${result.response}`;
      } else {
        responseText = `**AI Response**: ${result.response}`;
      }

      return {
        success: true,
        message: `Conference completed with ${result.providers.length} providers`,
        data: {
          question,
          response: result.response,
          providers: result.providers,
          consensusLevel: result.consensusLevel,
          conferenceLevel: result.conferenceLevel,
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
      logger.error("🧠 Conference action failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        shouldRespond: true,
        responseText:
          "The conference encountered an error. The digital minds are temporarily misaligned.",
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

    if (
      parameters.debate_rounds &&
      (parameters.debate_rounds < 1 || parameters.debate_rounds > 5)
    ) {
      return false;
    }

    if (
      parameters.max_providers &&
      (parameters.max_providers < 1 || parameters.max_providers > 3)
    ) {
      return false;
    }

    const validFilters = ["all", "reasoning", "creative", "fast"];
    if (
      parameters.provider_filter &&
      !validFilters.includes(parameters.provider_filter)
    ) {
      return false;
    }

    return true;
  }
}
