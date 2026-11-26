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
      "� Get blunt, spicy guidance from Zenbot (conversation-aware)",
    )
    .addStringOption((option) =>
      option
        .setName("topic")
        .setDescription("What do you need guidance on?")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("urgency")
        .setDescription("How urgent is your need for guidance?")
        .setRequired(false)
        .addChoices(
          { name: "🧘 Low - General wisdom", value: "low" },
          { name: "🙏 Medium - Seeking clarity", value: "medium" },
          { name: "⚡ High - Need immediate guidance", value: "high" },
        ),
    ),

  execute: async (client: Client, interaction: CommandInteraction) => {
    try {
      const topic = interaction.options?.get("topic")?.value as string;
      const urgency =
        (interaction.options?.get("urgency")?.value as
          | "low"
          | "medium"
          | "high") || "medium";

      logger.info(
        `${interaction.user.username} requesting Zenbot advice: topic="${topic}", urgency=${urgency}`,
      );

      // Use the action system for proper architecture flow
      const actionService = ActionService.getInstance();
      const result = await actionService.executeFromCommand(
        interaction,
        "get_advice",
        {
          topic,
          urgency,
          advice_type: "ai_contextual", // Use AI-powered advice
          use_voice: true, // Always attempt voice if user is in voice channel
        },
      );

      // Handle the result
      if (result.success) {
        const responseMessage =
          result.data?.source === "ai"
            ? `� **Zenbot (AI):** ${result.responseText}`
            : `� **Zenbot:** ${result.responseText}`;

        await interaction.editReply(createSuccessResponse(responseMessage));
      } else {
        await interaction.editReply(
          createErrorResponse(
            result.error || "Zenbot refused to elaborate. Try again.",
          ),
        );
      }
    } catch (error) {
      logger.error("Error in advice command:", error);
      await interaction.editReply(
        createErrorResponse(
          "⚠️ Zenbot experienced a brain cramp. Ask again in a moment.",
        ),
      );
    }
  },
};
