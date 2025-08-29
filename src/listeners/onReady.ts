import { Client, Events } from "discord.js";
import { CommandCollection } from "../commands/commandCollection";

export default (client: Client): void => {
  client.on(Events.ClientReady, async () => {
    if (!client.user || !client.application) {
      return;
    }

    try {
      await client.application.commands.set(
        CommandCollection.map((c) => c.data),
      );
      console.log(`🧘 Commands flow like the Iris... ${client.user.username} has achieved digital enlightenment`);
    } catch (error) {
      console.error("🚨 The path to command harmony has been disrupted!");
      throw error;
    }
  });
};
