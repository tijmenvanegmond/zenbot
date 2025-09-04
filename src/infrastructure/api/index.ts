import { FastifyInstance } from "fastify";
import { Client } from "discord.js";
import { ZenbotOrchestrator } from "../../application/ZenbotOrchestrator";
import { ModernCommandCollection } from "../slashCommands/ModernCommandCollection";
import guildsRoutes from "./routes/guilds";
import voiceRoutes from "./routes/voice";
import commandsRoutes from "./routes/commands";
import quotesRoutes from "./routes/quotes";

export async function registerApiRoutes(
  fastify: FastifyInstance, 
  discordClient: Client, 
  orchestrator?: ZenbotOrchestrator, 
  slashCommands?: ModernCommandCollection
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
  await fastify.register((fastify, opts, done) => guildsRoutes(fastify, { discordClient, orchestrator }, done));
  await fastify.register((fastify, opts, done) => voiceRoutes(fastify, { discordClient, orchestrator }, done));
  await fastify.register((fastify, opts, done) => commandsRoutes(fastify, { discordClient, orchestrator, slashCommands }, done));
  await fastify.register((fastify, opts, done) => quotesRoutes(fastify, { discordClient, orchestrator }, done));
}