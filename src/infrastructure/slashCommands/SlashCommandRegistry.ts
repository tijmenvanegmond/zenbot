import { Client } from "discord.js";
import { ZenbotOrchestrator } from "../../application/ZenbotOrchestrator";
import { BaseSlashCommand } from "./BaseSlashCommand";
import { logger } from "../../utils/logger";

/**
 * Registry for managing slash commands
 * Handles registration, instantiation, and routing
 */
export class SlashCommandRegistry {
  private commands = new Map<string, BaseSlashCommand>();
  
  constructor(
    private client: Client,
    private orchestrator: ZenbotOrchestrator
  ) {}

  /**
   * Register a command class
   */
  registerCommand(CommandClass: new (client: Client, orchestrator: ZenbotOrchestrator) => BaseSlashCommand): void {
    const command = new CommandClass(this.client, this.orchestrator);
    this.commands.set(command.name, command);
    logger.info(`Registered slash command: ${command.name} - ${command.description}`);
  }

  /**
   * Register a command instance
   */
  registerCommandInstance(command: BaseSlashCommand): void {
    this.commands.set(command.name, command);
    logger.info(`Registered slash command: ${command.name} - ${command.description}`);
  }

  /**
   * Register multiple command classes
   */
  registerCommands(CommandClasses: Array<new (client: Client, orchestrator: ZenbotOrchestrator) => BaseSlashCommand>): void {
    for (const CommandClass of CommandClasses) {
      this.registerCommand(CommandClass);
    }
  }

  /**
   * Get command by name
   */
  getCommand(name: string): BaseSlashCommand | undefined {
    return this.commands.get(name);
  }

  /**
   * Get all registered commands
   */
  getAllCommands(): BaseSlashCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get command data for Discord registration
   */
  getCommandData() {
    return this.getAllCommands().map(command => command.getCommandData());
  }

  /**
   * Execute a command by name
   */
  async executeCommand(commandName: string, interaction: any): Promise<void> {
    const command = this.getCommand(commandName);
    if (!command) {
      logger.warn(`Unknown command: ${commandName}`);
      await interaction.reply({ content: "Unknown command", ephemeral: true });
      return;
    }

    await command.execute(interaction);
  }

  /**
   * Get command count
   */
  getCommandCount(): number {
    return this.commands.size;
  }
}
