import {
  ZenAction,
  ActionContext,
  ActionParameters,
  ActionResult,
} from "../actionTypes";
import { SmartTtsService } from "../../services/smartTtsService";
import { logger } from "../../utils/logger";

export class PlayTtsAction implements ZenAction {
  name = "play_tts";
  description = "Play text-to-speech audio in a voice channel";
  category = "voice" as const;

  permissions = {
    requiresVoiceChannel: true,
    allowedSources: ["command", "voice", "api", "ai"],
  };

  schema = {
    name: "play_tts",
    description: "Play text-to-speech audio in the voice channel",
    parameters: {
      type: "object" as const,
      properties: {
        text: {
          type: "string" as const,
          description: "The text to convert to speech and play",
        },
        activity_type: {
          type: "string" as const,
          description: "The type of activity (for session management)",
          enum: ["tts", "listen", "temp-tts"],
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
      const { text, activity_type = "tts" } = parameters;

      if (!text || typeof text !== "string") {
        return {
          success: false,
          error: "Text parameter is required and must be a string",
          shouldRespond: true,
          responseText: "I need text to speak",
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

      const smartTts = SmartTtsService.getInstance();

      // Use appropriate TTS method based on context
      if (context.source === "voice" || activity_type === "listen") {
        // For voice interactions or listen sessions, use session TTS
        await smartTts.playTTSInSession(
          context.voiceChannel,
          text,
          activity_type,
        );
      } else {
        // For commands and API calls, use regular TTS
        await smartTts.playTTS(context.voiceChannel, text, activity_type);
      }

      logger.info(
        `🎭 TTS action completed: "${text.substring(0, 50)}..." in channel ${context.voiceChannel.name}`,
      );

      return {
        success: true,
        message: `TTS played successfully`,
        data: { text, channel: context.voiceChannel.name },
        shouldRespond: false, // TTS is the response
      };
    } catch (error) {
      logger.error("🎭 TTS action failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        shouldRespond: true,
        responseText:
          "I encountered an issue with text-to-speech. Please try again.",
      };
    }
  }

  validate(parameters: ActionParameters): boolean {
    return typeof parameters.text === "string" && parameters.text.length > 0;
  }
}
