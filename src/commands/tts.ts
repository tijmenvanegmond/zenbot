import {
  Client,
  CommandInteraction,
  SlashCommandBuilder,
  VoiceChannel,
} from "discord.js";
import { Command } from "./command";
import { logger } from "../utils/logger";
import { validateVoiceChannel, getInteractionOptions, createErrorResponse, createSuccessResponse } from "../utils/commandHelpers";
import { playTTSInChannel } from "../utils/voiceHelpers";
import { Zenbot } from "src/domain/session/Zenbot";

export const TTS: Command = {
  data: new SlashCommandBuilder()
    .setName("tts")
    .setDescription("just TTS")
    .addStringOption((option) =>
      option.setName("tts_text").setDescription("The text to TTS"),
    ),

  execute: async (client: Client, zenbot: Zenbot, interaction: CommandInteraction) => {
    const validation = validateVoiceChannel(interaction);
    if (!validation.isValid) {
      return await interaction.followUp(validation.response!);
    }

    const options = getInteractionOptions(interaction);
    const text = options.getString("tts_text") || "Experience tranquility";

    try {
      // Get Zenbot AI session for this user
      const session = zenbot.getSession(interaction.user);

      logger.info(`${interaction.user.username} requesting TTS: "${text}"`);

      // Execute command through unified session system
      const response = await session.executeCommand(
        'tts', 
        { text }, 
        interaction
      );
      
      // TTS action is handled automatically, just confirm
      await interaction.followUp(
        createSuccessResponse(`🧘 "${text}" - spoken with tranquility`)
      );
      
    } catch (error) {
      logger.error("Error during TTS execution:", error);
      await interaction.followUp(
        createErrorResponse("An error occurred while trying to perform TTS.")
      );
    }
  },
};
