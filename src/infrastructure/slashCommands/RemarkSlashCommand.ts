import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { VoiceSlashCommand } from "./BaseSlashCommand";

/**
 * Remark slash command using the new base class structure
 * Allows Zenyatta to make contextual remarks
 */
export class RemarkSlashCommand extends VoiceSlashCommand {
  readonly name = "remark";
  readonly description = "Have Zenyatta make a contextual remark in your voice channel";

  protected buildCommandData() {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addStringOption(option =>
        option
          .setName("topic")
          .setDescription("Topic for the remark")
          .setRequired(false)
          .addChoices(
            { name: "Current Situation", value: "current" },
            { name: "Team Harmony", value: "team" },
            { name: "Victory", value: "victory" },
            { name: "Defeat", value: "defeat" },
            { name: "Random Observation", value: "random" }
          )
      );
  }

  protected async handleVoiceCommand(
    interaction: CommandInteraction,
    validation: any
  ): Promise<void> {
    const topic = interaction.options.get("topic")?.value as string || "random";
    
    try {
      // For now, delegate to TTS with a philosophical remark
      // In the future, this could have its own domain command
      const remarks = {
        current: "Observe the present moment. In it lies infinite possibility.",
        team: "Harmony flows when individual strengths unite as one.",
        victory: "Victory is not the end, but a step along the path.",
        defeat: "From every defeat comes wisdom. Embrace the lesson.",
        random: "The universe conspires to teach us, if we have eyes to see."
      };

      const selectedRemark = remarks[topic as keyof typeof remarks] || remarks.random;

      const result = await this.executeDomainCommand(
        "tts",
        interaction.user.id,
        interaction.channelId!,
        { text: selectedRemark }
      );

      if (result.success) {
        await interaction.followUp({
          content: `🧘 Zenyatta remarks: "${selectedRemark}"`,
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
