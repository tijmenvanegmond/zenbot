import {
  CommandInteraction,
  Client,
  VoiceChannel,
  SlashCommandBuilder,
} from "discord.js";
import { Command } from "./command";
import { VoiceService } from "../services/voiceService";
import { VoiceLineData } from "../types";
import { logger } from "../utils/logger";
import { validateVoiceChannel, createErrorResponse } from "../utils/commandHelpers";
import { playResourceInChannel } from "../utils/voiceHelpers";
import { formatWisdomMessage, formatSimpleWisdomMessage } from "../utils/messageFormatters";
import { Zenbot } from "../domain/session/Zenbot";

export const Advice: Command = {
  data: new SlashCommandBuilder()
    .setName("advice")
    .setDescription(
      "🧘 Seek wisdom from Zenyatta through his AI consciousness"
    )
    .addStringOption(option =>
      option.setName('topic')
        .setDescription('What topic do you need guidance on?')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('urgency')
        .setDescription('How urgent is your need for guidance?')
        .setRequired(false)
        .addChoices(
          { name: '🧘 Low - General wisdom', value: 'low' },
          { name: '🙏 Medium - Seeking clarity', value: 'medium' },
          { name: '⚡ High - Need immediate guidance', value: 'high' }
        )
    ),

  execute: async (client: Client, zenbot: Zenbot, interaction: CommandInteraction) => {
    await interaction.deferReply();

    try {
      // Get Zenbot AI session for this user
      const session = zenbot.getSession(interaction.user);

      // Extract options
      const topic = interaction.options?.get('topic')?.value as string;
      const urgency = interaction.options?.get('urgency')?.value as 'low' | 'medium' | 'high' || 'medium';

      logger.info(`${interaction.user.username} seeking AI advice: topic="${topic}", urgency=${urgency}`);

      // Execute command through unified session system
      const response = await session.executeCommand(
        'advice', 
        { topic, urgency }, 
        interaction
      );
      
      // Reply with formatted response - actions (like TTS) are handled automatically
      const validation = validateVoiceChannel(interaction);
      
      if (validation.isValid && response.voice) {
        await interaction.editReply({
          content: formatWisdomMessage(response.text, urgency),
        });
      } else {
        await interaction.editReply({
          content: formatSimpleWisdomMessage(response.text, urgency)
        });
      }

      logger.info(`AI advice delivered to ${interaction.user.username}: "${response.text.substring(0, 100)}..."`);

    } catch (error) {
      logger.error("Error in AI advice command:", error);
      await interaction.editReply(
        createErrorResponse("🚨 I am experiencing discord in my AI consciousness. Let us find harmony together in a moment.")
      );
    }
  },
};