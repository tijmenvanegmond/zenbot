import { CommandInteraction, Client, BaseInteraction, InteractionType } from "discord.js";
import { CommandCollection } from "../commands/commandCollection";
import { logger } from "../utils/logger";

export default (client: Client): void => {
  client.on("interactionCreate", async (interaction: BaseInteraction) => {
    try {
      // Only handle chat input (slash) commands
      if (interaction.type === InteractionType.ApplicationCommand && interaction.isChatInputCommand()) {
        await handleSlashCommand(client, interaction as CommandInteraction);
      }
    } catch (err) {
      logger.error("Unhandled error in interactionCreate listener:", err);
    }
  });
};

const handleSlashCommand = async (
  client: Client,
  interaction: CommandInteraction,
): Promise<void> => {
  try {
    logger.info(
      `${interaction.member?.user.username} triggered command: ${interaction.commandName}`,
    );
    const slashCommand = CommandCollection.find(
      (c) => c.data.name === interaction.commandName,
    );
    if (!slashCommand) {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({ content: "Unknown command.", ephemeral: true });
      }
      return;
    }
    
    // Prevent double acknowledgement
    if (!interaction.deferred && !interaction.replied) {
      try {
        await interaction.deferReply({ ephemeral: true });
      } catch (deferErr: any) {
        // If the interaction is unknown already, bail early
        if (deferErr?.code === 10062) {
          logger.warn("⚠️ Interaction became unknown before defer (possibly timed out). Skipping execution.");
          return;
        }
        throw deferErr;
      }
    }

    await slashCommand.execute(client, interaction);
  } catch (error) {
    logger.error(
      `Error handling slash command ${interaction.commandName}:`,
      error,
    );
    
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: "An error occurred while processing this command.",
        });
      } else {
        try {
          await interaction.reply({
            content: "An error occurred while processing this command.",
            ephemeral: true,
          });
        } catch (secondaryError: any) {
          if (secondaryError?.code === 10062) {
            logger.warn("⚠️ Could not send error reply: interaction unknown (timeout)." );
          } else if (secondaryError?.code === 40060) {
            logger.warn("⚠️ Interaction already acknowledged while sending error reply.");
          } else {
            logger.error("Failed secondary error reply:", secondaryError);
          }
        }
      }
    } catch (replyError) {
      logger.error("Failed to send error response:", replyError);
    }
  }
};
