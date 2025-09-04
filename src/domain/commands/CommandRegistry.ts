import { EventEmitter } from 'events';
import { Command, CommandInput, CommandContext, CommandResult } from './Command';
import { GreetingCommand } from './GreetingCommand';
import { WisdomCommand } from './WisdomCommand';
import { TTSCommand } from './TTSCommand';
import { ListenCommand } from './ListenCommand';
import { FarewellCommand } from './FarewellCommand';
import { QuoteCommand } from './QuoteCommand';
import { RenameCommand } from './RenameCommand';
import { RemarkCommand } from './RemarkCommand';
import { logger } from '../../utils/logger';

export class CommandRegistry {
  private commands = new Map<string, Command>();
  
  constructor(private eventBus: EventEmitter) {
    this.registerCommands();
  }
  
  private registerCommands(): void {
    const commands = [
      new GreetingCommand(this, this.eventBus),
      new WisdomCommand(this, this.eventBus),
      new TTSCommand(this, this.eventBus),
      new ListenCommand(this, this.eventBus),
      new FarewellCommand(this, this.eventBus),
      new QuoteCommand(this, this.eventBus),
      new RenameCommand(this, this.eventBus),
      new RemarkCommand(this, this.eventBus)
    ];
    
    for (const command of commands) {
      this.commands.set(command.name, command);
      logger.info(`Registered command: ${command.name} - ${command.description}`);
    }
  }
  
  async executeCommand(input: CommandInput, context: CommandContext): Promise<CommandResult> {
    logger.info(`Executing command for input: "${input.text}" (${input.type})`);
    
    // Find command that can handle this input
    for (const [name, command] of this.commands) {
      if (command.canHandle(input)) {
        logger.info(`Command matched: ${name}`);
        try {
          const result = await command.execute(context);
          logger.info(`Command ${name} executed: ${result.success ? 'SUCCESS' : 'FAILURE'} - ${result.response}`);
          return result;
        } catch (error) {
          logger.error(`Command ${name} failed:`, error);
          return CommandResult.error(`Command ${name} failed: ${(error as Error).message}`);
        }
      }
    }
    
    logger.info(`No command found for input: "${input.text}"`);
    return CommandResult.notFound("I do not understand. Try saying hello, asking for wisdom, or saying goodbye.");
  }
  
  // Auto-detect command from voice input
  detectCommandFromVoice(text: string, userId: string): CommandInput {
    return CommandInput.fromVoice(text, userId);
  }
  
  // Auto-detect command from slash input  
  detectCommandFromSlash(commandName: string, options: any, userId: string): CommandInput {
    return CommandInput.fromSlash(commandName, options, userId);
  }
  
  // Get all commands for slash command registration
  getAllCommands(): Command[] {
    return Array.from(this.commands.values());
  }
  
  // Get specific command by name (for testing/debugging)
  getCommand(name: string): Command | undefined {
    return this.commands.get(name);
  }
}