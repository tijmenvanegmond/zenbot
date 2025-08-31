import {
  CommandInteraction,
  Client,
  GuildMember,
  VoiceChannel,
  SlashCommandBuilder,
} from "discord.js";
import { Command } from "./command";
import { VoiceLineDataCollection, getContextualAdvice, VoiceLineCategories, getRandomVoiceLineFromCategory, createVoiceLineResource } from "../voice/voiceLineData";
import { createTTSStream } from "../voice/tts";
import PlayResourceInVoiceChannel from "../voice/playInVoiceChannel";
import { logger } from "../utils/logger";

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
    const member = interaction?.member as GuildMember;
    const adviceType = interaction.options?.get('type')?.value as string;
    
    // Get contextual voice line based on user selection
    let voiceLine;
    if (adviceType === 'random') {
      // Choose random category and then random line from that category
      const categories = ['philosophical', 'greeting', 'harmony', 'discord', 'transcendence'] as const;
      const randomCategory = categories[Math.floor(Math.random() * categories.length)];
      voiceLine = getContextualAdvice(randomCategory);
    } else if (adviceType) {
      voiceLine = getContextualAdvice(adviceType as 'greeting' | 'philosophical' | 'harmony' | 'discord' | 'transcendence');
    } else {
      // Default to philosophical wisdom (which has voice line files)
      voiceLine = getContextualAdvice('philosophical');
    }
    
    logger.info(`Selected voice line: "${voiceLine.text}" with voiceUri: ${voiceLine.voiceUri ? 'available' : 'null'}`);

    if (!member?.voice?.channelId) {
      logger.info(`Replying with text advice: "${voiceLine.text}"`);
      
      // Get appropriate emoji based on advice type
      const getAdviceEmoji = (type?: string) => {
        switch (type) {
          case 'greeting': return '🙏';
          case 'harmony': return '💚';
          case 'discord': return '⚡';
          case 'transcendence': return '✨';
          case 'random': return '🎲';
          default: return '🧘';
        }
      };
      
      return await interaction.followUp({
        content: `${getAdviceEmoji(adviceType)} **Zenyatta's Wisdom:** ${voiceLine.text}`,
        ephemeral: true,
      });
    }

    try {
      // Use actual voice line files when available, with TTS fallback
      const resource = await createVoiceLineResource(voiceLine);

      await PlayResourceInVoiceChannel(
        member.voice.channel as VoiceChannel,
        resource,
      );

      logger.info(`Delivered advice: "${voiceLine.text}"`);
      
      // Get appropriate emoji based on advice type
      const getAdviceEmoji = (type?: string) => {
        switch (type) {
          case 'greeting': return '🙏';
          case 'harmony': return '💚';
          case 'discord': return '⚡';
          case 'transcendence': return '✨';
          case 'random': return '🎲';
          default: return '🧘';
        }
      };
      
      // Get appropriate message prefix based on type
      const getAdvicePrefix = (type?: string) => {
        switch (type) {
          case 'greeting': return 'Peace be upon you...';
          case 'harmony': return 'Embrace harmony...';
          case 'discord': return 'Face your challenges...';
          case 'transcendence': return 'Experience tranquility...';
          case 'random': return 'The iris reveals...';
          default: return 'Walk in wisdom...';
        }
      };

      await interaction.followUp({
        ephemeral: true,
        content: `${getAdviceEmoji(adviceType)} **${getAdvicePrefix(adviceType)}** "${voiceLine.text}"`,
      });
    } catch (error) {
      logger.error("Error during advice execution:", error);
      await interaction.followUp({
        ephemeral: true,
        content: "🚨 The path to wisdom encountered a disturbance. Please try again.",
      });
    }
  },
};
