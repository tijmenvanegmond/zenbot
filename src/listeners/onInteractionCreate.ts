import { CommandInteraction, Client, BaseInteraction } from "discord.js";
import { CommandCollection } from "../commands/commandCollection";

export default (client: Client): void => {
    client.on("interactionCreate", async (interaction: BaseInteraction) => {
        if (interaction.isCommand() || interaction.isAnySelectMenu()) {
            await handleSlashCommand(client, interaction as CommandInteraction);
        }
    });
};

const handleSlashCommand = async (client: Client, interaction: CommandInteraction): Promise<void> => {
    console.log(`${interaction.member?.user.username} triggered command:${interaction.commandName}`,);
    const slashCommand = CommandCollection.find(c => c.data.name === interaction.commandName);
    if (!slashCommand) {
        interaction.followUp({ content: "An error has occurred" });
        return;
    }

    await interaction.deferReply();
    slashCommand.execute(client, interaction);
}; 