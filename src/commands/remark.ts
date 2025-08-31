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
    .setDescription("Generate a positive or negative remark about someone")
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("Type of remark")
        .setRequired(true)
        .addChoices(
          { name: '😊 Positive', value: 'positive' },
          { name: '😈 Negative', value: 'negative' }
        )
    )
    .addUserOption((option) =>
      option
        .setName("subject")
        .setDescription("Who is the subject of the remark?")
        .setRequired(false),
    ),

  execute: async (client: Client, interaction: CommandInteraction) => {
    const validation = validateVoiceChannel(interaction);
    if (!validation.isValid) {
      return await interaction.followUp(validation.response!);
    }

    const options = getInteractionOptions(interaction);
    const remarkType = options.getString("type");
    const targetUser = options.getUser("subject");
    
    let text: string;
    if (remarkType === "positive") {
      text = await RemarkService.generatePraise(targetUser?.username);
    } else {
      text = await RemarkService.generateInsult(targetUser?.username);
    }

    const voiceChannel = validation.member!.voice.channel as VoiceChannel;

    try {
      await playTTSInChannel(voiceChannel, text);

      const emoji = remarkType === "positive" ? "😊" : "😈";
      await interaction.followUp({
        ephemeral: true,
        content: `${emoji} **Remark delivered:** ${text}`,
      });
    } catch (error) {
      logger.error("Error during remark execution:", error);
      await interaction.followUp(
        createErrorResponse("An error occurred while delivering the remark.")
      );
    }
  },
};
