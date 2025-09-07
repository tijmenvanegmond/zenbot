import {
  ZenAction,
  ActionContext,
  ActionParameters,
  ActionResult,
} from "../actionTypes";
import { VoiceService } from "../../services/voiceService";
import { VoiceSessionManager } from "../../services/voiceSessionManager";
import { playResourceInChannel } from "../../utils/voiceHelpers";
import { logger } from "../../utils/logger";
import { VoiceChannel } from "discord.js";

/**
 * Unified TTS Action - handles all text-to-speech functionality
 * Consolidates TTS logic from commands, voice responses, and AI interactions
 */
export class TTSAction implements ZenAction {
  name = "tts";
  description = "Convert text to speech and play in voice channel";
  category = "voice" as const;

  permissions = {
    requiresVoiceChannel: true,
    allowedSources: ["command", "voice", "api", "ai"],
  };

  schema = {
    name: "tts",
    description: "Convert text to speech with Zenyatta voice styling",
    parameters: {
      type: "object" as const,
      properties: {
        text: {
          type: "string" as const,
          description: "The text to convert to speech",
        },
        voice_style: {
          type: "string" as const,
          description: "Voice style and mood",
          enum: ["zen", "playful", "wise", "mysterious", "normal"],
        },
        activity_type: {
          type: "string" as const,
          description: "Type of activity triggering TTS",
          enum: [
            "command",
            "voice-response",
            "ai-advice",
            "quote",
            "greeting",
            "error",
          ],
        },
        interrupt_current: {
          type: "boolean" as const,
          description: "Whether to interrupt currently playing audio",
        },
        add_zen_prefix: {
          type: "boolean" as const,
          description: "Whether to add zen wisdom prefix",
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
        voice_style = "zen",
        activity_type = "command",
        interrupt_current = false,
        add_zen_prefix = false,
      } = parameters;

      if (!context.voiceChannel || !context.guild) {
        return {
          success: false,
          error: "Voice channel and guild context required",
          shouldRespond: true,
          responseText: "I need to be in a voice channel to speak",
        };
      }

      // Enhance text based on voice style and activity type
      const enhancedText = this.enhanceTextForVoice(
        text,
        voice_style,
        activity_type,
        add_zen_prefix,
      );

      logger.info(
        `🗣️ TTS Action: "${enhancedText.substring(0, 100)}..." (style: ${voice_style}, type: ${activity_type})`,
      );

      // Handle interruption if requested
      if (interrupt_current) {
        const sessionManager = VoiceSessionManager.getInstance();
        const session = sessionManager.getSession(context.guild.id);
        if (
          session?.activeActivities.has("tts") ||
          session?.activeActivities.has("voice")
        ) {
          await sessionManager.endActivity(context.guild.id, "tts");
          logger.info(`🗣️ Interrupted current TTS for new message`);
        }
      }

      // Create TTS resource using existing voice service
      const voiceLine = {
        text: enhancedText,
        voiceUri: null,
        length: enhancedText.length,
      };

      const resource = await VoiceService.createVoiceLineResource(voiceLine);

      // Play in voice channel
      await playResourceInChannel(
        context.voiceChannel as VoiceChannel,
        resource,
      );

      // Register TTS activity with session manager
      const sessionManager = VoiceSessionManager.getInstance();
      const session = sessionManager.getSession(context.guild.id);
      if (session) {
        session.activeActivities.add("tts");
        // Auto-remove TTS activity after estimated duration
        setTimeout(() => {
          session.activeActivities.delete("tts");
        }, this.estimateAudioDuration(enhancedText));
      }

      return {
        success: true,
        message: "TTS completed successfully",
        data: {
          text: enhancedText,
          style: voice_style,
          duration_estimate: this.estimateAudioDuration(enhancedText),
          channel: context.voiceChannel.name,
        },
        shouldRespond: false, // Don't send text response for TTS-only actions
      };
    } catch (error) {
      logger.error("🗣️ TTS Action failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown TTS error",
        shouldRespond: true,
        responseText:
          "I experienced a disturbance while trying to speak. The harmony will return shortly.",
      };
    }
  }

  /**
   * Enhance text based on voice style and context
   */
  private enhanceTextForVoice(
    text: string,
    style: string,
    activityType: string,
    addPrefix: boolean,
  ): string {
    let enhanced = text;

    // Add zen prefixes based on activity type
    if (addPrefix) {
      switch (activityType) {
        case "ai-advice":
          enhanced = `Let wisdom guide you... ${text}`;
          break;
        case "quote":
          enhanced = `From the depths of understanding... ${text}`;
          break;
        case "voice-response":
          enhanced = `I hear your voice and respond... ${text}`;
          break;
        case "greeting":
          enhanced = `Peace and tranquility to you... ${text}`;
          break;
        case "error":
          enhanced = `Through discord, we find harmony... ${text}`;
          break;
      }
    }

    // Adjust pacing based on voice style
    switch (style) {
      case "wise":
        enhanced = enhanced.replace(/\./g, "... "); // Add pauses for wisdom
        break;
      case "mysterious":
        enhanced = enhanced.replace(/,/g, "... "); // More mysterious pauses
        break;
      case "playful":
        enhanced = enhanced.replace(/!/g, "! "); // Quick, energetic
        break;
      case "zen":
      default:
        // Natural zen pacing - no changes needed
        break;
    }

    return enhanced;
  }

  /**
   * Estimate audio duration for session management
   */
  private estimateAudioDuration(text: string): number {
    // Rough estimate: ~150 words per minute, ~5 chars per word
    const wordsPerMinute = 150;
    const charsPerWord = 5;
    const estimatedWords = text.length / charsPerWord;
    const estimatedMinutes = estimatedWords / wordsPerMinute;

    // Add buffer time and convert to milliseconds
    return Math.max(2000, estimatedMinutes * 60 * 1000 + 2000);
  }

  validate(parameters: ActionParameters): boolean {
    if (
      !parameters.text ||
      typeof parameters.text !== "string" ||
      parameters.text.trim().length === 0
    ) {
      return false;
    }

    const validStyles = ["zen", "playful", "wise", "mysterious", "normal"];
    if (
      parameters.voice_style &&
      !validStyles.includes(parameters.voice_style)
    ) {
      return false;
    }

    const validActivityTypes = [
      "command",
      "voice-response",
      "ai-advice",
      "quote",
      "greeting",
      "error",
    ];
    if (
      parameters.activity_type &&
      !validActivityTypes.includes(parameters.activity_type)
    ) {
      return false;
    }

    return true;
  }
}
