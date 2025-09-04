import { EventEmitter } from 'events';
import { CommandInteraction } from 'discord.js';
import { CommandRegistry } from '../domain/commands/CommandRegistry';
import { CommandInput, CommandContext } from '../domain/commands/Command';
import { logger } from '../utils/logger';

export class CommandHandler {
  constructor(
    private commandRegistry: CommandRegistry,
    private eventBus: EventEmitter
  ) {
    this.setupEventHandlers();
  }
  
  private setupEventHandlers(): void {
    // Handle voice commands detected in sessions
    this.eventBus.on('voice.command.detected', async (data) => {
      await this.handleVoiceInput(
        data.text, 
        data.userId, 
        data.channelId, 
        data.sessionId
      );
    });
  }
  
  async handleVoiceInput(
    text: string, 
    userId: string, 
    channelId: string, 
    sessionId?: string
  ): Promise<void> {
    try {
      logger.info(`🎤 Handling voice input: "${text}" from user ${userId}`);
      
      const input = CommandInput.fromVoice(text, userId);
      const context = CommandContext.fromVoice(userId, channelId, sessionId);
      
      const result = await this.commandRegistry.executeCommand(input, context);
      
      if (result.success) {
        logger.info(`🎤 Voice command executed successfully: ${result.response}`);
      } else {
        logger.info(`🎤 Voice command not recognized: ${result.response}`);
        
        // For unrecognized voice commands, optionally provide feedback
        if (sessionId) {
          this.eventBus.emit('tts.request', {
            text: result.response,
            channelId,
            userId,
            priority: 'normal'
          });
        }
      }
    } catch (error) {
      logger.error('Error handling voice input:', error);
    }
  }
  
  async handleSlashCommand(interaction: CommandInteraction): Promise<void> {
    try {
      logger.info(`⚡ Handling slash command: /${interaction.commandName}`);
      
      const input = this.commandRegistry.detectCommandFromSlash(
        interaction.commandName,
        this.extractOptionsFromInteraction(interaction),
        interaction.user.id
      );
      
      const context = CommandContext.fromSlash(
        interaction.user.id,
        interaction.channelId!,
        this.extractOptionsFromInteraction(interaction)
      );
      
      const result = await this.commandRegistry.executeCommand(input, context);
      
      // Send response to Discord
      await interaction.followUp(result.response);
      
      if (result.success) {
        logger.info(`⚡ Slash command executed successfully: ${result.response}`);
      } else {
        logger.error(`⚡ Slash command failed: ${result.response}`);
      }
    } catch (error) {
      logger.error('Error handling slash command:', error);
      
      try {
        await interaction.followUp('An error occurred while processing your command. Please try again.');
      } catch (followUpError) {
        logger.error('Error sending error response:', followUpError);
      }
    }
  }
  
  private extractOptionsFromInteraction(interaction: CommandInteraction): Record<string, any> {
    const options: Record<string, any> = {};
    
    // Extract options from Discord interaction
    if (interaction.options) {
      // Handle different option types
      for (const option of interaction.options.data) {
        options[option.name] = option.value;
      }
    }
    
    return options;
  }
}