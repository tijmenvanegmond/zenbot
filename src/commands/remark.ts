import {
  CommandInteraction,
  Client,
  GuildMember,
  VoiceChannel,
  SlashCommandBuilder,
  CommandInteractionOptionResolver,
} from "discord.js";
import { Command } from "./command";
import {
  StreamType,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
} from "@discordjs/voice";
import { turnTextIntoSpeechBuffer } from "../voice/tts";
import { getInsult, getPraise } from "../voice/remark";

export const Remark: Command = {
  data: new SlashCommandBuilder()
    .setName("remark")
    .setDescription("A positive or Negative remark")
    .addBooleanOption((option) =>
      option.setName("positive").setDescription("Is the remark positive?")
    )
    .addUserOption((option) =>
      option.setName("subject").setDescription("Who is the subject of the remark?")
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
    let text = "";
    if (options.getBoolean("positive")) {
      text = await getPraise(options.getUser("subject")?.username);
    } else {
      text = await getInsult(options.getUser("subject")?.username);
    }

    await turnTextIntoSpeechBuffer(text);
    console.log("Joining voice-channel to tts");

    PlayVoiceLine(member.voice.channel as VoiceChannel);
    
    await interaction.followUp({
      ephemeral: true,
      content: text,
    });
  },
};

async function PlayVoiceLine(voiceChannel: VoiceChannel,  __dirname = "./output.opus") {
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

  audioPlayer.on("stateChange", (oldState, newState) => {
    console.log(
      `Audio player transitioned from ${oldState.status} to ${newState.status}`
    );
    if (newState.status === "idle") {
      if (subscription) subscription.unsubscribe();
      connection.disconnect();
      connection.destroy();
      console.log(`Zenbot left voice channel`);
    }
  });
}
