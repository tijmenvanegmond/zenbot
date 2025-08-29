import { VoiceChannel } from "discord.js";
import {
  AudioPlayer,
  AudioResource,
  createAudioPlayer,
  joinVoiceChannel,
  VoiceConnection,
} from "@discordjs/voice";
import { logger } from "../utils/logger";

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

    audioPlayer.on("stateChange", (oldState, newState) => {
      logger.info(`Audio player state changed: ${oldState.status} -> ${newState.status}`);
      if (newState.status === "idle") {
        if (subscription) subscription.unsubscribe();
        connection.disconnect();
        connection.destroy();
        logger.info(`Zenbot left voice channel`);
      }
    });

    audioPlayer.on("error", (error) => {
      logger.error(`Error in audio player:`, error);
      if (subscription) subscription.unsubscribe();
      connection.disconnect();
      connection.destroy();
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
