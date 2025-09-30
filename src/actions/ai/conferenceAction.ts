import {
  ZenAction,
  ActionContext,
  ActionParameters,
  ActionResult,
} from "../actionTypes";
import { UnifiedConferenceManager } from "../../services/ai/unifiedConferenceManager";
import { DefaultAIServiceManager } from "../../services/ai/aiServiceManager";
import { ZenbotService } from "../../services/zenbotService";
import { logger } from "../../utils/logger";

interface ConferenceTranscript {
  timestamp: string;
  question: string;
  participants: {
    id: string;
    name: string;
    type: "zenbot" | "external";
  }[];
  rounds: {
    round: number;
    contributions: {
      participant: string;
      response: string;
      confidence: number;
      timestamp: string;
    }[];
  }[];
  synthesis: {
    finalResponse: string;
    consensusLevel: number;
    reasoning: string;
    synthesisTime: number;
  };
  metadata: {
    totalDuration: number;
    debateRounds: number;
    conferenceLevel: string;
  };
}

export class ConferenceAction implements ZenAction {
  name = "conference";
  description =
    "Multi-personality conference with Zenbot selection and full transcripts";
  category = "ai" as const;

  permissions = {
    allowedSources: ["command", "api", "ai"],
  };

  schema = {
    name: "conference",
    description:
      "Convene an advanced multi-AI conference with personality selection and detailed transcripts",
    parameters: {
      type: "object" as const,
      properties: {
        question: {
          type: "string" as const,
          description: "The complex question or topic for the conference",
        },
        zenbot_personalities: {
          type: "array" as const,
          items: {
            type: "string" as const,
            enum: [
              "zenbot-default",
              "zenbot-philosopher",
              "zenbot-critic",
              "zenbot-optimist",
              "zenbot-pessimist",
              "zenbot-chaos",
              "zenbot-wise",
            ],
          },
          description:
            "Which Zenbot personalities to include in the conference",
        },
        debate_rounds: {
          type: "number" as const,
          description: "Number of debate rounds (1-5, default: 2)",
          minimum: 1,
          maximum: 5,
        },
        require_consensus: {
          type: "boolean" as const,
          description: "Whether to require consensus (default: false)",
        },
        include_transcript: {
          type: "boolean" as const,
          description:
            "Include detailed conversation transcript (default: true)",
        },
        max_participants: {
          type: "number" as const,
          description: "Maximum number of participants (2-8, default: 4)",
          minimum: 2,
          maximum: 8,
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
        zenbot_personalities = ["zenbot-default"],
        debate_rounds = 2,
        require_consensus = false,
        include_transcript = true,
        max_participants = 4,
      } = parameters;

      if (!question || typeof question !== "string") {
        return {
          success: false,
          error: "Question is required for conference",
          shouldRespond: true,
          responseText: "I need a question to convene the conference.",
        };
      }

      logger.info(
        `🎭 Starting enhanced conference: "${question.substring(0, 100)}..."`,
      );
      logger.info(
        `🎭 Requested personalities: ${Array.isArray(zenbot_personalities) ? zenbot_personalities.join(", ") : "none"}`,
      );

      // Get AI manager from ZenbotService
      const zenbotService = ZenbotService.getInstance();
      const aiManager = (zenbotService as any)
        .aiManager as DefaultAIServiceManager;

      if (!aiManager) {
        return {
          success: false,
          error: "AI manager not available",
          shouldRespond: true,
          responseText: "The conference system is not properly initialized.",
        };
      }

      // Build simplified Zenbot-only conference configuration
      const conferenceConfig = {
        enableCollaboration: true,
        maxProvidersPerQuery: Math.min(max_participants, 8),
        debateRounds: Math.max(1, Math.min(5, debate_rounds)),
        consensusThreshold: require_consensus ? 0.8 : 0.6,
        requireConsensus: require_consensus,

        // Zenbot personalities only
        zenbotPersonalities: Array.isArray(zenbot_personalities)
          ? zenbot_personalities
          : ["zenbot-default"],
        zenbotOnly: true,
        requireZenbot: true,
        allowRuntimePersonalityChanges: false,

        specialization: {
          reasoning: ["zenbot-philosopher", "zenbot-critic"],
          functions: ["zenbot-default"],
          creativity: ["zenbot-chaos", "zenbot-optimist"],
          speed: ["zenbot-default"],
        },
      };

      logger.info("🧠 Creating conference manager with config:", {
        personalities: conferenceConfig.zenbotPersonalities,
        zenbotOnly: conferenceConfig.zenbotOnly,
        maxParticipants: conferenceConfig.maxProvidersPerQuery,
      });

      // Create conference manager
      const conferenceManager = new UnifiedConferenceManager(
        aiManager,
        conferenceConfig,
      );

      // Wait for initialization
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const startTime = Date.now();

      // Execute the conference
      const systemPrompt = `You are participating in a multi-AI conference about: ${question}

Context: ${context.guild?.name || "API"} server, user ${context.user.displayName}

Provide thoughtful, distinctive perspectives while maintaining your unique voice and personality.`;

      // Use the direct conference method with required providers
      const requiredProviders = conferenceConfig.zenbotPersonalities || [];

      const result = await conferenceManager.conference(
        context.user.id,
        context.guild?.id || "enhanced-conference",
        question,
        systemPrompt,
        {
          requiredProviders,
          maxDebateRounds: conferenceConfig.debateRounds,
          requireFullConsensus: conferenceConfig.requireConsensus,
        },
      );

      const totalDuration = Date.now() - startTime;

      logger.info(
        `🎉 Conference completed in ${totalDuration}ms with ${result.providers.length} participants`,
      );

      // Log individual contributions for analysis
      if ((result as any).individualContributions) {
        logger.info("🎭 Individual personality contributions:");
        (result as any).individualContributions.forEach(
          (contrib: any, index: number) => {
            const displayName = contrib.provider.startsWith("zenbot")
              ? contrib.provider
                  .split("-")
                  .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(" ")
              : contrib.provider;
            logger.info(
              `  ${index + 1}. ${displayName}: "${contrib.response.substring(0, 100)}..."`,
            );
          },
        );
      }

      // Generate transcript if requested
      let transcript: ConferenceTranscript | null = null;
      if (include_transcript) {
        transcript = {
          timestamp: new Date().toISOString(),
          question,
          participants: result.providers.map((provider) => ({
            id: provider,
            name: provider.startsWith("zenbot")
              ? provider
                  .split("-")
                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(" ")
              : provider.charAt(0).toUpperCase() + provider.slice(1),
            type: provider.startsWith("zenbot") ? "zenbot" : "external",
          })),
          rounds: [
            {
              round: 1,
              contributions:
                (result as any).individualContributions?.map(
                  (contrib: any) => ({
                    participant: contrib.provider,
                    response: contrib.response,
                    confidence: contrib.confidence,
                    timestamp: new Date().toISOString(),
                  }),
                ) ||
                result.providers.map((provider) => ({
                  participant: provider,
                  response: "Contributed to collaborative response", // Fallback
                  confidence: 0.8,
                  timestamp: new Date().toISOString(),
                })),
            },
          ],
          synthesis: {
            finalResponse: result.response,
            consensusLevel: result.consensusLevel,
            reasoning: result.reasoning,
            synthesisTime: result.synthesisTime,
          },
          metadata: {
            totalDuration,
            debateRounds: debate_rounds,
            conferenceLevel: result.conferenceLevel,
          },
        };
      }

      // Format clean response
      let fullResponse = result.response;

      // Add full transcript if requested
      if (
        include_transcript &&
        transcript &&
        (result as any).individualContributions
      ) {
        fullResponse += `\n\n---\n\n📜 **Conference Transcript**\n\n`;

        (result as any).individualContributions.forEach(
          (contrib: any, index: number) => {
            const displayName = contrib.provider.startsWith("zenbot")
              ? `🤖 ${contrib.provider
                  .split("-")
                  .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(" ")}`
              : `🧠 ${contrib.provider.charAt(0).toUpperCase() + contrib.provider.slice(1)}`;

            fullResponse += `**${displayName}:** ${contrib.response}\n\n`;
          },
        );

        fullResponse += `*${(result.consensusLevel * 100).toFixed(1)}% consensus • ${(totalDuration / 1000).toFixed(1)}s*`;
      }

      // Clean up conference manager
      await conferenceManager.cleanup();

      return {
        success: true,
        message: `Enhanced conference completed with ${result.providers.length} participants`,
        data: {
          question,
          response: result.response,
          participants: result.providers,
          consensusLevel: result.consensusLevel,
          conferenceLevel: result.conferenceLevel,
          reasoning: result.reasoning,
          synthesisTime: result.synthesisTime,
          totalDuration,
          debateRounds: debate_rounds,
          transcript: transcript,
          config: {
            zenbotPersonalities: conferenceConfig.zenbotPersonalities,
            zenbotOnly: true,
          },
        },
        shouldRespond: true,
        responseText: fullResponse,
        useVoice: context.voiceChannel ? true : false,
      };
    } catch (error) {
      logger.error("❌ Enhanced conference action failed:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown conference error",
        shouldRespond: true,
        responseText:
          "The enhanced conference encountered an error. Multiple minds, singular confusion.",
      };
    }
  }

  validate(parameters: ActionParameters): boolean {
    if (!parameters.question || typeof parameters.question !== "string") {
      return false;
    }

    if (parameters.question.length > 2000) {
      return false;
    }

    if (
      parameters.debate_rounds &&
      (parameters.debate_rounds < 1 || parameters.debate_rounds > 5)
    ) {
      return false;
    }

    if (
      parameters.max_participants &&
      (parameters.max_participants < 2 || parameters.max_participants > 8)
    ) {
      return false;
    }

    // Validate Zenbot personalities
    if (
      parameters.zenbot_personalities &&
      Array.isArray(parameters.zenbot_personalities)
    ) {
      const validPersonalities = [
        "zenbot-default",
        "zenbot-philosopher",
        "zenbot-critic",
        "zenbot-optimist",
        "zenbot-pessimist",
        "zenbot-chaos",
        "zenbot-wise",
      ];

      for (const personality of parameters.zenbot_personalities) {
        if (!validPersonalities.includes(personality)) {
          return false;
        }
      }
    }

    return true;
  }
}
