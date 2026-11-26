import { CommandInteraction, Client, SlashCommandBuilder } from "discord.js";
import { Command } from "./command";
import { logger } from "../utils/logger";
import {
  createErrorResponse,
  createSuccessResponse,
} from "../utils/commandHelpers";
import { ActionService } from "../services/actionService";

export const Listen: Command = {
  data: new SlashCommandBuilder()
    .setName("listen")
    .setDescription("listens to a voice channel")
    .addIntegerOption((option) =>
      option
        .setName("time")
        .setDescription("How long to listen in minutes (default: 1)")
        .setMinValue(1)
        .setMaxValue(60)
        .setRequired(false),
    ),

  execute: async (client: Client, interaction: CommandInteraction) => {
    try {
      // Get duration from user input or use default (1 minute)
      const durationMinutes =
        (interaction.options.get("time")?.value as number) || 1;

      logger.info(
        `${interaction.user.username} requesting listen session: ${durationMinutes} minutes`,
      );

      // Use the action system
      const actionService = ActionService.getInstance();
      const result = await actionService.executeFromCommand(
        interaction,
        "listen_control",
        {
          action: "start",
          duration_minutes: durationMinutes,
        },
      );

      // Handle the result
      if (result.success) {
        await interaction.editReply(
          createSuccessResponse(
            result.responseText ||
              `Started listening for ${durationMinutes} minute${durationMinutes === 1 ? "" : "s"}`,
          ),
        );
      } else {
        await interaction.editReply(
          createErrorResponse(
            result.error ||
              "An error occurred while starting the listen session.",
          ),
        );
      }
    } catch (error) {
      logger.error("Error in listen command:", error);
      await interaction.editReply(
        createErrorResponse(
          "🚨 There was a disturbance in the Iris while trying to listen. Please try again.",
        ),
      );
    }
  },
};
