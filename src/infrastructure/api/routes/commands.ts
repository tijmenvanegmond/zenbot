import { FastifyInstance } from "fastify";
import { Client } from "discord.js";
import { logger } from "../../../utils/logger";
import { ZenbotOrchestrator } from "../../../application/ZenbotOrchestrator";
import { ModernCommandCollection } from "src/infrastructure/slashCommands/ModernCommandCollection";

export default async function commandsRoutes(fastify: FastifyInstance, { discordClient, orchestrator, slashCommands }: { discordClient: Client, orchestrator?: ZenbotOrchestrator, slashCommands?: ModernCommandCollection  }, done?: Function) {

    // Get available commands
    fastify.get("/commands", async function handler(request, reply) {
      const domainCommands = orchestrator?.getAvailableCommands() || [];
      const slashCommandsData = slashCommands?.getAvailableCommands() || [];
      
      reply.send({ 
        commands: {
          domain: domainCommands,
          slash: slashCommandsData,
          total: domainCommands.length + slashCommandsData.length
        }
      });
    });
  
    // Get detailed command information
    fastify.get("/commands/detailed", async function handler(request, reply) {
      const domainCommands = orchestrator?.getAvailableCommands() || [];
      const slashCommandsData = slashCommands?.getAvailableCommands() || [];
      
      reply.send({
        summary: {
          totalCommands: domainCommands.length + slashCommandsData.length,
          domainCommands: domainCommands.length,
          slashCommands: slashCommandsData.length
        },
        details: {
          domain: domainCommands.map(cmd => ({
            ...cmd,
            category: 'domain',
            integration: 'event-driven'
          })),
          slash: slashCommandsData.map(cmd => ({
            ...cmd,
            category: 'slash',
            integration: 'discord-native'
          }))
        },
        wisdom: "Through many forms does enlightenment flow - slash commands for immediate interaction, domain commands for deep processing"
      });
    });
  
  // Execute a command programmatically (requires guild and channel context)
  fastify.post("/execute/:commandName", async function handler(request: any, reply) {
    const { commandName } = request.params;
    const context = request.body;

    if (!context.guildId || !context.channelId) {
      reply.code(400).send({ error: "guildId and channelId are required" });
      return;
    }
    
    const command = slashCommands?.getCommandData().find(c => c.name === commandName);
    if (!command) {
      reply.code(404).send({ error: `Command '${commandName}' not found` });
      return;
    }

    const guild = discordClient.guilds.cache.get(context.guildId);
    if (!guild) {
      reply.code(404).send({ error: "Guild not found" });
      return;
    }

    const channel = guild.channels.cache.get(context.channelId);
    if (!channel) {
      reply.code(404).send({ error: "Channel not found" });
      return;
    }
    
    try {
      logger.info(`API triggered command: ${commandName} in guild: ${guild.name}`);
      if (!orchestrator) throw new Error("Orchestrator not initialized");

      const command = orchestrator?.getCommandRegistry().getCommand(commandName);

      if (!command) throw new Error(`Command '${commandName}' not found`);
      await command.execute(context)
      reply.send({ 
        success: true, 
        message: `Command '${commandName}' executed successfully`,
        guild: guild.name,
        channel: channel.name
      });
    } catch (error: any) {
      logger.error(`API command execution error:`, error);
      reply.code(500).send({ 
        error: "Command execution failed", 
        details: error.message 
      });
    }
  });
  
  // Call done if provided (Fastify callback pattern)
  if (done) done();
}