import { FastifyInstance } from "fastify";
import { Client } from "discord.js";
import { CommandCollection } from "../../commands/commandCollection";
import { logger } from "../../utils/logger";

export default async function commandsRoutes(
  fastify: FastifyInstance,
  { discordClient }: { discordClient: Client },
) {
  // Execute a command programmatically (requires guild and channel context)
  fastify.post(
    "/execute/:commandName",
    async function handler(request: any, reply) {
      const { commandName } = request.params;
      const {
        guildId,
        channelId,
        userId = "api-user",
        options = {},
      } = request.body;

      if (!guildId || !channelId) {
        reply.code(400).send({ error: "guildId and channelId are required" });
        return;
      }

      const command = CommandCollection.find(
        (c) => c.data.name === commandName,
      );
      if (!command) {
        reply.code(404).send({ error: `Command '${commandName}' not found` });
        return;
      }

      const guild = discordClient.guilds.cache.get(guildId);
      if (!guild) {
        reply.code(404).send({ error: "Guild not found" });
        return;
      }

      const channel = guild.channels.cache.get(channelId);
      if (!channel) {
        reply.code(404).send({ error: "Channel not found" });
        return;
      }

      // Create a mock interaction for API execution
      const mockInteraction = {
        commandName,
        options: {
          get: (name: string) => options[name],
          getString: (name: string) => options[name],
          getInteger: (name: string) => parseInt(options[name]),
          getBoolean: (name: string) => Boolean(options[name]),
          getUser: (name: string) => {
            // If it's a username string, try to find that user in the guild
            const userValue = options[name];
            if (typeof userValue === "string") {
              return guild.members.cache.find(
                (member) =>
                  member.displayName
                    .toLowerCase()
                    .includes(userValue.toLowerCase()) ||
                  member.user.username
                    .toLowerCase()
                    .includes(userValue.toLowerCase()),
              )?.user;
            }
            return userValue;
          },
        },
        guild,
        channel,
        user: { id: userId, username: "API User" },
        member: {
          user: { username: "API User" },
          voice: {
            channel: channel, // Simulate the API user being in the specified voice channel
            channelId: channel.id, // This is what validateVoiceChannel checks for
          },
        },
        deferReply: async () => {},
        followUp: async (content: any) => {
          logger.info(`API Command Response:`, content);
          return content;
        },
        reply: async (content: any) => {
          logger.info(`API Command Response:`, content);
          return content;
        },
      };

      try {
        logger.info(
          `API triggered command: ${commandName} in guild: ${guild.name}`,
        );
        await command.execute(discordClient, mockInteraction as any);
        reply.send({
          success: true,
          message: `Command '${commandName}' executed successfully`,
          guild: guild.name,
          channel: channel.name,
        });
      } catch (error: any) {
        logger.error(`API command execution error:`, error);
        reply.code(500).send({
          error: "Command execution failed",
          details: error.message,
        });
      }
    },
  );
}
