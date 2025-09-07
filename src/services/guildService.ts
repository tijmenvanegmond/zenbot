import {
  Client,
  Guild,
  TextChannel,
  VoiceChannel,
  GuildMember,
  Channel,
} from "discord.js";
import { logger } from "../utils/logger";
import { CHANNEL_TYPES } from "../config";
import {
  GuildInfo,
  TextChannelInfo,
  VoiceChannelInfo,
  MemberInfo,
  BotStatus,
} from "../types";

/**
 * Service for Discord Guild and Channel operations
 * Handles guild discovery, channel management, and member operations
 */
export class GuildService {
  /**
   * Gets comprehensive bot status with guild information
   */
  static getBotStatus(client: Client): BotStatus {
    const guilds = client.guilds.cache.map((guild) => ({
      id: guild.id,
      name: guild.name,
      memberCount: guild.memberCount,
      voiceConnections: 0, // TODO: Track actual voice connections
    }));

    return {
      bot: {
        username: client.user?.username,
        id: client.user?.id,
        uptime: client.uptime,
        ping: client.ws.ping,
      },
      guilds,
      totalGuilds: client.guilds.cache.size,
    };
  }

  /**
   * Finds guild by ID with error handling
   */
  static findGuild(client: Client, guildId: string): Guild | null {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      logger.warn(`Guild not found: ${guildId}`);
      return null;
    }
    return guild;
  }

  /**
   * Gets all text channels in a guild
   */
  static getTextChannels(guild: Guild): TextChannelInfo[] {
    const textChannels = guild.channels.cache
      .filter((channel) => channel.type === CHANNEL_TYPES.GUILD_TEXT)
      .map((channel) => {
        const textChannel = channel as TextChannel;
        return {
          id: textChannel.id,
          name: textChannel.name,
          topic: textChannel.topic,
          nsfw: textChannel.nsfw,
          position: textChannel.position,
        };
      })
      .sort((a, b) => a.position - b.position);

    logger.info(
      `Found ${textChannels.length} text channels in guild ${guild.name}`,
    );
    return textChannels;
  }

  /**
   * Gets all voice channels in a guild with member information
   */
  static getVoiceChannels(guild: Guild): VoiceChannelInfo[] {
    const voiceChannels = guild.channels.cache
      .filter((channel) => channel.type === CHANNEL_TYPES.GUILD_VOICE)
      .map((channel) => {
        const voiceChannel = channel as VoiceChannel;
        return {
          id: voiceChannel.id,
          name: voiceChannel.name,
          memberCount: voiceChannel.members.size,
          members: voiceChannel.members.map((member: GuildMember) => ({
            id: member.id,
            username: member.user.username,
            displayName: member.displayName,
          })),
        };
      });

    logger.info(
      `Found ${voiceChannels.length} voice channels in guild ${guild.name}`,
    );
    return voiceChannels;
  }

  /**
   * Gets only voice channels that have active members
   */
  static getActiveVoiceChannels(guild: Guild): VoiceChannelInfo[] {
    const activeChannels = guild.channels.cache
      .filter((channel) => channel.type === CHANNEL_TYPES.GUILD_VOICE)
      .map((channel) => channel as VoiceChannel)
      .filter((voiceChannel) => voiceChannel.members.size > 0)
      .map((voiceChannel) => ({
        id: voiceChannel.id,
        name: voiceChannel.name,
        memberCount: voiceChannel.members.size,
        members: voiceChannel.members.map((member: GuildMember) => ({
          id: member.id,
          username: member.user.username,
          displayName: member.displayName,
        })),
      }));

    logger.info(
      `Found ${activeChannels.length} active voice channels in guild ${guild.name}`,
    );
    return activeChannels;
  }

  /**
   * Finds specific voice channel by ID
   */
  static findVoiceChannel(
    guild: Guild,
    channelId: string,
  ): VoiceChannel | null {
    const channel = guild.channels.cache.get(channelId);
    if (!channel || channel.type !== CHANNEL_TYPES.GUILD_VOICE) {
      logger.warn(
        `Voice channel not found: ${channelId} in guild ${guild.name}`,
      );
      return null;
    }
    return channel as VoiceChannel;
  }

  /**
   * Finds specific text channel by ID
   */
  static findTextChannel(guild: Guild, channelId: string): TextChannel | null {
    const channel = guild.channels.cache.get(channelId);
    if (!channel || channel.type !== CHANNEL_TYPES.GUILD_TEXT) {
      logger.warn(
        `Text channel not found: ${channelId} in guild ${guild.name}`,
      );
      return null;
    }
    return channel as TextChannel;
  }

  /**
   * Gets members in a specific voice channel
   */
  static getVoiceChannelMembers(
    guild: Guild,
    channelId: string,
  ): MemberInfo[] | null {
    const voiceChannel = this.findVoiceChannel(guild, channelId);
    if (!voiceChannel) {
      return null;
    }

    const members = voiceChannel.members.map((member: GuildMember) => ({
      id: member.id,
      username: member.user.username,
      displayName: member.displayName,
    }));

    logger.info(
      `Found ${members.length} members in voice channel ${voiceChannel.name}`,
    );
    return members;
  }

  /**
   * Validates if channel exists and is of correct type
   */
  static validateChannel(
    guild: Guild,
    channelId: string,
    expectedType:
      | typeof CHANNEL_TYPES.GUILD_TEXT
      | typeof CHANNEL_TYPES.GUILD_VOICE,
  ): Channel | null {
    const channel = guild.channels.cache.get(channelId);
    if (!channel || channel.type !== expectedType) {
      const typeStr =
        expectedType === CHANNEL_TYPES.GUILD_TEXT ? "text" : "voice";
      logger.warn(
        `Invalid ${typeStr} channel: ${channelId} in guild ${guild.name}`,
      );
      return null;
    }
    return channel;
  }

  /**
   * Comprehensive guild and channel finder with validation
   */
  static findGuildAndChannel<T extends Channel = Channel>(
    client: Client,
    guildId: string,
    channelId: string,
    channelType?:
      | typeof CHANNEL_TYPES.GUILD_TEXT
      | typeof CHANNEL_TYPES.GUILD_VOICE,
  ): { guild: Guild; channel: T } | null {
    const guild = this.findGuild(client, guildId);
    if (!guild) return null;

    const channel = channelType
      ? this.validateChannel(guild, channelId, channelType)
      : guild.channels.cache.get(channelId);

    if (!channel) return null;

    return { guild, channel: channel as T };
  }
}

// ===== CONVENIENCE EXPORTS =====
export const {
  getBotStatus,
  findGuild,
  getTextChannels,
  getVoiceChannels,
  getActiveVoiceChannels,
  findVoiceChannel,
  findTextChannel,
  getVoiceChannelMembers,
  validateChannel,
  findGuildAndChannel,
} = GuildService;
