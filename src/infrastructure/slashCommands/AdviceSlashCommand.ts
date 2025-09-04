import {
  CommandInteraction,
  SlashCommandBuilder,
  VoiceChannel,
} from "discord.js";
import { VoiceSlashCommand } from "./BaseSlashCommand";
import { VoiceService } from "../services/voiceService";
import { playResourceInChannel } from "../../utils/voiceHelpers";
import { formatWisdomMessage, formatSimpleWisdomMessage } from "../../utils/messageFormatters";
import { logger } from "../../utils/logger";

/**
 * Modern Advice slash command using the new base class structure
 */
export class AdviceSlashCommand extends VoiceSlashCommand {
  readonly name = "advice";
  readonly description = "Zen has an answer for everything (make sure you are in a voice channel)";

  protected buildCommandData() {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
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
      );
  }

  protected async handleVoiceCommand(
    interaction: CommandInteraction,
    validation: any
  ): Promise<void> {
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
      throw error; // Let base class handle the error
    }
  }

  /**
   * Override handleCommand to provide fallback for users not in voice channels
   */
  protected async handleCommand(interaction: CommandInteraction): Promise<void> {
    const validation = this.validateVoiceChannel(interaction);
    if (!validation.isValid) {
      // Fallback: provide text-only advice for users not in voice channels
      const adviceType = interaction.options?.get('type')?.value as string;
      const voiceLine = VoiceService.getContextualAdvice('philosophical');
      
      logger.info(`Replying with text advice: "${voiceLine.text}"`);
      await interaction.followUp({
        content: formatSimpleWisdomMessage(voiceLine.text, adviceType),
        ephemeral: true,
      });
      return;
    }

    await this.handleVoiceCommand(interaction, validation);
  }
}
