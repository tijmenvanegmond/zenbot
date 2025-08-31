import { FastifyInstance } from "fastify";
import { Client, TextChannel } from "discord.js";

export default async function guildsRoutes(fastify: FastifyInstance, { discordClient }: { discordClient: Client }) {
  // Get bot status and guild info
  fastify.get("/status", async function handler(request, reply) {
    const guilds = discordClient.guilds.cache.map(guild => ({
      id: guild.id,
      name: guild.name,
      memberCount: guild.memberCount,
      voiceConnections: 0
    }));
    
    reply.send({
      bot: {
        username: discordClient.user?.username,
        id: discordClient.user?.id,
        uptime: discordClient.uptime,
        ping: discordClient.ws.ping
      },
      guilds,
      totalGuilds: discordClient.guilds.cache.size
    });
  });

  // Get available commands
  fastify.get("/commands", async function handler(request, reply) {
    const { CommandCollection } = await import("../../commands/commandCollection.js");
    const commands = CommandCollection.map((cmd: any) => ({
      name: cmd.data.name,
      description: cmd.data.description,
      options: cmd.data.options
    }));
    reply.send({ commands });
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
      .filter(channel => channel.type === 0) // GUILD_TEXT = 0
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
}