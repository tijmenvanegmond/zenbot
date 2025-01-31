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
import PlayResourceInVoiceChannel from "../voice/playInVoiceChannel";
import path from "node:path";

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

    try {
      await turnTextIntoSpeechBuffer(text);

      const outputFilePath = "./output.opus";
      const filepath = path.resolve(outputFilePath);
      const resource = createAudioResource(filepath, {
        inputType: StreamType.Opus,
      });

      await PlayResourceInVoiceChannel(
        member.voice.channel as VoiceChannel,
        resource
      );

      await interaction.followUp({
        ephemeral: true,
        content: `Attempting to TTS in Voice Channel ${member.voice.channel?.name}`,
      });
    } catch (error) {
      console.error("Error during TTS execution:", error);
      await interaction.followUp({
        ephemeral: true,
        content: "An error occurred while trying to perform TTS.",
      });
    }
  },
};
