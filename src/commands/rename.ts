import {
  Client,
  CommandInteraction,
  CommandInteractionOptionResolver,
  GuildMember,
  SlashCommandBuilder,
} from "discord.js";
import { Command } from "./command";
import { ActionService } from "../services/actionService";
import { logger } from "../utils/logger";
import { createErrorResponse } from "../utils/commandHelpers";

export const Rename: Command = {
  data: new SlashCommandBuilder()
    .setName("rename")
    .setDescription("Allows you to change the name of someone")
    .addMentionableOption((option) =>
      option
        .setName("user_to_rename")
        .setDescription("The user which name to change"),
    )
    .addStringOption((option) =>
      option
        .setName("new_nickname")
        .setDescription("The new name for said user"),
    ),

  execute: async (client: Client, interaction: CommandInteraction) => {
    try {
      let options = interaction.options as CommandInteractionOptionResolver;
      let member = options.getMember("user_to_rename") as GuildMember;
      const newNickname = options.getString("new_nickname");

      if (!member || !newNickname) {
        return await interaction.followUp(
          createErrorResponse("Please provide a valid user and nickname."),
        );
      }

      const actionService = ActionService.getInstance();

      // Execute the rename user action
      const result = await actionService.executeFromCommand(
        interaction,
        "rename_user",
        {
          user_id: member.id,
          new_nickname: newNickname,
        },
      );

      if (result.success) {
        await interaction.followUp({
          ephemeral: true,
          content: result.responseText,
        });
      } else {
        await interaction.followUp({
          ephemeral: true,
          content:
            result.responseText || result.error || "Failed to change nickname.",
        });
      }
    } catch (error) {
      logger.error("Error during rename command execution:", error);
      await interaction.followUp({
        ephemeral: true,
        content: "An error occurred while trying to change the nickname.",
      });
    }
  },
};
