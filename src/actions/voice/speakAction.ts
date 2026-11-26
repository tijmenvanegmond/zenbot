import {
  ZenAction,
  ActionContext,
  ActionParameters,
  ActionResult,
} from "../actionTypes";
import { VoiceChannel } from "discord.js";
import { UnifiedVoiceService } from "../../services/voice/UnifiedVoiceService";
import { getVoiceForPersonality } from "../../config/voicePersonalityMap";
import { logger } from "../../utils/logger";

/**
 * Unified speak action - replaces all TTS actions
 * Handles all voice synthesis with profile support
 */
export class SpeakAction implements ZenAction {
  name = "speak";
  description = "Speak text using voice synthesis with profile support";
  category = "voice" as const;

  permissions = {
    requiresVoiceChannel: true,
    allowedSources: ["command", "voice", "api", "ai"],
  };

  schema = {
    name: "speak",
    description:
      "Speak text in voice channel with advanced voice profile support",
    parameters: {
      type: "object" as const,
      properties: {
        text: {
          type: "string" as const,
          description: "The text to convert to speech and play",
        },
        speaker: {
          type: "string" as const,
          description:
            "Personality/speaker with optional mood (e.g., 'zenbot-default:calm', 'zenbot-default:intense', 'zenbot-default:wise'). Use moods to match emotional context: calm for contemplative/advice, intense for urgent/warnings, wise for deep philosophy, playful for lighthearted. Voice will be auto-selected based on personality. Takes precedence over 'profile'.",
        },
        profile: {
          type: "string" as const,
          description:
            "Manual voice profile override: 'piper-john', 'piper-danny', 'piper-joe', etc. Only use if 'speaker' is not provided. Can append ':speed=0.2' for custom speed.",
        },
        activity_type: {
          type: "string" as const,
          description: "Activity type for session management",
          enum: ["tts", "listen", "temp-tts", "response"],
        },
        interrupt: {
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
        speaker,
        profile,
        activity_type = "tts",
        interrupt = false,
      } = parameters;

      // Auto-select voice based on speaker/personality
      const selectedProfile = speaker
        ? getVoiceForPersonality(speaker)
        : profile;

      if (!text || typeof text !== "string" || text.trim().length === 0) {
        return {
          success: false,
          error: "Text parameter is required and must be a non-empty string",
          shouldRespond: true,
          responseText: "I need some text to speak",
        };
      }

      // Try to find voice channel if not in context
      let voiceChannel = context.voiceChannel;

      if (!voiceChannel && context.interaction?.guild) {
        // Auto-find user's voice channel from full Discord.js guild
        const member = context.interaction.guild.members.cache.get(
          context.user.id,
        );
        if (
          member?.voice.channel &&
          member.voice.channel.isVoiceBased() &&
          "speakable" in member.voice.channel
        ) {
          voiceChannel = member.voice.channel as VoiceChannel;
          logger.info(
            `🎭 Auto-found voice channel: ${voiceChannel!.name} for user ${context.user.username}`,
          );
        }
      }

      if (!voiceChannel) {
        return {
          success: false,
          error: "Voice channel is required for speech",
          shouldRespond: true,
          responseText:
            "I need you to be in a voice channel to speak. Please join a voice channel first.",
        };
      }

      // Strip markdown formatting before TTS (asterisks, underscores, etc.)
      const cleanText = text
        .replace(/\*\*/g, "") // Remove bold **text**
        .replace(/\*/g, "") // Remove italic *text*
        .replace(/__/g, "") // Remove bold __text__
        .replace(/_/g, "") // Remove italic _text_
        .replace(/~~(.+?)~~/g, "$1") // Remove strikethrough ~~text~~
        .replace(/`(.+?)`/g, "$1") // Remove inline code `text`
        .trim();

      // Use unified voice service
      const voiceService = UnifiedVoiceService.getInstance();

      const result = await voiceService.speak({
        text: cleanText,
        profile: selectedProfile,
        voiceChannel: voiceChannel,
        activityType: activity_type,
        interruptExisting: interrupt,
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Voice synthesis failed",
          shouldRespond: true,
          responseText:
            "Unable to speak - voice synthesis encountered an error",
        };
      }

      logger.info(
        `🎭 Speak action completed: "${text.substring(0, 50)}..." in ${voiceChannel.name} (speaker: ${speaker || "none"}, profile: ${selectedProfile || "default"}, provider: ${result.provider})`,
      );

      return {
        success: true,
        message: `Speech delivered successfully`,
        data: {
          text,
          speaker: speaker || "default",
          profile: selectedProfile || "default",
          provider: result.provider,
          duration: result.duration,
          channel: voiceChannel.name,
        },
        shouldRespond: false, // Speech is the response
      };
    } catch (error) {
      logger.error("Error in speak action:", error);
      return {
        success: false,
        error: (error as Error).message,
        shouldRespond: true,
        responseText: "Voice synthesis encountered an unexpected error",
      };
    }
  }
}
