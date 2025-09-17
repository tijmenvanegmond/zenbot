import { SlashCommandBuilder, CommandInteraction, Client } from "discord.js";
import { Command } from "./command";
import { ActionService } from "../services/actionService";
import { logger } from "../utils/logger";

export const conferenceCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("conference")
    .setDescription("Convene multi-AI conference for complex questions")
    .addStringOption((option) =>
      option
        .setName("question")
        .setDescription("The complex question requiring multi-AI deliberation")
        .setRequired(true),
    )
    .addBooleanOption((option) =>
      option
        .setName("require_consensus")
        .setDescription(
          "Whether to require full consensus from all AI providers",
        )
        .setRequired(false),
    )
    .addIntegerOption((option) =>
      option
        .setName("debate_rounds")
        .setDescription("Number of debate rounds for refinement (1-10)")
        .setMinValue(1)
        .setMaxValue(10)
        .setRequired(false),
    )
    .addIntegerOption((option) =>
      option
        .setName("max_providers")
        .setDescription("Maximum number of AI providers to include (1-3)")
        .setMinValue(1)
        .setMaxValue(3)
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("provider_filter")
        .setDescription("Filter providers by capability")
        .setRequired(false)
        .addChoices(
          { name: "All providers", value: "all" },
          { name: "Reasoning focused", value: "reasoning" },
          { name: "Creative focused", value: "creative" },
          { name: "Fast responses", value: "fast" },
        ),
    ),

  execute: async (client: Client, interaction: CommandInteraction) => {
    try {
      const question = interaction.options.get("question")?.value as string;
      const requireConsensus =
        (interaction.options.get("require_consensus")?.value as boolean) ||
        false;
      const debateRounds =
        (interaction.options.get("debate_rounds")?.value as number) || 2;
      const maxProviders =
        (interaction.options.get("max_providers")?.value as number) || 3;
      const providerFilter =
        (interaction.options.get("provider_filter")?.value as string) || "all";

      logger.info(
        `🧠 Discord conference requested by ${interaction.user.username}: "${question.substring(0, 100)}..."`,
      );

      // Acknowledge the interaction immediately since conferences take time
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
      }

      const actionService = ActionService.getInstance();
      const result = await actionService.executeFromCommand(
        interaction,
        "conference",
        {
          question,
          require_consensus: requireConsensus,
          debate_rounds: debateRounds,
          max_providers: maxProviders,
          provider_filter: providerFilter,
        },
      );

      if (!result.success) {
        await interaction.editReply({
          content: `❌ **Conference Failed**\n\n${result.error || "Unknown error occurred"}`,
        });
        return;
      }

      // Format the response with rich information
      const data = result.data;
      const consensusPercentage = (data.consensusLevel * 100).toFixed(1);
      const duration = (data.totalDuration / 1000).toFixed(1);

      let responseEmbed = `🧠 **Multi-AI Conference**\n\n`;
      responseEmbed += `**Question:** ${question}\n\n`;
      responseEmbed += `**Response:**\n${data.response}\n\n`;
      responseEmbed += `**Conference Details:**\n`;
      responseEmbed += `• **Participants:** ${data.providers.join(", ")}\n`;
      responseEmbed += `• **Consensus Level:** ${consensusPercentage}%\n`;
      responseEmbed += `• **Consciousness Level:** ${data.consciousnessLevel}\n`;
      responseEmbed += `• **Duration:** ${duration}s\n`;
      responseEmbed += `• **Debate Rounds:** ${data.debateRounds}\n\n`;
      responseEmbed += `*${data.reasoning}*`;

      // Discord has a 2000 character limit, so truncate if necessary
      if (responseEmbed.length > 2000) {
        const truncateLength = 1900; // Leave room for truncation message
        responseEmbed =
          responseEmbed.substring(0, truncateLength) +
          "\n\n*[Response truncated - full details in logs]*";
      }

      await interaction.editReply({
        content: responseEmbed,
      });

      logger.info(
        `🎭 Discord conference completed for ${interaction.user.username} in ${duration}s with ${consensusPercentage}% consensus`,
      );
    } catch (error) {
      logger.error("🧠 Discord conference command failed:", error);

      try {
        if (interaction.deferred && !interaction.replied) {
          await interaction.editReply({
            content:
              "❌ **Digital Conference Disrupted**\n\nThe conference encountered an error. The digital minds are temporarily misaligned.",
          });
        } else if (!interaction.replied) {
          await interaction.reply({
            content:
              "❌ **Digital Conference Disrupted**\n\nThe conference encountered an error. The digital minds are temporarily misaligned.",
          });
        }
      } catch (followUpError) {
        logger.error("Failed to send error message:", followUpError);
      }
    }
  },
};
