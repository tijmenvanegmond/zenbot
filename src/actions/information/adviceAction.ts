import {
  ZenAction,
  ActionContext,
  ActionParameters,
  ActionResult,
} from "../actionTypes";
import { ZenyattaAssistantService } from "../../services/zenyattaAssistantService";
import { VoiceService } from "../../services/voiceService";
import { SmartTtsService } from "../../services/smartTtsService";
import { logger } from "../../utils/logger";

export class AdviceAction implements ZenAction {
  name = "get_advice";
  description =
    "Get wise advice from Zenyatta with AI intelligence or predefined wisdom";
  category = "information" as const;

  permissions = {
    allowedSources: ["command", "voice", "api", "ai"],
  };

  schema = {
    name: "get_advice",
    description:
      "Get personalized advice from Zenyatta, either AI-powered or from curated wisdom",
    parameters: {
      type: "object" as const,
      properties: {
        topic: {
          type: "string" as const,
          description: "The topic you need advice about",
        },
        advice_type: {
          type: "string" as const,
          description: "Type of advice to provide",
          enum: [
            "ai_contextual",
            "philosophical",
            "greeting",
            "harmony",
            "discord",
            "transcendence",
            "random",
          ],
        },
        urgency: {
          type: "string" as const,
          description: "How urgent is this advice needed",
          enum: ["low", "medium", "high"],
        },
        use_voice: {
          type: "boolean" as const,
          description:
            "Whether to deliver advice via voice if user is in voice channel",
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
      const {
        topic,
        advice_type = "ai_contextual",
        urgency = "medium",
        use_voice = true,
      } = parameters;

      logger.info(
        `🎭 Advice request: type=${advice_type}, topic="${topic}", urgency=${urgency}`,
      );

      let adviceText: string;
      let isAIGenerated = false;

      if (advice_type === "ai_contextual" && context.interaction) {
        // Use AI for contextual advice
        try {
          const zenyatta = ZenyattaAssistantService.getInstance();
          const message = topic
            ? `I seek guidance about ${topic}. My urgency level is ${urgency}.`
            : `I seek general wisdom and guidance. My urgency level is ${urgency}.`;

          const response = await zenyatta.getAdvice(
            context.interaction,
            topic,
            urgency as any,
          );
          adviceText = response.text;
          isAIGenerated = true;
        } catch (error) {
          logger.warn(
            "🎭 AI advice failed, falling back to predefined wisdom:",
            error,
          );
          // Fall back to predefined advice
          const voiceLine = VoiceService.getContextualAdvice("philosophical");
          adviceText = voiceLine.text;
        }
      } else {
        // Use predefined wisdom
        const adviceCategory =
          advice_type === "random" ? this.getRandomCategory() : advice_type;

        const voiceLine = VoiceService.getContextualAdvice(
          adviceCategory as any,
        );
        adviceText = voiceLine.text;
      }

      // Enhance advice with topic context if provided
      if (topic && !isAIGenerated) {
        adviceText = `Regarding ${topic}: ${adviceText}`;
      }

      // Determine if we should use voice
      const shouldUseVoice = use_voice && context.voiceChannel;

      // If user wants voice and is in voice channel, play TTS
      if (shouldUseVoice) {
        try {
          const smartTts = SmartTtsService.getInstance();
          await smartTts.playTTS(context.voiceChannel!, adviceText, "advice");
          logger.info(
            `🎭 Advice delivered via TTS: "${adviceText.substring(0, 50)}..." (type: ${advice_type})`,
          );
        } catch (error) {
          logger.warn(
            "🎭 TTS failed for advice, continuing with text response:",
            error,
          );
        }
      }

      return {
        success: true,
        message: `Advice provided: ${advice_type}${isAIGenerated ? " (AI)" : " (curated)"}`,
        data: {
          advice: adviceText,
          topic,
          type: advice_type,
          urgency,
          source: isAIGenerated ? "ai" : "curated",
          voiceEnabled: shouldUseVoice,
        },
        shouldRespond: true,
        responseText: adviceText,
        useVoice: shouldUseVoice,
      };
    } catch (error) {
      logger.error("🎭 Advice action failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        shouldRespond: true,
        responseText:
          "I encountered difficulty accessing the wisdom of the Iris. Please try again, and we shall find the path together.",
      };
    }
  }

  private getRandomCategory(): string {
    const categories = [
      "philosophical",
      "greeting",
      "harmony",
      "discord",
      "transcendence",
    ];
    return categories[Math.floor(Math.random() * categories.length)];
  }

  validate(parameters: ActionParameters): boolean {
    const validTypes = [
      "ai_contextual",
      "philosophical",
      "greeting",
      "harmony",
      "discord",
      "transcendence",
      "random",
    ];
    const validUrgencies = ["low", "medium", "high"];

    return (
      (!parameters.advice_type ||
        validTypes.includes(parameters.advice_type)) &&
      (!parameters.urgency || validUrgencies.includes(parameters.urgency)) &&
      (!parameters.topic ||
        (typeof parameters.topic === "string" &&
          parameters.topic.length <= 200))
    );
  }
}
