import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { VoiceSlashCommand } from "./BaseSlashCommand";

/**
 * TTS slash command using the new base class structure
 */
export class TTSSlashCommand extends VoiceSlashCommand {
  readonly name = "tts";
  readonly description = "Have Zenyatta speak custom text in your voice channel";

  protected buildCommandData() {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addStringOption(option =>
        option
          .setName("text")
          .setDescription("The text for Zenyatta to speak")
          .setRequired(true)
          .setMaxLength(500)
      );
  }

  protected async handleVoiceCommand(
    interaction: CommandInteraction,
    validation: any
  ): Promise<void> {
    const text = interaction.options.get("text")?.value as string;
    
    if (!text?.trim()) {
      await interaction.followUp("Please provide text for me to speak.");
      return;
    }

    try {
      const result = await this.executeDomainCommand(
        "tts",
        interaction.user.id,
        interaction.channelId!,
        { 
          text: text.trim(),
          voiceChannel: validation.member!.voice.channel
        }
      );

      if (result.success) {
        await interaction.followUp({
          content: `🧘 Speaking: "${text.trim()}"`,
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
