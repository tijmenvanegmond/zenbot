import { Client, VoiceChannel, TextChannel, EmbedBuilder } from 'discord.js';
import { VoiceService } from '../../services/voiceService';
import { VoiceLineData } from '../../types';
import { playResourceInChannel } from '../../utils/voiceHelpers';
import { Zenbot } from '../session/Zenbot';
import { logger } from '../../utils/logger';

/**
 * Interface for action execution data
 */
export interface ActionData {
  type: 'tts' | 'voice' | 'embed' | 'voiceLines' | 'channelRename';
  data: any;
}

/**
 * Context for action execution
 */
export interface ActionContext {
  client: Client;
  zenbot: Zenbot;
  sessionId: string;
  userId: string;
  guildId?: string;
  channelId?: string;
  voiceChannelId?: string;
}

/**
 * Handles execution of various zenbot actions
 */
export class ActionHandler {
  /**
   * Execute multiple actions from AI response
   */
  static async executeActions(actions: ActionData[], context: ActionContext): Promise<void> {
    for (const action of actions) {
      try {
        await this.executeAction(action, context);
        logger.debug(`Executed action: ${action.type}`);
      } catch (error) {
        logger.error(`Failed to execute action ${action.type}:`, error);
      }
    }
  }

  /**
   * Execute a single action
   */
  static async executeAction(action: ActionData, context: ActionContext): Promise<void> {
    switch (action.type) {
      case 'tts':
        await this.executeTTS(action.data, context);
        break;
        
      case 'voice':
        await this.executeVoiceLines(action.data, context);
        break;
        
      case 'embed':
        await this.executeEmbed(action.data, context);
        break;
        
      case 'voiceLines':
        await this.executeVoiceLines(action.data, context);
        break;
        
      case 'channelRename':
        await this.executeChannelRename(action.data, context);
        break;
        
      default:
        logger.warn(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Execute TTS action
   */
  private static async executeTTS(data: any, context: ActionContext): Promise<void> {
    if (!context.voiceChannelId) {
      logger.debug('No voice channel for TTS action');
      return;
    }

    const text = data.text || data.message || 'Experience tranquility';
    const voice = data.voice || 'echo';

    try {
      const guild = context.client.guilds.cache.get(context.guildId!);
      if (!guild) {
        logger.error('Guild not found for TTS action');
        return;
      }

      const voiceChannel = guild.channels.cache.get(context.voiceChannelId) as VoiceChannel;
      if (!voiceChannel) {
        logger.error('Voice channel not found for TTS action');
        return;
      }

      // Create TTS resource using existing voice service
      const voiceLine: VoiceLineData = { 
        text, 
        voiceUri: null, 
        length: text.length 
      };
      
      const resource = await VoiceService.createVoiceLineResource(voiceLine);
      await playResourceInChannel(voiceChannel, resource);
      
      logger.info(`🧘 TTS executed: "${text}" in ${voiceChannel.name}`);
      
    } catch (error) {
      logger.error('TTS execution failed:', error);
    }
  }

  /**
   * Execute voice lines action (for listen command)
   */
  private static async executeVoiceLines(data: any, context: ActionContext): Promise<void> {
    if (!context.voiceChannelId) {
      logger.debug('No voice channel for voice lines action');
      return;
    }

    try {
      // This would trigger the existing voice line system
      logger.info('🧘 Voice lines system activated');
      
      // Could play a greeting voice line or set up listening state
      const greetingText = data.greeting || "I will listen for wisdom in the silence.";
      await this.executeTTS({ text: greetingText }, context);
      
    } catch (error) {
      logger.error('Voice lines execution failed:', error);
    }
  }

  /**
   * Execute embed action (for quotes, etc.)
   */
  private static async executeEmbed(data: any, context: ActionContext): Promise<void> {
    if (!context.channelId) {
      logger.debug('No text channel for embed action');
      return;
    }

    try {
      const guild = context.client.guilds.cache.get(context.guildId!);
      if (!guild) {
        logger.error('Guild not found for embed action');
        return;
      }

      const channel = guild.channels.cache.get(context.channelId) as TextChannel;
      if (!channel) {
        logger.error('Text channel not found for embed action');
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(data.color || '#FFB347') // Zenyatta's orb color
        .setTitle(data.title || '🧘 Wisdom from Zenyatta')
        .setDescription(data.description || data.text || 'Experience tranquility')
        .setFooter({ text: data.footer || 'True self is without form' });

      if (data.author) {
        embed.setAuthor({ name: data.author });
      }

      await channel.send({ embeds: [embed] });
      logger.info(`🧘 Embed sent to ${channel.name}`);
      
    } catch (error) {
      logger.error('Embed execution failed:', error);
    }
  }

  /**
   * Execute channel rename action
   */
  private static async executeChannelRename(data: any, context: ActionContext): Promise<void> {
    if (!context.voiceChannelId) {
      logger.debug('No voice channel for rename action');
      return;
    }

    try {
      const guild = context.client.guilds.cache.get(context.guildId!);
      if (!guild) {
        logger.error('Guild not found for channel rename action');
        return;
      }

      const voiceChannel = guild.channels.cache.get(context.voiceChannelId) as VoiceChannel;
      if (!voiceChannel) {
        logger.error('Voice channel not found for rename action');
        return;
      }

      let newName = data.name || data.newName;
      
      // If no name provided, generate one using existing Zenbot logic
      if (!newName) {
        newName = context.zenbot.generateChannelName(voiceChannel);
      }

      await voiceChannel.setName(newName);
      logger.info(`🧘 Renamed voice channel to: "${newName}"`);
      
    } catch (error) {
      logger.error('Channel rename execution failed:', error);
    }
  }
}