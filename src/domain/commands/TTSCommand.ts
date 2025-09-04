import { Command, CommandInput, CommandContext, CommandResult } from './Command';

export class TTSCommand extends Command {
  readonly name = 'tts';
  readonly description = 'Have Zenyatta speak custom text in your voice channel';

  // Discord slash command data for registration
  getSlashCommandData() {
    return {
      name: 'tts',
      description: this.description,
      options: [{
        name: 'text',
        description: 'The text for Zenyatta to speak',
        type: 3, // STRING
        required: true,
        max_length: 500
      }]
    };
  }

  canHandle(input: CommandInput): boolean {
    if (input.type === 'slash') {
      return input.text === 'tts';
    }
    if (input.type === 'internal') {
      return input.text === 'tts';
    }
    // For voice, we don't directly handle TTS commands - they go through other commands
    return false;
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const text = context.getText() || context.getOption('text');
    const channelId = context.getOption('channelId') || context.channelId;
    
    if (!text) {
      return CommandResult.error("No text provided for TTS");
    }

    const priority = context.getConcurrentMode() ? 'high' : 'normal';
    
    // Event emission: Queue TTS request for infrastructure layer
    this.emit('tts.request', {
      text,
      channelId,
      priority,
      userId: context.userId,
      concurrent: context.getConcurrentMode()
    });
    
    return CommandResult.success("TTS request queued", {
      text,
      priority,
      concurrent: context.getConcurrentMode()
    });
  }
}