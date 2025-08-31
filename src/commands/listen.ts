import {
  CommandInteraction,
  Client,
  VoiceChannel,
  SlashCommandBuilder,
} from "discord.js";
import { Command } from "./command";
import { joinVoiceChannel } from "@discordjs/voice";
import * as fs from "fs";
import { logger } from "../utils/logger";
import { validateVoiceChannel, createSuccessResponse } from "../utils/commandHelpers";

const OUTPUT_FILE = "listen-test.opus";

export const Listen: Command = {
  data: new SlashCommandBuilder()
    .setName("listen")
    .setDescription("listens to a voice channel"),

  execute: async (client: Client, interaction: CommandInteraction) => {
    const validation = validateVoiceChannel(interaction);
    if (!validation.isValid) {
      return await interaction.followUp(validation.response!);
    }

    const voiceChannel = validation.member!.voice.channel as VoiceChannel;

    logger.info(`Joining voice channel ${voiceChannel.name} to listen`);

    ListenToVoiceChannel(client, voiceChannel);

    await interaction.followUp(
      createSuccessResponse(`Listening to voice channel ${voiceChannel.name}`)
    );
  },
};

async function ListenToVoiceChannel(
  client: Client,
  voiceChannel: VoiceChannel,
  fileName = OUTPUT_FILE,
) {
  const connection = joinVoiceChannel({
    selfDeaf: false,
    channelId: voiceChannel.id,
    guildId: voiceChannel.guildId,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
  });

  let reciever = connection.receiver;

  let audioStreamCollection: Buffer[] = [];

  reciever.speaking.on("start", (userId) => {
    logger.info(`User ${userId} started speaking`);
    let audioStream = reciever.subscribe(userId);
    audioStream.on("data", (data) => {
      audioStreamCollection.push(data);
    });
  });

  reciever.speaking.on("end", (userId) => {
    var writeStream = fs.createWriteStream(process.cwd() + "/" + fileName, {
      flags: "a",
    });

    logger.info(`User ${userId} stopped speaking`);

    const audioBuffer = audioStreamCollection[1];
    writeStream.write(audioBuffer);
    // for (let i = 0; i < audioStreamCollection.length; i++) {
    //   const audioBuffer = audioStreamCollection[i];
    //   writeStream.write(audioBuffer);
    // }

    writeStream.end();
    logger.info(`Audio file ${fileName} saved successfully`);
  });
}
