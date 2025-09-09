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
import { UnifiedZenyattaService } from "../services/unifiedZenyattaService";

export const AdviceAssistant: Command = {
  data: new SlashCommandBuilder()
    .setName("advice-ai")
    .setDescription(
      "🧘 Seek wisdom from Zenyatta with persistent conversation memory",
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
    // deferReply is already called by the interaction handler

    try {
      const topic = interaction.options?.get("topic")?.value as string;
      const urgency =
        (interaction.options?.get("urgency")?.value as
          | "low"
          | "medium"
          | "high") || "medium";

      logger.info(
        `${interaction.user.username} seeking AI assistant advice: topic="${topic}", urgency=${urgency}`,
      );

      // Get the Zenyatta assistant
      const zenyatta = UnifiedZenyattaService.getInstance();

      // Get advice with conversation context
      const response = await zenyatta.getAdvice(interaction, topic, urgency);

      // Handle voice response if user is in voice channel
      const voiceValidation = validateVoiceChannel(interaction);
      if (voiceValidation.isValid && response.shouldUseVoice) {
        const voiceChannel = voiceValidation.member!.voice
          .channel as VoiceChannel;

        try {
          const voiceText = response.voiceText || response.text;
          await playTTSInChannel(voiceChannel, voiceText);
          logger.info(
            `🧘 AI assistant advice delivered via TTS: "${voiceText.substring(0, 50)}..."`,
          );
        } catch (ttsError) {
          logger.error("TTS failed for AI assistant advice:", ttsError);
        }
      }

      // Send text response (always, for accessibility)
      let displayText = response.text;

      // Add voice indicator if TTS was played
      if (voiceValidation.isValid && response.shouldUseVoice) {
        displayText = `🎵 *Also delivered in voice* • ${displayText}`;
      }

      await interaction.editReply({
        content: displayText,
      });

      logger.info(
        `AI assistant advice delivered to ${interaction.user.username} (mood: ${response.mood})`,
      );
    } catch (error) {
      logger.error("Error in AI assistant advice command:", error);
      await interaction.editReply(
        createErrorResponse(
          "🚨 I am experiencing discord in my AI consciousness. Let us find harmony together in a moment.",
        ),
      );
    }
  },
};
