import { CommandInteraction, Client, BaseInteraction } from "discord.js";
import { CommandCollectionWithAssistant } from "../commands/commandCollection_with_assistant";
import { logger } from "../utils/logger";

export default (client: Client): void => {
  client.on("interactionCreate", async (interaction: BaseInteraction) => {
    if (interaction.isCommand() || interaction.isAnySelectMenu()) {
      await handleSlashCommand(client, interaction as CommandInteraction);
    }
  });
};

const handleSlashCommand = async (
  client: Client,
  interaction: CommandInteraction,
): Promise<void> => {
  logger.info(
    `${interaction.member?.user.username} triggered command: ${interaction.commandName}`,
  );
  const slashCommand = CommandCollectionWithAssistant.find(
    (c) => c.data.name === interaction.commandName,
  );
  if (!slashCommand) {
    interaction.followUp({ content: "An error has occurred" });
    return;
  }

  await interaction.deferReply();
  await slashCommand.execute(client, interaction);
};
