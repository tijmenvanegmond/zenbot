import { FastifyInstance } from "fastify";
import { Client } from "discord.js";

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
}