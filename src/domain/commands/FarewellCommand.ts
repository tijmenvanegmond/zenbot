import { Command, CommandInput, CommandContext, CommandResult } from './Command';

export class FarewellCommand extends Command {
  readonly name = 'farewell';
  readonly description = 'Receive a peaceful farewell from Zenyatta and have him leave the voice channel';

  // Discord slash command data for registration
  getSlashCommandData() {
    return {
      name: 'goodbye',
      description: this.description,
      options: []
    };
  }

  canHandle(input: CommandInput): boolean {
    if (input.type === 'voice') {
      return /stop|leave|goodbye|bye|farewell/i.test(input.text);
    }
    if (input.type === 'slash') {
      return input.text === 'goodbye' || input.text === 'leave';
    }
    return false;
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const farewellMessages = [
      "May you find your path to enlightenment. Until we meet again... experience tranquility.",
      "The Iris will guide you on your journey. Peace be upon you.",
      "Walk in harmony, my friend. I shall return to my meditations.",
      "Until the next moment of wisdom calls. Experience nothingness."
    ];
    
    const response = farewellMessages[Math.floor(Math.random() * farewellMessages.length)];
    
    // Command composition: Say farewell with TTS
    await this.invokeCommand(
      CommandInput.create('internal', 'tts', { 
        text: response,
        channelId: context.channelId 
      }),
      context.withConcurrentMode()
    );
    
    // Event emission: Request to end session and leave after TTS
    this.emit('voice.session.end', {
      userId: context.userId,
      channelId: context.channelId,
      reason: 'farewell',
      delay: 3000 // Wait 3 seconds for TTS to complete
    });
    
    return CommandResult.success("Farewell sent, leaving voice channel", { 
      responseText: response,
      leavingChannel: true,
      delay: 3000
    });
  }
}