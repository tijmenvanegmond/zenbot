import { Client, Events } from "discord.js";
import { logger } from "../../utils/logger";
import { ModernCommandCollection } from "../slashCommands/ModernCommandCollection";

export default (client: Client, commands: ModernCommandCollection): void => {
  client.on(Events.ClientReady, async () => {
    if (!client.user || !client.application) {
      return;
    }

    try {
      await client.application.commands.set(
        commands.getCommandData()
      );
      logger.info(`Commands flow like the Iris... ${client.user.username} has achieved digital enlightenment`);
    } catch (error) {
      logger.error("The path to command harmony has been disrupted!");
      throw error;
    }
  });
};
