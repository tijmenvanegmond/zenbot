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
  createAudioResource,
} from "@discordjs/voice";
import { turnTextIntoSpeechBuffer } from "../voice/tts";
import { getInsult, getPraise } from "../voice/remark";
import PlayResourceInVoiceChannel from "../voice/playInVoiceChannel";
import path from "node:path";

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

    const outputFilePath = "./output.opus";
    const filepath = path.resolve(outputFilePath);
    await turnTextIntoSpeechBuffer(text, filepath);
    const resource = createAudioResource(filepath, {
      inputType: StreamType.Opus,
    });

    await PlayResourceInVoiceChannel(member.voice.channel as VoiceChannel, resource);

    await interaction.followUp({
      ephemeral: true,
      content: text,
    });
  },
};

