import { FastifyInstance } from "fastify";
import { Client, VoiceChannel } from "discord.js";
import { joinVoiceChannel, getVoiceConnection } from "@discordjs/voice";
import { VoiceService } from "../../services/voiceService";
import { GuildService } from "../../services/guildService";
import { logger } from "../../../utils/logger";
import { CHANNEL_TYPES } from "../../../config";
import { ZenbotOrchestrator } from "../../../application/ZenbotOrchestrator";
import { CommandInput, CommandContext } from "../../../domain/commands/Command";
import { TTSCommand } from "src/domain/commands/TTSCommand";

export default async function voiceRoutes(fastify: FastifyInstance, { discordClient, orchestrator }: { discordClient: Client, orchestrator?: ZenbotOrchestrator }, done?: Function) {
  
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
  // Bot joins voice channel and starts listening (using hybrid system)
  fastify.post("/guilds/:guildId/voice-channels/:channelId/join", async function handler(request: any, reply) {
    const { guildId, channelId } = request.params;
    const { duration = 60 } = request.body || {}; // Default 60 minutes
    
    if (!orchestrator) {
      reply.code(500).send({ error: "Orchestrator not available - hybrid system not initialized" });
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
      // Use the hybrid system's CommandHandler - same logic as /listen slash command!
      const result = await orchestrator.getCommandHandler().executeCommandDirect(
        'listen',
        'api-user',
        channelId,
        { time: duration }
      );
      
      if (result.success) {
        logger.info(`API: Bot joined and listening in voice channel: ${channel.name} for ${duration} minutes`);
        
        reply.send({ 
          success: true,
          message: `Bot joined voice channel and started listening: ${channel.name}`,
          channel: {
            id: channel.id,
            name: channel.name
          },
          duration: duration,
          listeningActive: true
        });
      } else {
        reply.code(500).send({ 
          error: "Failed to start listening session", 
          details: result.response 
        });
      }
    } catch (error: any) {
      logger.error(`Error starting voice session:`, error);
      reply.code(500).send({ 
        error: "Failed to join voice channel and start listening", 
        details: error.message 
      });
    }
  });

  // Bot leaves voice channel (using hybrid system)
  fastify.post("/guilds/:guildId/voice-channels/:channelId/leave", async function handler(request: any, reply) {
    const { guildId, channelId } = request.params;
    
    if (!orchestrator) {
      reply.code(500).send({ error: "Orchestrator not available - hybrid system not initialized" });
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
    
    try {
      // Use the hybrid system's FarewellCommand - same logic as "goodbye" voice command!
      const result = await orchestrator.getCommandHandler().executeCommandDirect(
        'farewell',
        'api-user',
        channelId,
        {}
      );
      
      if (result.success) {
        logger.info(`API: Bot leaving voice channel in guild: ${guild.name} using farewell command`);
        
        reply.send({ 
          success: true,
          message: "Bot leaving voice channel with farewell message",
          guild: guild.name,
          farewell: true
        });
      } else {
        // Fallback to direct disconnection if farewell command fails
        connection.disconnect();
        connection.destroy();
        
        reply.send({ 
          success: true,
          message: "Bot left voice channel (direct disconnect)",
          guild: guild.name,
          farewell: false
        });
      }
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
  // Play TTS in specific channel (using hybrid system)
  fastify.post("/guilds/:guildId/voice-channels/:channelId/tts", async function handler(request: any, reply) {
    const { guildId, channelId } = request.params;
    const { text, voice = "nova" } = request.body;
    
    if (!text) {
      reply.code(400).send({ error: "Text is required" });
      return;
    }
    
    if (!orchestrator) {
      reply.code(500).send({ error: "Orchestrator not available - hybrid system not initialized" });
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
      // Use the hybrid system's TTSCommand - same logic as internal TTS calls!
      const result = await orchestrator.getCommandHandler().executeCommandDirect(
        'tts',
        'api-user',
        channelId,
        { text, channelId }
      );
      
      if (result.success) {
        logger.info(`API: TTS queued via hybrid system in ${channel.name}: "${text}"`);
        
        reply.send({ 
          success: true,
          message: `TTS queued in voice channel: ${channel.name}`,
          text,
          channel: {
            id: channel.id,
            name: channel.name
          },
          hybrid: true
        });
      } else {
        reply.code(500).send({ 
          error: "Failed to queue TTS", 
          details: result.response 
        });
      }
    } catch (error: any) {
      logger.error(`Error playing TTS via hybrid system:`, error);
      reply.code(500).send({ 
        error: "Failed to play TTS", 
        details: error.message 
      });
    }
  });

  // Play TTS in bot's current channel (using hybrid system)
  fastify.post("/guilds/:guildId/tts", async function handler(request: any, reply) {
    const { guildId } = request.params;
    const { text } = request.body;
    
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

    if(!orchestrator) {
      reply.code(500).send({ error: "Orchestrator not available - hybrid system not initialized" });
      return;
    }

    try {
      // Use the hybrid system's TTSCommand - same logic as internal TTS calls!
      const result = await orchestrator.getCommandRegistry().executeCommand(
        new TTSCommand({
          text
        })
      );

      if (result.success) {
        logger.info(`API: TTS queued via hybrid system in current channel ${currentChannel.name}: "${text}"`);
        
        reply.send({ 
          success: true,
          message: `TTS queued in current voice channel: ${currentChannel.name}`,
          text,
          channel: {
            id: currentChannel.id,
            name: currentChannel.name
          },
          hybrid: true
        });
      } else {
        reply.code(500).send({ 
          error: "Failed to queue TTS", 
          details: result.response 
        });
      }
    } catch (error: any) {
      logger.error(`Error playing TTS via hybrid system:`, error);
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
  
  // Call done if provided (Fastify callback pattern)
  if (done) done();
}