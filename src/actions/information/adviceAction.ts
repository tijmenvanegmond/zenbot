import {
  ZenAction,
  ActionContext,
  ActionParameters,
  ActionResult,
} from "../actionTypes";
import { ZenbotService } from "../../services/zenbotService";
import { UnifiedVoiceService } from "../../services/voice/UnifiedVoiceService";
import { getContextualAdvice } from "../../voice/voiceLineData";
import { logger } from "../../utils/logger";

export class AdviceAction implements ZenAction {
  name = "get_advice";
  description =
    "Get sharp, concise advice from Zenbot (AI contextual or curated wisdom)";
  category = "information" as const;

  permissions = {
    allowedSources: ["command", "voice", "api"], // Removed "ai" to prevent recursive loops
  };

  schema = {
    name: "get_advice",
    description:
      "Get personalized advice from Zenbot (context-aware AI) or curated wisdom",
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
        `🎭 Advice request: type=${advice_type}, topic="${topic || "general"}", urgency=${urgency}`,
      );

      // STEP 1: Generate advice text (AI or curated)
      const { adviceText, isAIGenerated } = await this.generateAdvice(
        advice_type,
        context,
        topic,
        urgency,
      );

      // STEP 2: Speak the same text we show. When the AI calls this as a
      // function, it gets the advice back and decides what to say itself.
      let spoken = false;
      if (use_voice && context.source !== "ai" && context.voiceChannel) {
        // Say who asked and about what - voice listeners can't see the command
        const asker = context.user.displayName || context.user.username;
        const trigger = topic
          ? `${asker} wants advice on ${topic}.`
          : `${asker} wants advice.`;
        await this.playAdviceVoice(
          `${trigger}[pause:0.7] ${adviceText}`,
          context.voiceChannel,
          advice_type,
        );
        spoken = true;
      }
      logger.info(
        `🎭 Advice (${isAIGenerated ? "AI" : "curated"}): "${adviceText}"${spoken ? " (spoken)" : ""}`,
      );

      // STEP 3: Return result
      return {
        success: true,
        message: `Advice provided: ${advice_type}${isAIGenerated ? " (AI)" : " (curated)"}`,
        data: {
          advice: adviceText,
          topic,
          type: advice_type,
          urgency,
          source: isAIGenerated ? "ai" : "curated",
          voiceEnabled: spoken,
        },
        shouldRespond: true,
        responseText: adviceText,
        useVoice: false, // already spoken above (or left to the AI)
      };
    } catch (error) {
      logger.error("🎭 Advice action failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        shouldRespond: true,
        responseText:
          "I encountered difficulty accessing the wisdom of the Iris. Please try again.",
      };
    }
  }

  /**
   * Generate advice text (AI-powered or curated)
   */
  private async generateAdvice(
    advice_type: string,
    context: ActionContext,
    topic?: string,
    urgency: string = "medium",
  ): Promise<{ adviceText: string; isAIGenerated: boolean }> {
    // Use AI for contextual advice
    if (advice_type === "ai_contextual" && context.interaction) {
      const adviceText = await ZenbotService.getInstance().getAdvice(
        topic,
        urgency as "low" | "medium" | "high",
      );
      if (adviceText) {
        return { adviceText, isAIGenerated: true };
      }
      // Fall through to curated advice (AI unavailable, slow or rejected)
    }

    // Use curated wisdom
    const adviceCategory =
      advice_type === "random" ? this.getRandomCategory() : advice_type;

    const voiceLine = getContextualAdvice(adviceCategory as any);
    let adviceText = voiceLine.text;

    // Add topic context for curated advice
    if (topic) {
      adviceText = `Regarding ${topic}: ${adviceText}`;
    }

    logger.info(`🎭 Using curated wisdom (category: ${adviceCategory})`);

    return { adviceText, isAIGenerated: false };
  }

  /**
   * Play advice as voice in voice channel
   */
  private async playAdviceVoice(
    text: string,
    voiceChannel: any,
    advice_type: string,
  ): Promise<void> {
    try {
      const voiceService = UnifiedVoiceService.getInstance();
      await voiceService.speak({
        text,
        profile: undefined, // default profile (piper-zen)
        voiceChannel,
        activityType: "advice",
      });
      logger.info(
        `🎭 Advice delivered via TTS: "${text.substring(0, 50)}..." (type: ${advice_type})`,
      );
    } catch (error) {
      logger.warn(
        "🎭 TTS failed for advice, continuing with text response:",
        error,
      );
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
