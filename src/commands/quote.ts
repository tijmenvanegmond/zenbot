import {
  CommandInteraction,
  Client,
  GuildMember,
  VoiceChannel,
  SlashCommandBuilder,
  TextChannel,
  CommandInteractionOptionResolver,
} from "discord.js";
import { Command } from "./command";
import { StreamType, createAudioResource } from "@discordjs/voice";
import { turnTextIntoSpeechBuffer } from "../voice/tts";
import PlayResourceInVoiceChannel from "../voice/playInVoiceChannel";
import path from "node:path";

export const Quote: Command = {
  data: new SlashCommandBuilder()
    .setName("quote")
    .setDescription("Reads a random quote from the quote channel")
    .addChannelOption((option) =>
      option
        .setName("quote_channel")
        .setDescription("The channel to pull quotes from")
        .setRequired(true)
    ),
  execute: async (client: Client, interaction: CommandInteraction) => {
    const member = interaction?.member as GuildMember;
    if (!member?.voice?.channelId) {
      return await interaction.followUp({
        content: "You have to be in voice to use this",
        ephemeral: true,
      });
    }

    const options = interaction.options as CommandInteractionOptionResolver;
    const quoteChannel = options.getChannel("quote_channel") as TextChannel;
    
    if (!quoteChannel || quoteChannel.type !== 0) { // 0 is GUILD_TEXT
      return await interaction.followUp({
        content: "Please provide a valid text channel",
        ephemeral: true,
      });
    }

    try {
      // Fetch last 100 messages from the quote channel
      const messages = await quoteChannel.messages.fetch({ limit: 100 });
      if (messages.size === 0) {
        return await interaction.followUp({
          content: "No messages found in the quote channel",
          ephemeral: true,
        });
      }

      // Select a random message
      const randomIndex = Math.floor(Math.random() * messages.size);
      const randomMessage = Array.from(messages.values())[randomIndex];
      
      // Convert the quote to speech
      await turnTextIntoSpeechBuffer(randomMessage.content);
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
        content: `Playing quote: "${randomMessage.content}" in Voice Channel ${member.voice.channel?.name}`,
      });
    } catch (error) {
      console.error("Error during quote command execution:", error);
      await interaction.followUp({
        ephemeral: true,
        content: "An error occurred while trying to play the quote.",
      });
    }
  },
};