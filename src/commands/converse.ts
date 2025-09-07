import {
  CommandInteraction,
  Client,
  VoiceChannel,
  SlashCommandBuilder,
} from "discord.js";
import { Command } from "./command";
import { logger } from "../utils/logger";
import {
  validateVoiceChannel,
  createErrorResponse,
} from "../utils/commandHelpers";
import { playTTSInChannel } from "../utils/voiceHelpers";
import { ZenyattaAssistantService } from "../services/zenyattaAssistantService";

export const Converse: Command = {
  data: new SlashCommandBuilder()
    .setName("converse")
    .setDescription("💬 Have a natural conversation with Zenyatta")
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("What would you like to talk about?")
        .setRequired(true),
    ),

  execute: async (client: Client, interaction: CommandInteraction) => {
    try {
      const message = interaction.options?.get("message")?.value as string;

      if (!message) {
        return await interaction.editReply(
          createErrorResponse(
            "Please provide a message to start our conversation.",
          ),
        );
      }

      logger.info(
        `${interaction.user.username} starting conversation: "${message.substring(0, 50)}..."`,
      );

      // Get the Zenyatta assistant
      const zenyatta = ZenyattaAssistantService.getInstance();

      // Have a conversation with context awareness
      const response = await zenyatta.converse(interaction, message);

      // Handle voice response if user is in voice channel
      const voiceValidation = validateVoiceChannel(interaction);
      if (voiceValidation.isValid && response.shouldUseVoice) {
        const voiceChannel = voiceValidation.member!.voice
          .channel as VoiceChannel;

        try {
          const voiceText = response.voiceText || response.text;
          await playTTSInChannel(voiceChannel, voiceText);
          logger.info(
            `🧘 AI conversation delivered via TTS: "${voiceText.substring(0, 50)}..."`,
          );
        } catch (ttsError) {
          logger.error("TTS failed for AI conversation:", ttsError);
        }
      }

      // Send text response
      let displayText = response.text;

      // Add voice indicator and mood indicator
      const moodEmoji =
        {
          zen: "🧘",
          wise: "🎓",
          playful: "😊",
          mysterious: "🌙",
        }[response.mood] || "🧘";

      if (voiceValidation.isValid && response.shouldUseVoice) {
        displayText = `${moodEmoji} 🎵 *Also delivered in voice* • ${displayText}`;
      } else {
        displayText = `${moodEmoji} ${displayText}`;
      }

      await interaction.editReply({
        content: displayText,
      });

      logger.info(
        `AI conversation completed with ${interaction.user.username} (mood: ${response.mood})`,
      );
    } catch (error) {
      logger.error("Error in AI conversation command:", error);
      await interaction.editReply(
        createErrorResponse(
          "🚨 Our conversation path encountered some turbulence. Please try again, and we shall find our harmony.",
        ),
      );
    }
  },
};
