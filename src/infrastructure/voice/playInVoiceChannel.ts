import { VoiceChannel } from "discord.js";
import {
  AudioPlayer,
  AudioResource,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  VoiceConnection,
  StreamType,
} from "@discordjs/voice";
import { logger } from "../../utils/logger";
import { Readable } from "stream";

export default async function PlayResourceInVoiceChannel(
  voiceChannel: VoiceChannel,
  resource: AudioResource,
) {
  try {
    logger.info(`Attempting to join voice channel: ${voiceChannel.name}`);
    const connection: VoiceConnection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guildId,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });

    logger.info(`Creating audio player for resource`);
    const audioPlayer: AudioPlayer = createAudioPlayer();

    logger.info(`Starting audio playback`);
    audioPlayer.play(resource);
    const subscription = connection.subscribe(audioPlayer);
    
    logger.info(`Audio player state: ${audioPlayer.state.status}`);

    // Cleanup function to prevent resource leaks
    const cleanupPlayer = () => {
      try {
        if (subscription) {
          subscription.unsubscribe();
        }
        if (connection.state.status !== "destroyed") {
          connection.disconnect();
          connection.destroy();
        }
        logger.info(`Zenbot left voice channel - resources cleaned up`);
      } catch (error) {
        logger.error(`Error during cleanup:`, error);
      }
    };

    audioPlayer.on("stateChange", (oldState, newState) => {
      logger.info(`Audio player state changed: ${oldState.status} -> ${newState.status}`);
      // Handle all terminal states properly
      if (newState.status === "idle" || newState.status === "autopaused") {
        cleanupPlayer();
      }
    });

    audioPlayer.on("error", (error) => {
      logger.error(`Error in audio player:`, error);
      cleanupPlayer();
    });
    
    // Log connection state changes
    connection.on("stateChange", (oldState, newState) => {
      logger.info(`Voice connection state: ${oldState.status} -> ${newState.status}`);
    });
    
    connection.on("error", (error) => {
      logger.error(`Voice connection error:`, error);
    });
    
  } catch (error) {
    logger.error("Error in PlayResourceInVoiceChannel function:", error);
  }
}

/**
 * Play audio buffer in voice channel - for TTS responses
 */
export async function playInVoiceChannel(
  voiceChannel: VoiceChannel,
  audioBuffer: Buffer,
) {
  try {
    logger.info(`🎤 Playing TTS audio in voice channel: ${voiceChannel.name}`);
    
    // Create a readable stream from the buffer
    const stream = Readable.from(audioBuffer);
    
    // Create audio resource for Discord.js voice
    const resource = createAudioResource(stream, {
      inputType: StreamType.Arbitrary,
    });
    
    // Use the existing play function
    await PlayResourceInVoiceChannel(voiceChannel, resource);
    
  } catch (error) {
    logger.error("Error playing audio buffer in voice channel:", error);
    throw error;
  }
}
