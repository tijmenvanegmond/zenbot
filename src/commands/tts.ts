import { Client, CommandInteraction, SlashCommandBuilder } from "discord.js";
import { Command } from "./command";
import { logger } from "../utils/logger";
import {
  createErrorResponse,
  createSuccessResponse,
} from "../utils/commandHelpers";
import { ActionService } from "../services/actionService";

export const TTS: Command = {
  data: new SlashCommandBuilder()
    .setName("tts")
    .setDescription("🎵 Advanced text-to-speech with Zenyatta's wisdom")
    .addStringOption((option) =>
      option
        .setName("text")
        .setDescription("The text to speak")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("style")
        .setDescription("Voice style for delivery")
        .setRequired(false)
        .addChoices(
          { name: "Normal", value: "normal" },
          { name: "Wisdom", value: "wisdom" },
          { name: "Meditation", value: "meditation" },
          { name: "Encouragement", value: "encouragement" },
        ),
    ),

  execute: async (client: Client, interaction: CommandInteraction) => {
    try {
      const text = interaction.options?.get("text")?.value as string;
      const style =
        (interaction.options?.get("style")?.value as string) || "normal";

      logger.info(
        `${interaction.user.username} requesting TTS: "${text.substring(0, 50)}..." (style: ${style})`,
      );

      // Use the action system
      const actionService = ActionService.getInstance();
      const result = await actionService.executeFromCommand(
        interaction,
        "enhanced_tts",
        {
          text,
          voice_style: style,
          interrupt_existing: false,
        },
      );

      // Handle the result
      if (result.success) {
        await interaction.editReply(
          createSuccessResponse(
            `🎵 TTS delivered successfully in voice channel with ${style} style`,
          ),
        );
      } else {
        await interaction.editReply(
          createErrorResponse(
            result.error || "An error occurred while trying to perform TTS.",
          ),
        );
      }
    } catch (error) {
      logger.error("Error in TTS command:", error);
      await interaction.editReply(
        createErrorResponse(
          "🚨 The path to vocal expression encountered a disturbance. Please try again.",
        ),
      );
    }
  },
};
