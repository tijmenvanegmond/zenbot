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
          { name: "🎭 Sardonic (default)", value: "zenbot-sardonic" },
          { name: "Default", value: "zenbot-default" },
          { name: "Wise", value: "zenbot-wise" },
          { name: "Excited", value: "zenbot-excited" },
          { name: "Calm", value: "zenbot-calm" },
          { name: "🧠 Deep Philosopher", value: "zenbot-deep" },
          { name: "📢 Crisp & Clear", value: "zenbot-crisp" },
          { name: "📻 Smooth Radio", value: "zenbot-smooth" },
          { name: "🎪 Mysterious", value: "zenbot-mysterious" },
          { name: "⚡ Energetic", value: "zenbot-energetic" },
          { name: "👔 Professional", value: "zenbot-professional" },
          { name: "🎙️ ElevenLabs Rachel", value: "elevenlabs-rachel" },
          { name: "🎙️ ElevenLabs Adam", value: "elevenlabs-adam" },
          { name: "🎙️ ElevenLabs Antoni", value: "elevenlabs-antoni" },
          { name: "🎙️ ElevenLabs Arnold", value: "elevenlabs-arnold" },
          { name: "🎙️ ElevenLabs Domi", value: "elevenlabs-domi" },
          { name: "🤖 ElevenLabs Rocco Robot", value: "elevenlabs-rocco" },
          { name: "OpenAI", value: "openai-default" },
          { name: "System", value: "system-default" },
        ),
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
      const profile = interaction.options?.get("profile")?.value as string;
      const interrupt =
        (interaction.options?.get("interrupt")?.value as boolean) || false;

      logger.info(
        `${interaction.user.username} requesting TTS: "${text.substring(0, 50)}..." (profile: ${profile || "default"})`,
      );

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
