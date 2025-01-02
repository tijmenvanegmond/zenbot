import {
  CommandInteraction,
  Client,
  GuildMember,
  VoiceChannel,
  SlashCommandBuilder,
  CommandInteractionOptionResolver,
} from "discord.js";
import { Command } from "./command";
import { StreamType, createAudioPlayer, createAudioResource, joinVoiceChannel } from '@discordjs/voice';
import { turnTextIntoSpeechBuffer } from "../voice/tts";


export const TTS: Command = {
  data: new SlashCommandBuilder()
    .setName("tts")
    .setDescription("just TTS")
    .addStringOption((option) =>
      option.setName("tts_text").setDescription("The text to TTS")
    ),

  execute: async (client: Client, interaction: CommandInteraction) => {
    const member = interaction?.member as GuildMember;

    if (!member?.voice?.channelId) {
      console.log("reply-ing in text");
      return await interaction.followUp({
        content: "You have to be in voice to use this",
        ephemeral: true,
      });
    }

    let options = interaction.options as CommandInteractionOptionResolver;
    let text = options.getString("tts_text") || "no text provided";

        await turnTextIntoSpeechBuffer(text);
        console.log("Joining voice-channel to tts");

        PlayVoiceLine(member.voice.channel as VoiceChannel, );

    await interaction.followUp({
      ephemeral: true,
      content: `Attempting to TTS in Voice Channel ${member.voice.channel?.name}`,
    });
  },
};

async function PlayVoiceLine(voiceChannel: VoiceChannel, __dirname = "./output.opus") {
    const resource = createAudioResource(__dirname, {
        inputType: StreamType.Opus,
    });

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guildId,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
  });

  const audioPlayer = createAudioPlayer();
  const subscription = connection.subscribe(audioPlayer);

    audioPlayer.play(resource);

    audioPlayer.on('stateChange', (oldState, newState) => {
        console.log(`Audio player transitioned from ${oldState.status} to ${newState.status}`);
        if (newState.status === 'idle') {
            if(subscription)
                subscription.unsubscribe();
            connection.disconnect()
            connection.destroy()
            console.log(`Zenbot left voice channel`);
        };
    });

}
