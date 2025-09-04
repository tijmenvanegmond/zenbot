import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { VoiceSlashCommand } from "./BaseSlashCommand";

/**
 * Listen slash command using the new base class structure
 * Starts listening for voice commands in the user's voice channel
 */
export class ListenSlashCommand extends VoiceSlashCommand {
  readonly name = "listen";
  readonly description = "Start listening for voice commands in your voice channel";

  protected buildCommandData() {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addNumberOption(option =>
        option
          .setName("time")
          .setDescription("Listening duration in minutes (default: 1)")
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(60)
      );
  }

  protected async handleVoiceCommand(
    interaction: CommandInteraction,
    validation: any
  ): Promise<void> {
    const time = interaction.options.get("time")?.value as number || 1;
    
    try {
      const result = await this.executeDomainCommand(
        "listen",
        interaction.user.id,
        interaction.channelId!,
        { time }
      );

      if (result.success) {
        await interaction.followUp({
          content: `🎧 ${result.response}`,
          ephemeral: true
        });
      } else {
        await interaction.followUp(result.response);
      }
    } catch (error) {
      throw error; // Let base class handle the error
    }
  }
}
