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

export const TTS: Command = {
  data: new SlashCommandBuilder()
    .setName("tts")
    .setDescription("just TTS")
    .addStringOption((option) =>
      option.setName("tts_text").setDescription("The text to TTS"),
    ),

  execute: async (client: Client, interaction: CommandInteraction) => {
    const validation = validateVoiceChannel(interaction);
    if (!validation.isValid) {
      return await interaction.followUp(validation.response!);
    }

    const options = getInteractionOptions(interaction);
    const text = options.getString("tts_text") || "no text provided";
    const voiceChannel = validation.member!.voice.channel as VoiceChannel;

    try {
      await playTTSInChannel(voiceChannel, text);
      
      await interaction.followUp(
        createSuccessResponse(`TTS delivered in voice channel ${voiceChannel.name}`)
      );
    } catch (error) {
      logger.error("Error during TTS execution:", error);
      await interaction.followUp(
        createErrorResponse("An error occurred while trying to perform TTS.")
      );
    }
  },
};
