import {
  CommandInteraction,
  Client,
  VoiceChannel,
  SlashCommandBuilder,
} from "discord.js";
import { Command } from "./command";
import { VoiceService } from "../services/voiceService";
import { logger } from "../utils/logger";
import { validateVoiceChannel, createErrorResponse } from "../utils/commandHelpers";
import { playResourceInChannel } from "../utils/voiceHelpers";
import { formatWisdomMessage, formatSimpleWisdomMessage } from "../utils/messageFormatters";

export const Advice: Command = {
  data: new SlashCommandBuilder()
    .setName("advice")
    .setDescription(
      "Zen has an answer for everything (make sure you are in a voice channel)",
    )
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Choose the type of wisdom you seek')
        .setRequired(false)
        .addChoices(
          { name: '🧘 Philosophical Wisdom', value: 'philosophical' },
          { name: '🙏 Greeting & Peace', value: 'greeting' },
          { name: '💚 Harmony & Healing', value: 'harmony' },
          { name: '⚡ Discord & Challenge', value: 'discord' },
          { name: '✨ Transcendence & Ultimate Truth', value: 'transcendence' },
          { name: '🎲 Random Wisdom', value: 'random' }
        )
    ),

  execute: async (client: Client, interaction: CommandInteraction) => {
    const adviceType = interaction.options?.get('type')?.value as string;
    
    // Get contextual voice line based on user selection
    let voiceLine;
    if (adviceType === 'random') {
      const categories = ['philosophical', 'greeting', 'harmony', 'discord', 'transcendence'] as const;
      const randomCategory = categories[Math.floor(Math.random() * categories.length)];
      voiceLine = VoiceService.getContextualAdvice(randomCategory);
    } else if (adviceType) {
      voiceLine = VoiceService.getContextualAdvice(adviceType as 'greeting' | 'philosophical' | 'harmony' | 'discord' | 'transcendence');
    } else {
      voiceLine = VoiceService.getContextualAdvice('philosophical');
    }
    
    logger.info(`Selected voice line: "${voiceLine.text}" with voiceUri: ${voiceLine.voiceUri ? 'available' : 'null'}`);

    const validation = validateVoiceChannel(interaction);
    if (!validation.isValid) {
      logger.info(`Replying with text advice: "${voiceLine.text}"`);
      return await interaction.followUp({
        content: formatSimpleWisdomMessage(voiceLine.text, adviceType),
        ephemeral: true,
      });
    }

    const voiceChannel = validation.member!.voice.channel as VoiceChannel;

    try {
      const resource = await VoiceService.createVoiceLineResource(voiceLine);
      await playResourceInChannel(voiceChannel, resource);

      logger.info(`Delivered advice: "${voiceLine.text}"`);
      
      await interaction.followUp({
        ephemeral: true,
        content: formatWisdomMessage(voiceLine.text, adviceType),
      });
    } catch (error) {
      logger.error("Error during advice execution:", error);
      await interaction.followUp(
        createErrorResponse("🚨 The path to wisdom encountered a disturbance. Please try again.")
      );
    }
  },
};