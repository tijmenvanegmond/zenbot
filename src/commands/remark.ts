import { CommandInteraction, Client, SlashCommandBuilder } from "discord.js";
import { Command } from "./command";
import { ActionService } from "../services/actionService";
import { logger } from "../utils/logger";
import {
  getInteractionOptions,
  createErrorResponse,
} from "../utils/commandHelpers";

export const Remark: Command = {
  data: new SlashCommandBuilder()
    .setName("remark")
    .setDescription("Generate a positive or negative remark about someone")
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("Type of remark")
        .setRequired(true)
        .addChoices(
          { name: "😊 Positive", value: "positive" },
          { name: "😈 Negative", value: "negative" },
        ),
    )
    .addUserOption((option) =>
      option
        .setName("subject")
        .setDescription("Who is the subject of the remark?")
        .setRequired(false),
    ),

  execute: async (client: Client, interaction: CommandInteraction) => {
    try {
      const options = getInteractionOptions(interaction);
      const remarkType = options.getString("type");
      const targetUser = options.getUser("subject");

      if (!remarkType) {
        return await interaction.followUp(
          createErrorResponse(
            "Please specify a remark type (positive or negative).",
          ),
        );
      }

      const actionService = ActionService.getInstance();

      // Execute the generate remark action
      const result = await actionService.executeFromCommand(
        interaction,
        "generate_remark",
        {
          type: remarkType,
          subject_username: targetUser?.username,
          subject_user_id: targetUser?.id,
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
              "An error occurred while generating the remark.",
          ),
        );
      }
    } catch (error) {
      logger.error("Error during remark command execution:", error);
      await interaction.followUp(
        createErrorResponse("An error occurred while delivering the remark."),
      );
    }
  },
};
