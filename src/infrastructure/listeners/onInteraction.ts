import { CommandInteraction, Client, BaseInteraction } from "discord.js";
import { logger } from "../../utils/logger";
import { ModernCommandCollection } from "../slashCommands/ModernCommandCollection";

export default( client: Client, commandCollection: ModernCommandCollection): void => {
  client.on("interactionCreate", async (interaction: BaseInteraction) => {
    if (interaction.isCommand() || interaction.isAnySelectMenu()) {
      await handleSlashCommand(interaction as CommandInteraction, commandCollection);
    }
  });
};

const handleSlashCommand = async (
  interaction: CommandInteraction,
  commandCollection: ModernCommandCollection
): Promise<void> => {
  logger.info(
    `⚡ Handling slash command: /${interaction.commandName}`,
  );

  // Defer the reply to give us time to process
  await interaction.deferReply({ ephemeral: true });

  try {
    // Use the new domain command system
    const result = await commandCollection.handleInteraction(interaction);
    
    if (result.success) {
      await interaction.followUp({
        content: result.response,
        ephemeral: true
      });
    } else {
      await interaction.followUp({
        content: `❌ ${result.response}`,
        ephemeral: true
      });
    }
  } catch (error) {
    logger.error('Error handling slash command:', error);
    await interaction.followUp({
      content: '🚨 The path to command execution encountered a disturbance. Please try again.',
      ephemeral: true
    });
  }
};
