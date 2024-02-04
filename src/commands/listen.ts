import { CommandInteraction, Client, GuildMember, VoiceChannel, SlashCommandBuilder, CommandInteractionOptionResolver } from "discord.js";
import { Command } from "./command";
import { joinVoiceChannel } from '@discordjs/voice';
import { OpusEncoder } from '@discordjs/opus';
import * as fs from 'fs';

export const Listen: Command = {
    data: new SlashCommandBuilder()
        .setName("listen")
        .setDescription("listens to a voice channel"),

    execute: async (client: Client, interaction: CommandInteraction) => {

        const member = interaction?.member as GuildMember;

        if (!member?.voice?.channelId) {
            console.log("reply-ing in text");
            return await interaction.followUp({ content: "You have to be in voice to use this", ephemeral: true })
        }

        let options = interaction.options as CommandInteractionOptionResolver

        console.log("Joining voice-channel to listen");

        ListenToVoiceChannel(client, member.voice.channel as VoiceChannel);

        const content = "attemting to STT";
        await interaction.followUp({
            ephemeral: true,
            content
        });
    }
};


async function ListenToVoiceChannel(client: Client, voiceChannel: VoiceChannel, __dirname = "./output.wav") {

    const connection = joinVoiceChannel({
        selfDeaf: false,
        channelId: voiceChannel.id,
        guildId: voiceChannel.guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });

    let reciever = connection.receiver;

    const encoder = new OpusEncoder(48000, 2);
    let completeStream: Buffer[] = [];

    reciever.speaking.on('start', (userId) => {
        console.log(`User ${userId} started speaking`);
        let stream = reciever.subscribe(userId)
        stream.on('data', (data) => {
            //let decoded = encoder.decode(data);
            completeStream.push(data);


        })
    });

    reciever.speaking.on('end', (userId) => {
        console.log(`User ${userId} stopped speaking`);

        var stream = fs.createWriteStream(process.cwd() + "/test.opus", { flags: 'a' });
        for (let i = 0; i < completeStream.length; i++) {
            const audioBuffer = completeStream[i];
            let result = encoder.decode(audioBuffer);
            stream.write(result);

        }
        stream.end();
        console.log("The file was saved!");
    });

}