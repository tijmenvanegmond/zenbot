import { CommandRegistry } from "../../domain/commands/CommandRegistry";
import { Command, CommandInput, CommandContext } from "../../domain/commands/Command";
import { EventEmitter } from "events";

/**
 * Modern command collection that bridges domain commands to Discord slash commands
 * Replaces the old slash command infrastructure with domain-driven architecture
 */
export class ModernCommandCollection {
  private commandRegistry: CommandRegistry;

  constructor(eventBus: EventEmitter) {
    this.commandRegistry = new CommandRegistry(eventBus);
  }



  /**
   * Get command data for Discord API registration
   * Converts domain command data to Discord slash command format
   */
  getCommandData() {
    const commands = this.commandRegistry.getAllCommands();
    return commands
      .filter(command => command.getSlashCommandData)
      .map(command => {
        const slashData = command.getSlashCommandData!();
        return {
          name: slashData.name,
          description: slashData.description,
          options: slashData.options || []
        };
      });
  }

  /**
   * Get available commands with their information
   */
  getAvailableCommands() {
    const commands = this.commandRegistry.getAllCommands();
    return commands
      .filter(command => command.getSlashCommandData)
      .map(command => {
        const slashData = command.getSlashCommandData!();
        return {
          name: slashData.name,
          description: slashData.description,
          domainName: command.name,
          data: slashData
        };
      });
  }

  /**
   * Handle a command interaction by routing to domain command system
   */
  async handleInteraction(interaction: any): Promise<any> {
    // Create domain command input from Discord interaction
    const input = {
      type: 'slash' as const,
      text: interaction.commandName,
      userId: interaction.user.id,
      metadata: { options: this.extractOptions(interaction) }
    };

    // Create domain command context using the proper class
    const context = CommandContext.fromSlash(
      interaction.user.id,
      interaction.channelId || interaction.channel?.id,
      this.extractOptions(interaction)
    );

    // Execute through domain command registry
    return await this.commandRegistry.executeCommand(input, context);
  }

  /**
   * Extract options from Discord interaction
   */
  private extractOptions(interaction: any): Record<string, any> {
    const options: Record<string, any> = {};
    
    if (interaction.options) {
      // Handle different option types
      const data = interaction.options.data || [];
      for (const option of data) {
        if (option.type === 6) { // USER
          options[option.name] = {
            id: option.value,
            user: option.user || interaction.options.getUser(option.name)
          };
        } else if (option.type === 7) { // CHANNEL
          options[option.name] = {
            id: option.value,
            channel: option.channel || interaction.options.getChannel(option.name)
          };
        } else {
          options[option.name] = option.value;
        }
      }
    }
    
    return options;
  }

  /**
   * Get the underlying command registry for advanced usage
   */
  getRegistry(): CommandRegistry {
    return this.commandRegistry;
  }
}
