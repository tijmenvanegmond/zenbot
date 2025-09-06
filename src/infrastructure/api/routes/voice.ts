import { FastifyInstance } from "fastify";
import { Client, VoiceChannel } from "discord.js";
import { joinVoiceChannel, getVoiceConnection } from "@discordjs/voice";
import { VoiceService } from "../../../services/voiceService";
import { GuildService } from "../../../services/guildService";
import { logger } from "../../../utils/logger";
import { CHANNEL_TYPES } from "../../../config";

export default async function voiceRoutes(fastify: FastifyInstance, { discordClient }: { discordClient: Client }) {
  
  // Voice Channel Discovery - List all voice channels in guild
  fastify.get("/guilds/:guildId/voice-channels", async function handler(request: any, reply) {
    const { guildId } = request.params;
    
    const guild = GuildService.findGuild(discordClient, guildId);
    if (!guild) {
      reply.code(404).send({ error: "Guild not found" });
      return;
    }
    
    const voiceChannels = GuildService.getVoiceChannels(guild);
    reply.send({ voiceChannels });
  });

  // Get voice channels with active users
  fastify.get("/guilds/:guildId/voice-channels/active", async function handler(request: any, reply) {
    const { guildId } = request.params;
    
    const guild = GuildService.findGuild(discordClient, guildId);
    if (!guild) {
      reply.code(404).send({ error: "Guild not found" });
      return;
    }
    
    const activeChannels = GuildService.getActiveVoiceChannels(guild);
    reply.send({ activeChannels });
  });

  // Get members in specific voice channel
  fastify.get("/guilds/:guildId/voice-channels/:channelId/members", async function handler(request: any, reply) {
    const { guildId, channelId } = request.params;
    
    const guild = GuildService.findGuild(discordClient, guildId);
    if (!guild) {
      reply.code(404).send({ error: "Guild not found" });
      return;
    }
    
    const members = GuildService.getVoiceChannelMembers(guild, channelId);
    if (members === null) {
      reply.code(404).send({ error: "Voice channel not found" });
      return;
    }
    
    const voiceChannel = GuildService.findVoiceChannel(guild, channelId)!;
    
    reply.send({ 
      channel: {
        id: voiceChannel.id,
        name: voiceChannel.name
      },
      members,
      memberCount: members.length
    });
  });

  // Voice Channel Operations
  // Bot joins voice channel
  fastify.post("/guilds/:guildId/voice-channels/:channelId/join", async function handler(request: any, reply) {
    const { guildId, channelId } = request.params;
    
    const guild = discordClient.guilds.cache.get(guildId);
    if (!guild) {
      reply.code(404).send({ error: "Guild not found" });
      return;
    }
    
    const channel = guild.channels.cache.get(channelId);
    if (!channel || channel.type !== CHANNEL_TYPES.GUILD_VOICE) {
      reply.code(404).send({ error: "Voice channel not found" });
      return;
    }
    
    try {
      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
      });
      
      logger.info(`API: Bot joined voice channel: ${channel.name}`);
      
      reply.send({ 
        success: true,
        message: `Bot joined voice channel: ${channel.name}`,
        channel: {
          id: channel.id,
          name: channel.name
        }
      });
    } catch (error: any) {
      logger.error(`Error joining voice channel:`, error);
      reply.code(500).send({ 
        error: "Failed to join voice channel", 
        details: error.message 
      });
    }
  });

  // Bot leaves voice channel
  fastify.post("/guilds/:guildId/voice-channels/:channelId/leave", async function handler(request: any, reply) {
    const { guildId, channelId } = request.params;
    
    const guild = discordClient.guilds.cache.get(guildId);
    if (!guild) {
      reply.code(404).send({ error: "Guild not found" });
      return;
    }
    
    const connection = getVoiceConnection(guildId);
    if (!connection) {
      reply.code(400).send({ error: "Bot is not connected to any voice channel in this guild" });
      return;
    }
    
    try {
      connection.disconnect();
      connection.destroy();
      
      logger.info(`API: Bot left voice channel in guild: ${guild.name}`);
      
      reply.send({ 
        success: true,
        message: "Bot left voice channel",
        guild: guild.name
      });
    } catch (error: any) {
      logger.error(`Error leaving voice channel:`, error);
      reply.code(500).send({ 
        error: "Failed to leave voice channel", 
        details: error.message 
      });
    }
  });

  // Get channel bot is currently in
  fastify.get("/guilds/:guildId/voice-channels/current", async function handler(request: any, reply) {
    const { guildId } = request.params;
    
    const guild = discordClient.guilds.cache.get(guildId);
    if (!guild) {
      reply.code(404).send({ error: "Guild not found" });
      return;
    }
    
    const connection = getVoiceConnection(guildId);
    if (!connection) {
      reply.send({ 
        connected: false,
        channel: null 
      });
      return;
    }
    
    const currentChannel = guild.channels.cache.get(connection.joinConfig.channelId!);
    
    reply.send({ 
      connected: true,
      channel: currentChannel ? {
        id: currentChannel.id,
        name: currentChannel.name,
        memberCount: (currentChannel as VoiceChannel).members.size
      } : null
    });
  });

  // TTS Operations
  // Play TTS in specific channel
  fastify.post("/guilds/:guildId/voice-channels/:channelId/tts", async function handler(request: any, reply) {
    const { guildId, channelId } = request.params;
    const { text, voice = "nova" } = request.body;
    
    if (!text) {
      reply.code(400).send({ error: "Text is required" });
      return;
    }
    
    const guild = discordClient.guilds.cache.get(guildId);
    if (!guild) {
      reply.code(404).send({ error: "Guild not found" });
      return;
    }
    
    const channel = guild.channels.cache.get(channelId);
    if (!channel || channel.type !== CHANNEL_TYPES.GUILD_VOICE) {
      reply.code(404).send({ error: "Voice channel not found" });
      return;
    }
    
    try {
      // Play TTS directly in voice channel
      await VoiceService.playTTSInChannel(channel as VoiceChannel, text);
      
      logger.info(`API: TTS played in ${channel.name}: "${text}"`);
      
      reply.send({ 
        success: true,
        message: `TTS played in voice channel: ${channel.name}`,
        text,
        channel: {
          id: channel.id,
          name: channel.name
        }
      });
    } catch (error: any) {
      logger.error(`Error playing TTS:`, error);
      reply.code(500).send({ 
        error: "Failed to play TTS", 
        details: error.message 
      });
    }
  });

  // Play TTS in bot's current channel (if connected)
  fastify.post("/guilds/:guildId/tts", async function handler(request: any, reply) {
    const { guildId } = request.params;
    const { text, voice = "nova" } = request.body;
    
    if (!text) {
      reply.code(400).send({ error: "Text is required" });
      return;
    }
    
    const guild = discordClient.guilds.cache.get(guildId);
    if (!guild) {
      reply.code(404).send({ error: "Guild not found" });
      return;
    }
    
    const connection = getVoiceConnection(guildId);
    if (!connection) {
      reply.code(400).send({ error: "Bot is not connected to any voice channel in this guild" });
      return;
    }
    
    const currentChannel = guild.channels.cache.get(connection.joinConfig.channelId!);
    if (!currentChannel) {
      reply.code(404).send({ error: "Current voice channel not found" });
      return;
    }
    
    try {
      // Play TTS directly in current voice channel
      await VoiceService.playTTSInChannel(currentChannel as VoiceChannel, text);
      
      logger.info(`API: TTS played in current channel ${currentChannel.name}: "${text}"`);
      
      reply.send({ 
        success: true,
        message: `TTS played in current voice channel: ${currentChannel.name}`,
        text,
        channel: {
          id: currentChannel.id,
          name: currentChannel.name
        }
      });
    } catch (error: any) {
      logger.error(`Error playing TTS:`, error);
      reply.code(500).send({ 
        error: "Failed to play TTS", 
        details: error.message 
      });
    }
  });

  // Get available TTS voices (static list for now)
  fastify.get("/tts/voices", async function handler(request: any, reply) {
    const voices = [
      { id: "alloy", name: "Alloy", description: "Neutral and balanced" },
      { id: "echo", name: "Echo", description: "Clear and articulate" },
      { id: "fable", name: "Fable", description: "Warm and expressive" },
      { id: "onyx", name: "Onyx", description: "Deep and resonant" },
      { id: "nova", name: "Nova", description: "Bright and energetic (default)" },
      { id: "shimmer", name: "Shimmer", description: "Gentle and soothing" }
    ];
    
    reply.send({ voices });
  });
}