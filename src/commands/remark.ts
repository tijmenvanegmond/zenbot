import {
  CommandInteraction,
  Client,
  VoiceChannel,
  SlashCommandBuilder,
} from "discord.js";
import { Command } from "./command";
import { RemarkService } from "../services/remarkService";
import { logger } from "../utils/logger";
import { validateVoiceChannel, getInteractionOptions, createErrorResponse } from "../utils/commandHelpers";
import { playTTSInChannel } from "../utils/voiceHelpers";

export const Remark: Command = {
  data: new SlashCommandBuilder()
    .setName("remark")
    .setDescription("A positive or Negative remark")
    .addBooleanOption((option) =>
      option.setName("positive").setDescription("Is the remark positive?"),
    )
    .addUserOption((option) =>
      option
        .setName("subject")
        .setDescription("Who is the subject of the remark?"),
    ),

  execute: async (client: Client, interaction: CommandInteraction) => {
    const validation = validateVoiceChannel(interaction);
    if (!validation.isValid) {
      return await interaction.followUp(validation.response!);
    }

    const options = getInteractionOptions(interaction);
    const isPositive = options.getBoolean("positive");
    const targetUser = options.getUser("subject");
    
    let text: string;
    if (isPositive) {
      text = await RemarkService.generatePraise(targetUser?.username);
    } else {
      text = await RemarkService.generateInsult(targetUser?.username);
    }

    const voiceChannel = validation.member!.voice.channel as VoiceChannel;

    try {
      await playTTSInChannel(voiceChannel, text);

      await interaction.followUp({
        ephemeral: true,
        content: `🎭 **Remark delivered:** ${text}`,
      });
    } catch (error) {
      logger.error("Error during remark execution:", error);
      await interaction.followUp(
        createErrorResponse("An error occurred while delivering the remark.")
      );
    }
  },
};
