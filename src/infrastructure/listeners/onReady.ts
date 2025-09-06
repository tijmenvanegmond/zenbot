import { Client, Events } from "discord.js";
import { CommandCollection } from "../../commands/commandCollection";
import { logger } from "../../utils/logger";

export default (client: Client): void => {
  client.on(Events.ClientReady, async () => {
    if (!client.user || !client.application) {
      return;
    }

    try {
      await client.application.commands.set(
        CommandCollection.map((c) => c.data),
      );
      logger.info(`Commands flow like the Iris... ${client.user.username} has achieved digital enlightenment`);
    } catch (error) {
      logger.error("The path to command harmony has been disrupted!");
      throw error;
    }
  });
};
