import { FastifyInstance } from "fastify";
import { Client } from "discord.js";
import guildsRoutes from "./routes/guilds";
import voiceRoutes from "./routes/voice";
import commandsRoutes from "./routes/commands";
import quotesRoutes from "./routes/quotes";
import actionsRoutes from "./routes/actions";

export async function registerApiRoutes(
  fastify: FastifyInstance,
  discordClient: Client,
) {
  // Health check endpoint - the pulse of the Iris
  fastify.get("/", async function handler(request, reply) {
    reply
      .code(200)
      .header("Content-Type", "application/json; charset=utf-8")
      .send({
        numberOfGuilds: discordClient.guilds.cache.size,
        uptimeInSeconds: discordClient.uptime! / 1000,
        wisdom: "Experience tranquility",
      });
  });

  // Register route modules - like orbs of harmony, each serves its purpose
  await fastify.register(guildsRoutes, { discordClient });
  await fastify.register(voiceRoutes, { discordClient });
  await fastify.register(commandsRoutes, { discordClient });
  await fastify.register(quotesRoutes, { discordClient });
  await fastify.register(actionsRoutes, { discordClient });
}
