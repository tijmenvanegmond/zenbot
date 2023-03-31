import { Client } from "discord.js";
import { CommandCollection } from "../commands/commandCollection";

export default (client: Client): void => {
    client.on("ready", async () => {
        if (!client.user || !client.application) {
            return;
        }
        await client.application.commands.set(CommandCollection);

        console.log(`Commands set, ${client.user.username} is online`);
    });
}; 