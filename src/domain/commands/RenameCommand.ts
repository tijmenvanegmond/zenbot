import { Command, CommandInput, CommandContext, CommandResult } from './Command';
import { logger } from '../../utils/logger';

export class RenameCommand extends Command {
  readonly name = 'rename';
  readonly description = "Change Zenyatta's display name in this server";

  // Discord slash command data for registration
  getSlashCommandData() {
    return {
      name: 'rename',
      description: this.description,
      options: [{
        name: 'name',
        description: 'New display name for Zenyatta',
        type: 3, // STRING
        required: true,
        max_length: 32
      }]
    };
  }

  canHandle(input: CommandInput): boolean {
    if (input.type === 'slash') {
      return input.text === 'rename';
    }
    // Voice commands for renaming could be: "change your name to..." 
    if (input.type === 'voice') {
      return /change your name|rename yourself|call yourself/i.test(input.text);
    }
    return false;
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const newName = context.getOption<string>('name');
    logger.info(`RenameCommand: Executing with name: ${newName}, input type: ${context.inputType}`);

    if (!newName?.trim()) {
      return CommandResult.error("Please provide a valid name for me to use.");
    }

    try {
      // Emit event to infrastructure to handle Discord API call
      this.emit('bot.rename.request', {
        userId: context.userId,
        channelId: context.channelId,
        newName: newName.trim(),
        sessionId: context.sessionId
      });

      const responseMessage = `🧘 My essence shifts. I shall become "${newName.trim()}". The path to enlightenment continues under this new form.`;

      // Event emission: Notify that rename was requested
      this.emit('voice.interaction.completed', {
        userId: context.userId,
        channelId: context.channelId,
        shouldContinueListening: context.isInListeningSession(),
        interactionType: 'rename',
        newName: newName.trim()
      });

      return CommandResult.success(responseMessage, { 
        newName: newName.trim(),
        responseText: responseMessage
      });
    } catch (error) {
      logger.error("Error during rename execution:", error);
      return CommandResult.error("The path to name transformation encountered a disturbance. Please try again.");
    }
  }
}