import { CommandInteraction, Client, SlashCommandBuilder } from "discord.js";
import { Command } from "./command";
import { logger } from "../utils/logger";
import {
  createErrorResponse,
  createSuccessResponse,
} from "../utils/commandHelpers";
import { ActionService } from "../services/actionService";

export const Advice: Command = {
  data: new SlashCommandBuilder()
    .setName("advice")
    .setDescription(
      "Zen has an answer for everything (make sure you are in a voice channel)",
    )
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("Choose the type of wisdom you seek")
        .setRequired(false)
        .addChoices(
          { name: "🧘 Philosophical Wisdom", value: "philosophical" },
          { name: "🙏 Greeting & Peace", value: "greeting" },
          { name: "💚 Harmony & Healing", value: "harmony" },
          { name: "⚡ Discord & Challenge", value: "discord" },
          { name: "✨ Transcendence & Ultimate Truth", value: "transcendence" },
          { name: "🎲 Random Wisdom", value: "random" },
        ),
    ),

  execute: async (client: Client, interaction: CommandInteraction) => {
    try {
      const adviceType =
        (interaction.options?.get("type")?.value as string) || "philosophical";

      logger.info(
        `${interaction.user.username} requesting advice: type=${adviceType}`,
      );

      // Use the action system
      const actionService = ActionService.getInstance();
      const result = await actionService.executeFromCommand(
        interaction,
        "get_advice",
        {
          advice_type: adviceType,
          urgency: "medium",
          use_voice: true, // Always attempt voice if user is in voice channel
        },
      );

      // Handle the result
      if (result.success) {
        const responseMessage =
          result.data?.source === "ai"
            ? `🧘 **Zenyatta's AI Wisdom:** ${result.responseText}`
            : `🧘 **Zenyatta's Wisdom:** ${result.responseText}`;

        await interaction.editReply(createSuccessResponse(responseMessage));
      } else {
        await interaction.editReply(
          createErrorResponse(
            result.error || "An error occurred while seeking wisdom.",
          ),
        );
      }
    } catch (error) {
      logger.error("Error in advice command:", error);
      await interaction.editReply(
        createErrorResponse(
          "🚨 The path to wisdom encountered a disturbance. Please try again.",
        ),
      );
    }
  },
};
