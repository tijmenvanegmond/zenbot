import {
  CommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { VoiceSlashCommand } from "./BaseSlashCommand";
import { CommandInput, CommandContext } from "../../domain/commands/Command";
import { QuoteCommand } from "../../domain/commands/QuoteCommand";
import { getInteractionOptions, createErrorResponse } from "../../utils/commandHelpers";
import { logger } from "../../utils/logger";

/**
 * Modern Quote slash command using the new base class structure
 * Delegates to domain layer for business logic
 */
export class QuoteSlashCommand extends VoiceSlashCommand {
  readonly name = "quote";
  readonly description = "Reads a random quote from the quotes channel with intelligent parsing";

  protected buildCommandData() {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addChannelOption((option) =>
        option
          .setName("quote_channel")
          .setDescription("The channel to pull quotes from (defaults to quotes channel)")
          .setRequired(false)
      )
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("Filter quotes from or about a specific user")
          .setRequired(false)
      );
  }

  protected async handleVoiceCommand(
    interaction: CommandInteraction,
    validation: any
  ): Promise<void> {
    const options = getInteractionOptions(interaction);
    const quoteChannel = options.getChannel("quote_channel");
    const targetUser = options.getUser("user");
    
    // Set up event-driven response handling
    const requestId = interaction.user.id + interaction.channelId!;
    await this.setupEventHandlers(interaction, requestId);
    
    // Execute through domain layer
    const input = CommandInput.fromSlash("quote", {
      quote_channel: quoteChannel,
      user: targetUser
    }, interaction.user.id);
    
    const context = CommandContext.fromSlash(
      interaction.user.id,
      interaction.channelId!,
      {
        quote_channel: quoteChannel,
        user: targetUser
      }
    );
    
    const result = await this.orchestrator.getCommandRegistry().executeCommand(input, context);
    
    if (result.success) {
      await interaction.followUp({
        ephemeral: true,
        content: "Processing quote request...",
      });
    } else {
      await interaction.followUp(createErrorResponse(result.response));
    }
  }

  /**
   * Set up event listeners for async quote processing
   */
  private async setupEventHandlers(interaction: CommandInteraction, requestId: string): Promise<void> {
    const successHandler = (data: any) => {
      if (data.requestId === requestId) {
        interaction.followUp({
          ephemeral: true,
          content: data.responseMessage,
        }).catch((error: any) => {
          logger.error('Error sending quote response:', error);
        });
        this.cleanupEventHandlers(requestId, successHandler, errorHandler);
      }
    };
    
    const errorHandler = (data: any) => {
      if (data.requestId === requestId) {
        const errorMessage = QuoteCommand.getQuoteErrorMessage(data.error, data.targetUser);
        interaction.followUp(createErrorResponse(errorMessage)).catch((error: any) => {
          logger.error('Error sending quote error response:', error);
        });
        this.cleanupEventHandlers(requestId, successHandler, errorHandler);
      }
    };
    
    this.orchestrator.getEventBus().on('quote.success', successHandler);
    this.orchestrator.getEventBus().on('quote.error', errorHandler);
    
    // Auto-cleanup after timeout to prevent memory leaks
    setTimeout(() => {
      this.cleanupEventHandlers(requestId, successHandler, errorHandler);
    }, 30000); // 30 second timeout
  }

  /**
   * Clean up event listeners to prevent memory leaks
   */
  private cleanupEventHandlers(requestId: string, successHandler: any, errorHandler: any): void {
    this.orchestrator.getEventBus().removeListener('quote.success', successHandler);
    this.orchestrator.getEventBus().removeListener('quote.error', errorHandler);
    logger.debug(`Cleaned up event handlers for request: ${requestId}`);
  }
}
