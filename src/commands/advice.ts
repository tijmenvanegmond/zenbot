import { CommandInteraction, Client,  GuildMember, VoiceChannel, SlashCommandBuilder } from "discord.js";
import { Command } from "./command";
import { StreamType,  createAudioResource } from '@discordjs/voice';
import { VoiceLineDataCollection } from "../voice/voiceLineData";
import PlayResourceInVoiceChannel from "../voice/playInVoiceChannel";

export const Advice: Command = {
    data: new SlashCommandBuilder()
        .setName("advice")
        .setDescription("Zen has an answer for everything (make sure you are in a voice channel)"),

    execute: async (client: Client, interaction: CommandInteraction) => {
        const member = interaction?.member as GuildMember;
        const voiceLine = VoiceLineDataCollection[Math.floor(Math.random() * VoiceLineDataCollection.length)];

        if (!member?.voice?.channelId) {
            console.log("reply-ing in text with advice:\"" + voiceLine.text + "\"");
            return await interaction.followUp({ content: voiceLine.text, ephemeral: true })
        }
        
        const resource = createAudioResource(voiceLine.voiceUri, {
            inputType: StreamType.Arbitrary,
        });

        await PlayResourceInVoiceChannel(member.voice.channel as VoiceChannel, resource)

        const content = "consider this..";
        await interaction.followUp({
            ephemeral: true,
            content
        });
    }
};
