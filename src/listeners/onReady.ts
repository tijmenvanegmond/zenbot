import { Client, Events } from "discord.js";
import { CommandCollection } from "../commands/commandCollection";

export default (client: Client): void => {
    client.on(Events.ClientReady, async () => {
        if (!client.user || !client.application) {
            return;
        }

        try {
            await client.application.commands.set(CommandCollection.map(c => c.data));
            console.log(`Commands registered, ${client.user.username} is online`);
        } catch (error) {
            console.error('Failed to register commands!');
            throw error;
        }


    });
}; 