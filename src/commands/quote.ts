import {
  CommandInteraction,
  Client,
  VoiceChannel,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import { Command } from "./command";
import { logger } from "../utils/logger";
import { validateVoiceChannel, getInteractionOptions, createErrorResponse } from "../utils/commandHelpers";
import { playTTSInChannel } from "../utils/voiceHelpers";
import { getRandomQuote } from "../services/quoteService";
import { CHANNEL_TYPES, QUOTE_CHANNEL_NAMES } from "../config";

export const Quote: Command = {
  data: new SlashCommandBuilder()
    .setName("quote")
    .setDescription("Reads a random quote from the quotes channel with intelligent parsing")
    .addChannelOption((option) =>
      option
        .setName("quote_channel")
        .setDescription("The channel to pull quotes from (defaults to quotes channel)")
        .setRequired(false)
    )
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Filter quotes from or about a specific user")
        .setRequired(false)
    ),
  execute: async (client: Client, interaction: CommandInteraction) => {
    const validation = validateVoiceChannel(interaction);
    if (!validation.isValid) {
      return await interaction.followUp(validation.response!);
    }

    const options = getInteractionOptions(interaction);
    let quoteChannel = options.getChannel("quote_channel") as TextChannel;
    const targetUser = options.getUser("user");
    
    // If no channel specified, try to find the default quotes channel
    if (!quoteChannel) {
      const guild = interaction.guild!;
      // Look for common quote channel names
      for (const name of QUOTE_CHANNEL_NAMES) {
        const foundChannel = guild.channels.cache.find(
          channel => channel.name.toLowerCase().includes(name.toLowerCase()) && channel.type === CHANNEL_TYPES.GUILD_TEXT
        );
        if (foundChannel) {
          quoteChannel = foundChannel as TextChannel;
          break;
        }
      }
      
      if (!quoteChannel) {
        return await interaction.followUp(
          createErrorResponse("No quotes channel found. Please specify a channel or create a channel with 'quotes' in the name.")
        );
      }
    } else if (quoteChannel.type !== CHANNEL_TYPES.GUILD_TEXT) {
      return await interaction.followUp(
        createErrorResponse("Please provide a valid text channel")
      );
    }

    const voiceChannel = validation.member!.voice.channel as VoiceChannel;

    try {
      // Use enhanced quote parsing logic
      const randomQuote = await getRandomQuote(quoteChannel, {
        userId: targetUser?.id,
        username: targetUser?.username,
      });

      if (!randomQuote) {
        const userFilter = targetUser ? ` from or about ${targetUser.username}` : "";
        return await interaction.followUp(
          createErrorResponse(`No quotes found${userFilter} in the quote channel`)
        );
      }

      // Play the parsed quote (just the quote part if it's a structured quote)
      const textToPlay = randomQuote.isQuoted ? randomQuote.parsedQuote : randomQuote.content;
      await playTTSInChannel(voiceChannel, textToPlay);

      // Create enhanced response with quote intelligence
      let responseContent = `💬 **Quote from #${quoteChannel.name}:** `;
      if (randomQuote.isQuoted && randomQuote.speaker) {
        responseContent += `${randomQuote.speaker} said: "${randomQuote.parsedQuote}"`;
        if (randomQuote.poster.username !== randomQuote.speaker) {
          responseContent += ` (shared by ${randomQuote.poster.displayName})`;
        }
      } else {
        responseContent += `"${randomQuote.content}" (by ${randomQuote.poster.displayName})`;
      }

      await interaction.followUp({
        ephemeral: true,
        content: responseContent,
      });
    } catch (error) {
      logger.error("Error during quote command execution:", error);
      await interaction.followUp(
        createErrorResponse("An error occurred while trying to play the quote.")
      );
    }
  },
};