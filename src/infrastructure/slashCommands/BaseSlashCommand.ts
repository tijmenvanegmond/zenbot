import {
  CommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  Client,
} from "discord.js";
import { ZenbotOrchestrator } from "../../application/ZenbotOrchestrator";
import { logger } from "../../utils/logger";
import { validateVoiceChannel, createErrorResponse } from "../../utils/commandHelpers";

/**
 * Base class for all slash commands
 * Provides common functionality and enforces consistent structure
 */
export abstract class BaseSlashCommand {
  abstract readonly name: string;
  abstract readonly description: string;
  
  constructor(
    protected client: Client,
    protected orchestrator: ZenbotOrchestrator
  ) {}

  /**
   * Build the Discord slash command data
   * Override this to add options specific to your command
   */
  protected buildCommandData(): SlashCommandBuilder | SlashCommandOptionsOnlyBuilder {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description);
  }

  /**
   * Get the command data for Discord registration
   */
  getCommandData() {
    return this.buildCommandData();
  }

  /**
   * Main execution method - handles common setup and error handling
   */
  async execute(interaction: CommandInteraction): Promise<void> {
    try {
      // Check if interaction is still valid
      if (!interaction.isRepliable()) {
        logger.warn(`Interaction ${interaction.id} is no longer repliable`);
        return;
      }

      // Defer reply if not already responded
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply();
      }
      
    

  /**
   * Override this method to implement command-specific logic
   */
  protected abstract handleCommand(interaction: CommandInteraction): Promise<void>;

  /**
   * Common error handling for all commands
   */
  protected async handleError(interaction: CommandInteraction, error: any): Promise<void> {
    const errorMessage = `An error occurred while executing the ${this.name} command.`;
    
    try {
      // Check if we can still respond to this interaction
      if (!interaction.isRepliable()) {
        logger.warn(`Cannot respond to interaction ${interaction.id} - no longer repliable`);
        return;
      }

      if (interaction.deferred) {
        await interaction.followUp(createErrorResponse(errorMessage));
      } else if (!interaction.replied) {
        await interaction.reply(createErrorResponse(errorMessage));
      }
    } catch (followUpError) {
      logger.error(`Failed to send error message for ${this.name} command:`, followUpError);
      // If it's an "Unknown interaction" error, log it but don't throw
      if (followUpError && typeof followUpError === 'object' && 'code' in followUpError && followUpError.code === 10062) {
        logger.warn(`Interaction expired for ${this.name} command`);
      }
    }
  }

  /**
   * Common voice channel validation
   */
  protected validateVoiceChannel(interaction: CommandInteraction) {
    return validateVoiceChannel(interaction);
  }

  /**
   * Execute a domain command through the orchestrator
   */
  protected async executeDomainCommand(
    commandName: string,
    userId: string,
    channelId: string,
    options: Record<string, any> = {}
  ) {
    return await this.orchestrator.getCommandHandler().executeCommandDirect(
      commandName,
      userId,
      channelId,
      options
    );
  }
}

/**
 * Base class for commands that require voice channel presence
 */
export abstract class VoiceSlashCommand extends BaseSlashCommand {
  protected async handleCommand(interaction: CommandInteraction): Promise<void> {
    const validation = this.validateVoiceChannel(interaction);
    if (!validation.isValid) {
      await interaction.followUp(validation.response!);
      return;
    }

    await this.handleVoiceCommand(interaction, validation);
  }

  /**
   * Override this method for voice-specific command logic
   */
  protected abstract handleVoiceCommand(
    interaction: CommandInteraction,
    validation: any
  ): Promise<void>;
}

/**
 * Legacy interface for backwards compatibility
 */
export interface Command {
  data: SlashCommandBuilder;
  execute: (client: Client, orchestrator: ZenbotOrchestrator, interaction: CommandInteraction) => Promise<void>;
}
