import {
  CommandInteraction,
  Client,
  GuildMember,
  VoiceChannel,
  SlashCommandBuilder,
  CommandInteractionOptionResolver,
} from "discord.js";
import { Command } from "./command";
import { joinVoiceChannel } from "@discordjs/voice";
import { OpusEncoder } from "@discordjs/opus";
import * as fs from "fs";

const OUTPUT_FILE = "listen-test.opus";

export const Listen: Command = {
  data: new SlashCommandBuilder()
    .setName("listen")
    .setDescription("listens to a voice channel"),

  execute: async (client: Client, interaction: CommandInteraction) => {
    const member = interaction?.member as GuildMember;

    if (!member?.voice?.channelId) {
      console.log("reply-ing in text");
      return await interaction.followUp({
        content: "You have to be in voice to use this",
        ephemeral: true,
      });
    }

    let options = interaction.options as CommandInteractionOptionResolver;

    console.log(`Joining voice-channel ${member.voice.channel?.name} to listen`);

    ListenToVoiceChannel(client, member.voice.channel as VoiceChannel);

    await interaction.followUp({
      ephemeral: true,
      content :`Attemting to Listen to Voice Channel ${member.voice.channel?.name}`
    });
  },
};

async function ListenToVoiceChannel(
  client: Client,
  voiceChannel: VoiceChannel,
  fileName = OUTPUT_FILE
) {
  const connection = joinVoiceChannel({
    selfDeaf: false,
    channelId: voiceChannel.id,
    guildId: voiceChannel.guildId,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
  });

  let reciever = connection.receiver;

  const encoder = new OpusEncoder(48000, 2);
  let audioStreamCollection: Buffer[] = [];

  reciever.speaking.on("start", (userId) => {
    console.log(`User ${userId} started speaking`);
    let audioStream = reciever.subscribe(userId);
    audioStream.on("data", (data) => {
      audioStreamCollection.push(data);
    });
  });

  reciever.speaking.on("end", (userId) => {

    var writeStream = fs.createWriteStream(process.cwd() + "/" + fileName, {
      flags: "a",
    });

    console.log(`User ${userId} stopped speaking`);

    const audioBuffer = audioStreamCollection[1];
    writeStream.write(audioBuffer);
    // for (let i = 0; i < audioStreamCollection.length; i++) {
    //   const audioBuffer = audioStreamCollection[i];
    //   writeStream.write(audioBuffer);
    // }
    
    writeStream.end();
    console.log(`The file ${fileName} was saved!`);
  });
}
