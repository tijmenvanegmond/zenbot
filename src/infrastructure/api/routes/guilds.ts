import { FastifyInstance } from "fastify";
import { Client, TextChannel } from "discord.js";
import { GuildService } from "../../../infrastructure/services/guildService";
import { CHANNEL_TYPES } from "../../../config";
import { ZenbotOrchestrator } from "../../../application/ZenbotOrchestrator";
import { ModernCommandCollection } from "../../slashCommands/ModernCommandCollection";

export default async function guildsRoutes(
  fastify: FastifyInstance, 
  { discordClient, orchestrator }: { 
    discordClient: Client, 
    orchestrator?: ZenbotOrchestrator,
  }, 
  done?: Function
) {
  // Get bot status and guild info
  fastify.get("/status", async function handler(request, reply) {
    const status = GuildService.getBotStatus(discordClient);
    reply.send(status);
  });


  // List all text channels in guild - discover channels of wisdom
  fastify.get("/guilds/:guildId/text-channels", async function handler(request: any, reply) {
    const { guildId } = request.params;
    
    const guild = discordClient.guilds.cache.get(guildId);
    if (!guild) {
      reply.code(404).send({ error: "Guild not found" });
      return;
    }
    
    const textChannels = guild.channels.cache
      .filter(channel => channel.type === CHANNEL_TYPES.GUILD_TEXT)
      .map(channel => {
        const textChannel = channel as TextChannel;
        return {
          id: textChannel.id,
          name: textChannel.name,
          topic: textChannel.topic,
          nsfw: textChannel.nsfw,
          position: textChannel.position
        };
      });
    
    reply.send({ 
      textChannels,
      count: textChannels.length,
      guild: {
        id: guild.id,
        name: guild.name
      },
      wisdom: "Many paths of communication flow through these channels"
    });
  });
  
  // Call done if provided (Fastify callback pattern)
  if (done) done();
}