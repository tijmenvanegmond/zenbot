import { Command, CommandInput, CommandContext, CommandResult } from './Command';

export class ListenCommand extends Command {
  readonly name = 'listen';
  readonly description = 'Start listening for voice commands in your voice channel';

  // Discord slash command data for registration
  getSlashCommandData() {
    return {
      name: 'listen',
      description: this.description,
      options: [{
        name: 'time',
        description: 'Listening duration in minutes (default: 1)',
        type: 10, // NUMBER
        required: false,
        min_value: 1,
        max_value: 60
      }]
    };
  }

  canHandle(input: CommandInput): boolean {
    return input.type === 'slash' && input.text === 'listen';
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const timeMinutes = context.getOption('time', 1);
    const duration = timeMinutes * 60 * 1000; // Convert to milliseconds
    
    // Event emission: Start concurrent voice session
    this.emit('voice.session.start', {
      channelId: context.channelId,
      userId: context.userId,
      duration,
      sessionId: `session-${context.channelId}-${Date.now()}`
    });
    
    return CommandResult.success(
      `Listening to voice channel for ${timeMinutes} minute${timeMinutes === 1 ? '' : 's'}. Experience tranquility while I await your wisdom.`,
      {
        duration,
        timeMinutes
      }
    );
  }
}