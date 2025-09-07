import {
  ZenAction,
  ActionContext,
  ActionParameters,
  ActionResult,
} from "../actionTypes";
import { SmartTtsService } from "../../services/smartTtsService";
import { logger } from "../../utils/logger";

export class EnhancedTtsAction implements ZenAction {
  name = "enhanced_tts";
  description =
    "Advanced text-to-speech with voice options and session awareness";
  category = "voice" as const;

  permissions = {
    requiresVoiceChannel: true,
    allowedSources: ["command", "voice", "api", "ai"],
  };

  schema = {
    name: "enhanced_tts",
    description:
      "Play advanced text-to-speech with Zenyatta voice in voice channels",
    parameters: {
      type: "object" as const,
      properties: {
        text: {
          type: "string" as const,
          description: "The text to convert to speech and play",
        },
        voice_style: {
          type: "string" as const,
          description: "The style of voice delivery",
          enum: ["normal", "wisdom", "meditation", "encouragement"],
        },
        interrupt_existing: {
          type: "boolean" as const,
          description: "Whether to interrupt any currently playing audio",
        },
      },
      required: ["text"],
    },
  };

  async execute(
    context: ActionContext,
    parameters: ActionParameters,
  ): Promise<ActionResult> {
    try {
      const {
        text,
        voice_style = "normal",
        interrupt_existing = false,
      } = parameters;

      if (!text || typeof text !== "string" || text.trim().length === 0) {
        return {
          success: false,
          error: "Text parameter is required and must be a non-empty string",
          shouldRespond: true,
          responseText: "I need some text to speak",
        };
      }

      if (!context.voiceChannel) {
        return {
          success: false,
          error: "Voice channel is required for TTS",
          shouldRespond: true,
          responseText: "I need to be in a voice channel to speak",
        };
      }

      // Apply voice style modifications to text
      const styledText = this.applyVoiceStyle(text, voice_style);

      const smartTts = SmartTtsService.getInstance();

      // Choose TTS method based on context and interrupt preference
      const activityType =
        context.source === "ai"
          ? "ai-tts"
          : context.source === "voice"
            ? "voice-tts"
            : "command-tts";

      // Use session TTS for ongoing sessions, regular TTS for standalone requests
      if (context.isVoiceInteraction || !interrupt_existing) {
        await smartTts.playTTSInSession(
          context.voiceChannel,
          styledText,
          activityType,
        );
      } else {
        await smartTts.playTTS(context.voiceChannel, styledText, activityType);
      }

      logger.info(
        `🎭 Enhanced TTS completed: "${styledText.substring(0, 50)}..." (style: ${voice_style})`,
      );

      return {
        success: true,
        message: `TTS played with ${voice_style} style`,
        data: {
          text: styledText,
          originalText: text,
          style: voice_style,
          channel: context.voiceChannel.name,
        },
        shouldRespond: false, // TTS is the response
      };
    } catch (error) {
      logger.error("🎭 Enhanced TTS action failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        shouldRespond: true,
        responseText:
          "I encountered an issue with text-to-speech. Please try again.",
      };
    }
  }

  /**
   * Apply voice style modifications to text
   */
  private applyVoiceStyle(text: string, style: string): string {
    switch (style) {
      case "wisdom":
        return `Hmm. ${text} Such is the nature of understanding.`;

      case "meditation":
        return `*breathes deeply* ... ${text} ... Experience tranquility.`;

      case "encouragement":
        return `${text} Remember, you have the strength within you. Walk in harmony.`;

      case "normal":
      default:
        return text;
    }
  }

  validate(parameters: ActionParameters): boolean {
    if (!parameters.text || typeof parameters.text !== "string") {
      return false;
    }

    const validStyles = ["normal", "wisdom", "meditation", "encouragement"];
    if (
      parameters.voice_style &&
      !validStyles.includes(parameters.voice_style)
    ) {
      return false;
    }

    return parameters.text.trim().length > 0 && parameters.text.length <= 1000;
  }
}
