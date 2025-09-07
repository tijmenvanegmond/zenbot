import { Client, Events } from "discord.js";
import { CommandCollectionWithAssistant } from "../commands/commandCollection_with_assistant";
import { AssistantInitializer } from "../services/assistantInitializer";
import { logger } from "../utils/logger";

export default (client: Client): void => {
  client.on(Events.ClientReady, async () => {
    if (!client.user || !client.application) {
      return;
    }

    try {
      // Register Discord commands (including new assistant ones)
      await client.application.commands.set(
        CommandCollectionWithAssistant.map((c) => c.data),
      );
      logger.info(
        `Commands flow like the Iris... ${client.user.username} has achieved digital enlightenment`,
      );

      // Initialize AI Assistant
      logger.info("🧘 Initializing AI consciousness...");
      await AssistantInitializer.initializeAssistants();
    } catch (error) {
      logger.error("The path to command harmony has been disrupted!");
      throw error;
    }
  });
};
