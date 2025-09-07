import { CommandInteraction, Client, SlashCommandBuilder } from "discord.js";
import { Command } from "./command";
import { VoiceService } from "../services/voiceService";
import { logger } from "../utils/logger";
import { ConversationService } from "../services/conversationService";

export const AdviceContextual: Command = {
  data: new SlashCommandBuilder()
    .setName("advice-contextual")
    .setDescription(
      "🧘 Seek wisdom with conversation memory and context awareness",
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
    )
    .addStringOption((option) =>
      option
        .setName("topic")
        .setDescription("What specific topic do you need guidance on?")
        .setRequired(false),
    ),

  execute: async (client: Client, interaction: CommandInteraction) => {
    // deferReply is already called by the interaction handler

    try {
      const adviceType =
        (interaction.options?.get("type")?.value as string) || "philosophical";
      const topic = (interaction.options?.get("topic")?.value as string) || "";

      logger.info(
        `${interaction.user.username} seeking contextual advice: type=${adviceType}, topic="${topic}"`,
      );

      // Get base voice line (existing logic)
      let voiceLine;
      if (adviceType === "random") {
        const categories = [
          "philosophical",
          "greeting",
          "harmony",
          "discord",
          "transcendence",
        ] as const;
        const randomCategory =
          categories[Math.floor(Math.random() * categories.length)];
        voiceLine = VoiceService.getContextualAdvice(randomCategory);
      } else {
        voiceLine = VoiceService.getContextualAdvice(adviceType as any);
      }

      // Build user input for context
      const userInput = topic
        ? `${adviceType} advice about ${topic}`
        : `${adviceType} advice`;

      // Use conversation service for contextual response
      await ConversationService.respondContextually(
        interaction,
        "advice-contextual",
        userInput,
        voiceLine.text, // Use existing voice line as base, but AI can enhance
      );

      logger.info(
        `Contextual advice delivered to ${interaction.user.username}`,
      );
    } catch (error) {
      logger.error("Error in contextual advice command:", error);
      await interaction.editReply({
        content:
          "🚨 The path to contextual wisdom encountered a disturbance. Please try again.",
      });
    }
  },
};
