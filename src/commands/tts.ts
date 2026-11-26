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
        .setName("profile")
        .setDescription("Voice profile to use")
        .setRequired(false)
        .addChoices(
          { name: "🧘 Zen (default)", value: "piper-zen" },
          { name: "🧘 Zen - calm", value: "piper-zen-calm" },
          { name: "🧘 Zen - wise", value: "piper-zen-wise" },
          { name: "🧘 Zen - playful", value: "piper-zen-playful" },
          { name: "🧘 Zen - intense", value: "piper-zen-intense" },
          { name: "System", value: "system-default" },
          // Piper TTS profiles - high-quality neural voices
          { name: "👨 Piper John (slow)", value: "piper-default" },
          { name: "👨 Piper John (normal)", value: "piper-john" },
          { name: "🤖 Piper Danny (robotic)", value: "piper-danny" },
          { name: "👩 Piper Lessac (female)", value: "piper-lessac" },
          { name: "👨 Piper Ryan (male)", value: "piper-ryan" },
          { name: "👩‍🦰 Piper Amy (soft)", value: "piper-amy" },
          { name: "👨‍💼 Piper Joe (deep)", value: "piper-joe" },
          { name: "⚡ Piper Energetic", value: "piper-energetic" },
          { name: "🧘 Piper Calm", value: "piper-calm" },
        ),
    )
    .addNumberOption((option) =>
      option
        .setName("speed")
        .setDescription("Speed multiplier (0.1 = very slow, 3.0 = very fast)")
        .setRequired(false)
        .setMinValue(0.1)
        .setMaxValue(3.0),
    )
    .addBooleanOption((option) =>
      option
        .setName("interrupt")
        .setDescription("Interrupt any currently playing audio")
        .setRequired(false),
    ),

  execute: async (client: Client, interaction: CommandInteraction) => {
    try {
      const text = interaction.options?.get("text")?.value as string;
      let profile = interaction.options?.get("profile")?.value as string;
      const speed = interaction.options?.get("speed")?.value as number;
      const interrupt =
        (interaction.options?.get("interrupt")?.value as boolean) || false;

      // If speed is specified, append it to the profile
      if (speed) {
        const baseProfile = profile || "piper-zen";
        profile = `${baseProfile}:speed=${speed}`;
        logger.info(
          `${interaction.user.username} requesting TTS with custom speed: "${text.substring(0, 50)}..." (profile: ${baseProfile}, speed: ${speed})`,
        );
      } else {
        logger.info(
          `${interaction.user.username} requesting TTS: "${text.substring(0, 50)}..." (profile: ${profile || "default"})`,
        );
      }

      // Use the unified voice system
      const actionService = ActionService.getInstance();
      const result = await actionService.executeFromCommand(
        interaction,
        "speak",
        {
          text,
          profile: profile || undefined, // Let ProfileManager handle default
          interrupt,
          activity_type: "tts",
        },
      );

      // Handle the result
      if (result.success) {
        const profileText = profile || "default";
        await interaction.editReply(
          createSuccessResponse(
            `🎵 Speech delivered successfully with ${profileText} voice profile`,
          ),
        );
      } else {
        await interaction.editReply(
          createErrorResponse(
            result.error || "An error occurred while trying to speak.",
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
