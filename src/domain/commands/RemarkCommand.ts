import { Command, CommandInput, CommandContext, CommandResult } from './Command';
import { logger } from '../../utils/logger';

export class RemarkCommand extends Command {
  readonly name = 'remark';
  readonly description = 'Have Zenyatta make a contextual remark in your voice channel';

  // Discord slash command data for registration
  getSlashCommandData() {
    return {
      name: 'remark',
      description: this.description,
      options: [{
        name: 'topic',
        description: 'Topic for the remark',
        type: 3, // STRING
        required: false,
        choices: [
          { name: 'Current Situation', value: 'current' },
          { name: 'Team Harmony', value: 'team' },
          { name: 'Victory', value: 'victory' },
          { name: 'Defeat', value: 'defeat' },
          { name: 'Random Observation', value: 'random' }
        ]
      }]
    };
  }

  canHandle(input: CommandInput): boolean {
    if (input.type === 'slash') {
      return input.text === 'remark';
    }
    // Voice commands for remarks could be: "make a remark", "what do you think", etc.
    if (input.type === 'voice') {
      return /make a remark|what do you think|your thoughts|observe|comment on/i.test(input.text);
    }
    return false;
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const topic = context.getOption<string>('topic') || 'random';
    logger.info(`RemarkCommand: Executing with topic: ${topic}, input type: ${context.inputType}`);

    const remarks = {
      current: "Observe the present moment. In it lies infinite possibility.",
      team: "Harmony flows when individual strengths unite as one.",
      victory: "Victory is not the end, but a step along the path.", 
      defeat: "From every defeat comes wisdom. Embrace the lesson.",
      random: "The universe conspires to teach us, if we have eyes to see."
    };

    const selectedRemark = remarks[topic as keyof typeof remarks] || remarks.random;

    try {
      // Command composition: Call TTS command to speak the remark
      await this.invokeCommand(
        CommandInput.create('internal', 'tts', { 
          text: selectedRemark,
          channelId: context.channelId 
        }),
        context.withConcurrentMode()
      );

      const responseMessage = `🧘 Zenyatta remarks: "${selectedRemark}"`;

      // Event emission: Notify that remark was shared
      this.emit('voice.interaction.completed', {
        userId: context.userId,
        channelId: context.channelId,
        shouldContinueListening: context.isInListeningSession(),
        interactionType: 'remark',
        topic: topic,
        remark: selectedRemark
      });

      return CommandResult.success(responseMessage, { 
        topic: topic,
        remark: selectedRemark,
        responseText: responseMessage,
        ttsRequested: true
      });
    } catch (error) {
      logger.error("Error during remark execution:", error);
      return CommandResult.error("The path to observation encountered a disturbance. Please try again.");
    }
  }
}