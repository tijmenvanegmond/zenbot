import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { BaseSlashCommand } from "./BaseSlashCommand";

/**
 * Rename slash command using the new base class structure
 * Allows changing Zenyatta's display name in the server
 */
export class RenameSlashCommand extends BaseSlashCommand {
  readonly name = "rename";
  readonly description = "Change Zenyatta's display name in this server";

  protected buildCommandData() {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addStringOption(option =>
        option
          .setName("name")
          .setDescription("New display name for Zenyatta")
          .setRequired(true)
          .setMaxLength(32)
      );
  }

  protected async handleCommand(interaction: CommandInteraction): Promise<void> {
    const newName = interaction.options.get("name")?.value as string;
    
    if (!newName?.trim()) {
      await interaction.followUp("Please provide a valid name for me to use.");
      return;
    }

    try {
      // Get the guild member (bot) and change nickname
      const guild = interaction.guild;
      if (!guild) {
        await interaction.followUp("This command can only be used in a server.");
        return;
      }

      const botMember = guild.members.me;
      if (!botMember) {
        await interaction.followUp("Unable to find my server information.");
        return;
      }

      const oldName = botMember.displayName;
      await botMember.setNickname(newName.trim());

      await interaction.followUp({
        content: `🧘 My essence has shifted. I was "${oldName}", now I am "${newName.trim()}". The path to enlightenment continues.`,
        ephemeral: true
      });

    } catch (error) {
      if (error instanceof Error && error.message.includes("Missing Permissions")) {
        await interaction.followUp("I lack the permissions to change my name. Please grant me the 'Change Nickname' permission.");
      } else {
        throw error; // Let base class handle other errors
      }
    }
  }
}
