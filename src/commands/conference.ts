import { SlashCommandBuilder, CommandInteraction, Client } from "discord.js";
import { Command } from "./command";
import { ActionService } from "../services/actionService";
import { logger } from "../utils/logger";

export const conferenceCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("conference")
    .setDescription(
      "Multi-personality conference with Zenbot selection and transcripts",
    )
    .addStringOption((option) =>
      option
        .setName("question")
        .setDescription("The topic or question for the conference")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("personality1")
        .setDescription("First Zenbot personality")
        .setRequired(false)
        .addChoices(
          { name: "Default Zenbot", value: "zenbot-default" },
          { name: "Philosopher", value: "zenbot-philosopher" },
          { name: "Critic", value: "zenbot-critic" },
          { name: "Optimist", value: "zenbot-optimist" },
          { name: "Pessimist", value: "zenbot-pessimist" },
          { name: "Chaos", value: "zenbot-chaos" },
          { name: "Wise", value: "zenbot-wise" },
        ),
    )
    .addStringOption((option) =>
      option
        .setName("personality2")
        .setDescription("Second Zenbot personality (optional)")
        .setRequired(false)
        .addChoices(
          { name: "Default Zenbot", value: "zenbot-default" },
          { name: "Philosopher", value: "zenbot-philosopher" },
          { name: "Critic", value: "zenbot-critic" },
          { name: "Optimist", value: "zenbot-optimist" },
          { name: "Pessimist", value: "zenbot-pessimist" },
          { name: "Chaos", value: "zenbot-chaos" },
          { name: "Wise", value: "zenbot-wise" },
        ),
    )
    .addStringOption((option) =>
      option
        .setName("personality3")
        .setDescription("Third Zenbot personality (optional)")
        .setRequired(false)
        .addChoices(
          { name: "Default Zenbot", value: "zenbot-default" },
          { name: "Philosopher", value: "zenbot-philosopher" },
          { name: "Critic", value: "zenbot-critic" },
          { name: "Optimist", value: "zenbot-optimist" },
          { name: "Pessimist", value: "zenbot-pessimist" },
          { name: "Chaos", value: "zenbot-chaos" },
          { name: "Wise", value: "zenbot-wise" },
        ),
    )
    .addStringOption((option) =>
      option
        .setName("personality4")
        .setDescription("Fourth Zenbot personality (optional)")
        .setRequired(false)
        .addChoices(
          { name: "Default Zenbot", value: "zenbot-default" },
          { name: "Philosopher", value: "zenbot-philosopher" },
          { name: "Critic", value: "zenbot-critic" },
          { name: "Optimist", value: "zenbot-optimist" },
          { name: "Pessimist", value: "zenbot-pessimist" },
          { name: "Chaos", value: "zenbot-chaos" },
          { name: "Wise", value: "zenbot-wise" },
        ),
    )
    .addStringOption((option) =>
      option
        .setName("preset")
        .setDescription(
          "Quick personality presets (overrides individual selections)",
        )
        .setRequired(false)
        .addChoices(
          { name: "Philosophical Debate", value: "philosopher,critic" },
          { name: "Optimist vs Pessimist", value: "optimist,pessimist" },
          {
            name: "All Perspectives",
            value: "default,philosopher,critic,optimist",
          },
          { name: "Chaos Theory", value: "chaos,critic,wise" },
          {
            name: "Full Council",
            value: "default,philosopher,critic,optimist,pessimist",
          },
        ),
    )
    .addIntegerOption((option) =>
      option
        .setName("debate_rounds")
        .setDescription("Number of debate rounds (1-5)")
        .setMinValue(1)
        .setMaxValue(5)
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName("include_transcript")
        .setDescription("Generate detailed conversation transcript")
        .setRequired(false),
    ),

  execute: async (client: Client, interaction: CommandInteraction) => {
    try {
      const question = interaction.options.get("question")?.value as string;

      // Check for preset first
      const preset = interaction.options.get("preset")?.value as string;

      // Collect individual personality selections
      const personality1 = interaction.options.get("personality1")
        ?.value as string;
      const personality2 = interaction.options.get("personality2")
        ?.value as string;
      const personality3 = interaction.options.get("personality3")
        ?.value as string;
      const personality4 = interaction.options.get("personality4")
        ?.value as string;

      const debateRounds =
        (interaction.options.get("debate_rounds")?.value as number) || 2;
      const includeTranscript =
        (interaction.options.get("include_transcript")?.value as boolean) ??
        true;

      // Simplified defaults - Zenbot personalities only
      const zenbotOnly = true;
      const maxParticipants = 4;
      const requireConsensus = false;

      let zenbotPersonalities: string[];

      if (preset) {
        // Use preset personalities (convert short names to full names)
        const presetPersonalities = preset
          .split(",")
          .map((p) =>
            p.trim() === "default" ? "zenbot-default" : `zenbot-${p.trim()}`,
          );
        zenbotPersonalities = [...new Set(presetPersonalities)];
      } else {
        // Build personality array from individual selections
        const selectedPersonalities = [
          personality1,
          personality2,
          personality3,
          personality4,
        ].filter((p): p is string => p !== undefined && p !== null);

        // Remove duplicates and ensure we have at least one personality
        zenbotPersonalities =
          selectedPersonalities.length > 0
            ? [...new Set(selectedPersonalities)]
            : ["zenbot-default"];
      }

      logger.info(
        `🎭 Enhanced conference requested by ${interaction.user.username}: "${question.substring(0, 100)}..." with personalities: ${zenbotPersonalities.join(", ")}`,
      );

      // Acknowledge immediately since conferences take time
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
      }

      const actionService = ActionService.getInstance();
      const result = await actionService.executeFromCommand(
        interaction,
        "conference",
        {
          question,
          zenbot_personalities: zenbotPersonalities,
          external_providers: [],
          zenbot_only: zenbotOnly,
          debate_rounds: debateRounds,
          max_participants: maxParticipants,
          require_consensus: requireConsensus,
          include_transcript: includeTranscript,
        },
      );

      if (!result.success) {
        await interaction.editReply({
          content: `❌ **Enhanced Conference Failed**\n\n${result.error || "Unknown error occurred"}`,
        });
        return;
      }

      // Use the clean response from the action
      let responseContent = result.responseText || "No response generated";

      const data = result.data;
      if (!data) {
        await interaction.editReply({
          content: "❌ **Conference Error**: No response data received",
        });
        return;
      }

      // Discord has a 2000 character limit, so truncate if necessary
      if (responseContent.length > 2000) {
        const truncateLength = 1800; // Leave room for truncation message
        responseContent =
          responseContent.substring(0, truncateLength) +
          "\n\n*[Response truncated - full transcript in logs]*";
      }

      await interaction.editReply({
        content: responseContent,
      });

      logger.info(
        `🎉 Enhanced conference completed for ${interaction.user.username}: ${data.participants?.length || 0} participants, ${((data.consensusLevel || 0) * 100).toFixed(1)}% consensus in ${((data.totalDuration || 0) / 1000).toFixed(1)}s`,
      );

      // Log transcript summary if generated
      if (data.transcript) {
        logger.info(
          `📜 Transcript generated: ${data.transcript.participants?.length || 0} participants, ${data.transcript.rounds?.length || 0} rounds, ${data.transcript.synthesis?.finalResponse?.length || 0} char response`,
        );
      }
    } catch (error) {
      logger.error("🎭 Enhanced conference command failed:", error);

      try {
        if (interaction.deferred && !interaction.replied) {
          await interaction.editReply({
            content:
              "❌ **Enhanced Conference Disrupted**\n\nThe conference encountered an error. Multiple minds, singular confusion.",
          });
        } else if (!interaction.replied) {
          await interaction.reply({
            content:
              "❌ **Enhanced Conference Disrupted**\n\nThe conference encountered an error. Multiple minds, singular confusion.",
          });
        }
      } catch (followUpError) {
        logger.error("Failed to send error message:", followUpError);
      }
    }
  },
};
