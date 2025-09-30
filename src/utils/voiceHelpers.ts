import { VoiceChannel } from "discord.js";
import { AudioResource } from "@discordjs/voice";
import { UnifiedVoiceService } from "../services/voice/UnifiedVoiceService";
import { logger } from "./logger";

/**
 * Plays text as TTS in a voice channel
 */
export async function playTTSInChannel(
  channel: VoiceChannel,
  text: string,
): Promise<void> {
  const voiceService = UnifiedVoiceService.getInstance();
  await voiceService.speak({
    text,
    voiceChannel: channel,
    activityType: "tts",
  });
}

/**
 * Plays an audio resource in a voice channel with error handling
 */
export async function playResourceInChannel(
  channel: VoiceChannel,
  resource: AudioResource,
): Promise<void> {
  // This method is deprecated - use UnifiedVoiceService directly
  throw new Error(
    "playResourceInChannel is deprecated - use UnifiedVoiceService.speak() instead",
  );
}

/**
 * Common voice channel interaction patterns
 */
export class VoiceChannelHelper {
  static async executeTTSCommand(
    channel: VoiceChannel,
    text: string,
    commandName: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      await playTTSInChannel(channel, text);
      return {
        success: true,
        message: `${commandName} executed in voice channel ${channel.name}`,
      };
    } catch (error) {
      logger.error(`Error executing ${commandName} command:`, error);
      return {
        success: false,
        message: `Failed to execute ${commandName} command`,
      };
    }
  }
}
