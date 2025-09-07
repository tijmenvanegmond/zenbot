import {
  ZenAction,
  ActionContext,
  ActionParameters,
  ActionResult,
} from "../actionTypes";
import { VoiceService } from "../../services/voiceService";
import { logger } from "../../utils/logger";

export class QuotesAction implements ZenAction {
  name = "get_quote";
  description = "Get inspirational quotes from Zenyatta";
  category = "information" as const;

  permissions = {
    allowedSources: ["command", "voice", "api", "ai"],
  };

  schema = {
    name: "get_quote",
    description:
      "Get an inspirational quote from Zenyatta, optionally filtered by theme or type",
    parameters: {
      type: "object" as const,
      properties: {
        type: {
          type: "string" as const,
          description: "The type of quote to retrieve",
          enum: [
            "greeting",
            "ability",
            "elimination",
            "ultimate",
            "interaction",
            "random",
          ],
        },
        theme: {
          type: "string" as const,
          description: "Optional theme or topic for the quote",
        },
        use_voice: {
          type: "boolean" as const,
          description:
            "Whether to play the quote as voice if user is in voice channel",
        },
      },
      required: [],
    },
  };

  async execute(
    context: ActionContext,
    parameters: ActionParameters,
  ): Promise<ActionResult> {
    try {
      const { type = "random", theme, use_voice = true } = parameters;

      // Get quote based on type - using getContextualAdvice for now
      let voiceLine;
      if (type === "random") {
        const categories = [
          "philosophical",
          "greeting",
          "harmony",
          "discord",
          "transcendence",
        ] as const;
        const randomCategory =
          categories[Math.floor(Math.random() * categories.length)];
        voiceLine = VoiceService.getContextualAdvice(randomCategory);
      } else {
        // Map quote types to advice types
        const mappedType =
          type === "ability"
            ? "philosophical"
            : type === "elimination"
              ? "discord"
              : type === "ultimate"
                ? "transcendence"
                : type === "interaction"
                  ? "harmony"
                  : "philosophical";
        voiceLine = VoiceService.getContextualAdvice(mappedType as any);
      }

      if (!voiceLine) {
        return {
          success: false,
          error: `No quotes found for type: ${type}`,
          shouldRespond: true,
          responseText: `I couldn't find any wisdom for "${type}". Perhaps try a different theme?`,
        };
      }

      logger.info(`🎭 Quote action: Retrieved ${type} quote`);

      // Determine response method
      const shouldUseVoice =
        use_voice && context.isVoiceInteraction && context.voiceChannel;

      return {
        success: true,
        message: `Quote retrieved: ${type}`,
        data: {
          quote: voiceLine.text,
          type,
          theme,
          audioFile: voiceLine.voiceUri || null,
        },
        shouldRespond: true,
        responseText: voiceLine.text,
        useVoice: shouldUseVoice,
      };
    } catch (error) {
      logger.error("🎭 Quote action failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        shouldRespond: true,
        responseText:
          "I encountered difficulty accessing the wisdom of the Iris. Please try again.",
      };
    }
  }

  validate(parameters: ActionParameters): boolean {
    const validTypes = [
      "greeting",
      "ability",
      "elimination",
      "ultimate",
      "interaction",
      "random",
    ];
    return !parameters.type || validTypes.includes(parameters.type);
  }
}
