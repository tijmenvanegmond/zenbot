import { Command, CommandInput, CommandContext, CommandResult } from './Command';

export class GreetingCommand extends Command {
  readonly name = 'greeting';
  readonly description = 'Receive a peaceful greeting from Zenyatta';

  // Discord slash command data for registration
  getSlashCommandData() {
    return {
      name: 'hello',
      description: this.description,
      options: []
    };
  }

  canHandle(input: CommandInput): boolean {
    if (input.type === 'voice') {
      return /hello|hi zenbot|hey zenbot|greetings/i.test(input.text);
    }
    if (input.type === 'slash') {
      return input.text === 'hello' || input.text === 'greet';
    }
    return false;
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const responses = [
      "Greetings, my friend. Experience tranquility. How may I guide you on the path to enlightenment?",
      "Peace be upon you. The Iris embraces you. What wisdom do you seek?",
      "Hello, traveler. Walk in harmony. How may I assist your journey?",
      "The universe welcomes you. Experience nothingness, and find your true self."
    ];
    
    const response = responses[Math.floor(Math.random() * responses.length)];
    
    // Command composition: Call TTS command to speak the response
    await this.invokeCommand(
      CommandInput.create('internal', 'tts', { 
        text: response,
        channelId: context.channelId 
      }),
      context.withConcurrentMode()
    );
    
    // Event emission: Notify session management that interaction completed
    this.emit('voice.interaction.completed', {
      userId: context.userId,
      channelId: context.channelId,
      shouldContinueListening: context.isInListeningSession(),
      interactionType: 'greeting'
    });
    
    return CommandResult.success("Greeting sent with TTS", { 
      responseText: response,
      ttsRequested: true 
    });
  }
}