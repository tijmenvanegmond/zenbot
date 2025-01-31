import { VoiceChannel } from "discord.js";
import {
  AudioPlayer,
  AudioResource,
  createAudioPlayer,
  joinVoiceChannel,
  VoiceConnection,
} from "@discordjs/voice";

export default async function PlayResourceInVoiceChannel(
  voiceChannel: VoiceChannel,
  resource: AudioResource
) {
  try {
    const connection: VoiceConnection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guildId,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });

    const audioPlayer: AudioPlayer = createAudioPlayer();

    audioPlayer.play(resource);
    const subscription = connection.subscribe(audioPlayer);

    audioPlayer.on("stateChange", (oldState, newState) => {
      console.log(
        `Audio player transitioned from ${oldState.status} to ${newState.status}`
      );
      console.log("Audio player is autopaused, attempting to unpause...");
      if (newState.status === "autopaused") {
        setTimeout(() => {
            console.log("Unpausing audio player...");
          audioPlayer.unpause();
        }, 1000); // Add a 1-second delay before unpausing
      }
      if (newState.status === "idle") {
        if (subscription) subscription.unsubscribe();
        connection.disconnect();
        connection.destroy();
        console.log(`Zenbot left voice channel`);
      }
    });

    audioPlayer.on("error", (error) => {
      console.error("Error in audio player:", error);
      if (subscription) subscription.unsubscribe();
      connection.disconnect();
      connection.destroy();
    });
  } catch (error) {
    console.error("Error in PlayResourceInVoiceChannel function:", error);
  }
}
