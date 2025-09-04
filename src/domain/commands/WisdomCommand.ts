import { Command, CommandInput, CommandContext, CommandResult } from './Command';
import { VoiceService } from '../../infrastructure/services/voiceService';
import { logger } from '../../utils/logger';
import { formatWisdomMessage, formatSimpleWisdomMessage } from '../../utils/messageFormatters';

export class WisdomCommand extends Command {
  readonly name = 'wisdom';
  readonly description = 'Zen has an answer for everything - choose your path to wisdom';

  // Discord slash command data for registration
  getSlashCommandData() {
    return {
      name: 'advice',
      description: this.description,
      options: [{
        name: 'type',
        description: 'Choose the type of wisdom you seek',
        type: 3, // STRING
        required: false,
        choices: [
          { name: '🧘 Philosophical Wisdom', value: 'philosophical' },
          { name: '🙏 Greeting & Peace', value: 'greeting' },
          { name: '💚 Harmony & Healing', value: 'harmony' },
          { name: '⚡ Discord & Challenge', value: 'discord' },
          { name: '✨ Transcendence & Ultimate Truth', value: 'transcendence' },
          { name: '🎲 Random Wisdom', value: 'random' }
        ]
      }]
    };
  }

  canHandle(input: CommandInput): boolean {
    if (input.type === 'voice') {
      return /quote|wisdom|advice|give me wisdom|tell me something wise/i.test(input.text);
    }
    if (input.type === 'slash') {
      return input.text === 'advice';
    }
    return false;
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const adviceType = context.getOption<string>('type');
    logger.info(`WisdomCommand: Executing with type: ${adviceType}, input type: ${context.inputType}`);
    
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

    try {
      // Emit event to infrastructure to handle voice/TTS playback
      this.emit('voice.play.wisdom', {
        userId: context.userId,
        channelId: context.channelId,
        voiceLine: voiceLine,
        adviceType: adviceType,
        inputType: context.inputType,
        sessionId: context.sessionId
      });

      // For text response formatting
      const responseMessage = context.inputType === 'slash' 
        ? formatWisdomMessage(voiceLine.text, adviceType)
        : `From the depths of meditation... ${voiceLine.text} May these words bring you peace.`;

      // Event emission: Notify session that wisdom was shared
      this.emit('voice.interaction.completed', {
        userId: context.userId,
        channelId: context.channelId,
        shouldContinueListening: context.isInListeningSession(),
        interactionType: 'wisdom',
        quote: voiceLine.text,
        adviceType: adviceType
      });
      
      return CommandResult.success(responseMessage, { 
        quote: voiceLine.text,
        responseText: responseMessage,
        voiceLineRequested: true,
        adviceType: adviceType
      });
    } catch (error) {
      logger.error("Error during wisdom execution:", error);
      return CommandResult.error("The path to wisdom encountered a disturbance. Please try again.");
    }
  }
}