import {
  CommandInteraction,
  Client,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import { Command } from "./command";
import { ActionService } from "../services/actionService";
import { logger } from "../utils/logger";
import {
  getInteractionOptions,
  createErrorResponse,
} from "../utils/commandHelpers";

export const Quote: Command = {
  data: new SlashCommandBuilder()
    .setName("quote")
    .setDescription(
      "Reads a random quote from the quotes channel with intelligent parsing",
    )
    .addChannelOption((option) =>
      option
        .setName("quote_channel")
        .setDescription(
          "The channel to pull quotes from (defaults to quotes channel)",
        )
        .setRequired(false),
    )
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Filter quotes from or about a specific user")
        .setRequired(false),
    ),
  execute: async (client: Client, interaction: CommandInteraction) => {
    try {
      const options = getInteractionOptions(interaction);
      const quoteChannel = options.getChannel("quote_channel") as TextChannel;
      const targetUser = options.getUser("user");

      const actionService = ActionService.getInstance();

      // Execute the channel quote action
      const result = await actionService.executeFromCommand(
        interaction,
        "read_channel_quote",
        {
          channel_id: quoteChannel?.id,
          user_id: targetUser?.id,
          username: targetUser?.username,
          use_voice: true,
        },
      );

      if (result.success) {
        await interaction.followUp({
          ephemeral: true,
          content: result.responseText,
        });
      } else {
        await interaction.followUp(
          createErrorResponse(
            result.responseText ||
              result.error ||
              "An error occurred while retrieving the quote.",
          ),
        );
      }
    } catch (error) {
      logger.error("Error during quote command execution:", error);
      await interaction.followUp(
        createErrorResponse(
          "An error occurred while trying to play the quote.",
        ),
      );
    }
  },
};
