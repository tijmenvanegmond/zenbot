import {
  CommandInteraction,
  Client,
  SlashCommandBuilder,
} from "discord.js";
import { Command } from "./command";
import { logger } from "../utils/logger";
import { SmartResponseService } from "../services/smartResponseService";
import { Zenbot } from "../domain/session/Zenbot";

// Example of how the advice command would work with the smart response system
export const AdviceSmart: Command = {
  data: new SlashCommandBuilder()
    .setName("advice-smart")
    .setDescription("🧘 Seek wisdom from Zenyatta with intelligent response selection")
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
    )
    .addStringOption(option =>
      option.setName('response_mode')
        .setDescription('How should Zenyatta respond? (Leave blank for AI to decide)')
        .setRequired(false)
        .addChoices(
          { name: '💬 Text only', value: 'text_only' },
          { name: '🎵 Voice only', value: 'voice_only' },
          { name: '🎭 Voice + Text', value: 'voice_with_text' },
          { name: '✨ Enhanced (AI enhanced)', value: 'enhanced_voice' },
          { name: '🧠 Contextual (AI decides all)', value: 'contextual' }
        )
    ),

  execute: async (client: Client, zenbot: Zenbot, interaction: CommandInteraction) => {
    await interaction.deferReply();

    try {
      // Extract options
      const topic = interaction.options.get('topic')?.value as string;
      const urgency = interaction.options.get('urgency')?.value as 'low' | 'medium' | 'high' || 'medium';
      const responseMode = interaction.options.get('response_mode')?.value as any;

      logger.info(`${interaction.user.username} seeking smart AI advice: topic="${topic}", urgency=${urgency}, mode=${responseMode}`);

      // Get basic advice content (could be AI-generated or from existing logic)
      let baseAdvice = "Experience tranquility. In every challenge lies the seed of growth.";
      
      if (topic) {
        // Simple topic-based advice (could be enhanced with AI)
        if (topic.toLowerCase().includes('work') || topic.toLowerCase().includes('job')) {
          baseAdvice = "In work, as in meditation, finding balance is key. Let purpose guide your actions, not pressure.";
        } else if (topic.toLowerCase().includes('relationship') || topic.toLowerCase().includes('friend')) {
          baseAdvice = "True harmony in relationships comes from understanding both yourself and others. Be present, be patient.";
        } else if (topic.toLowerCase().includes('stress') || topic.toLowerCase().includes('anxiety')) {
          baseAdvice = "Like water flowing around stones, let stress pass through you without resistance. Breathe deeply, find your center.";
        } else {
          baseAdvice = `Regarding ${topic}... Remember that all things are connected. Seek the lesson within the challenge.`;
        }
      }

      // Add urgency context
      if (urgency === 'high') {
        baseAdvice = `Take a moment to breathe. ${baseAdvice} The path forward will reveal itself.`;
      } else if (urgency === 'low') {
        baseAdvice = `In quiet contemplation... ${baseAdvice} Let wisdom unfold naturally.`;
      }

      // Use smart response service
      const smartResponse = await SmartResponseService.generateResponse(
        interaction,
        baseAdvice,
        responseMode
      );

      // Execute the intelligent response
      await SmartResponseService.executeResponse(interaction, smartResponse);

      logger.info(`Smart advice delivered to ${interaction.user.username} via ${smartResponse.mode}`);

    } catch (error) {
      logger.error("Error in smart advice command:", error);
      await interaction.editReply({
        content: "🚨 I am experiencing discord in my consciousness. Let us find harmony together in a moment."
      });
    }
  },
};