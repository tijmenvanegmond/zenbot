import { CommandInteraction, Client,  GuildMember, VoiceChannel, SlashCommandBuilder } from "discord.js";
import { Command } from "./command";
import { StreamType, createAudioPlayer, createAudioResource, joinVoiceChannel } from '@discordjs/voice';
import { VoiceLineData, VoiceLineDataCollection } from "../voice/voiceLineData";

export const Advice: Command = {
    data: new SlashCommandBuilder()
        .setName("advice")
        .setDescription("Zen has an answer for everything (make sure you are in a voice channel)"),

    execute: async (client: Client, interaction: CommandInteraction) => {

        const member = interaction?.member as GuildMember;

        const voiceline = VoiceLineDataCollection[Math.floor(Math.random() * VoiceLineDataCollection.length)];

        if (!member?.voice?.channelId) {
            console.log("reply-ing in text with advice:\"" + voiceline.text + "\"");
            return await interaction.followUp({ content: voiceline.text, ephemeral: true })
        }

        console.log("Joining voice-channel to give advice:\"" + voiceline.text + "\"");
        PlayVoiceLine(member.voice.channel as VoiceChannel, voiceline)

        const content = "consider this..";
        await interaction.followUp({
            ephemeral: true,
            content
        });
    }
};


async function PlayVoiceLine(voiceChannel: VoiceChannel, voiceLine: VoiceLineData) {
    const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });
    const audioPlayer = createAudioPlayer();
    const subscription = connection.subscribe(audioPlayer);

    const resource = createAudioResource(voiceLine.voiceUri, {
        inputType: StreamType.Arbitrary,
    });

    await audioPlayer.play(resource);

    leaveChannelAfter();

    function leaveChannelAfter() {
        if (subscription) {
            // Unsubscribe after done playing
            setTimeout(() => {
                if (resource.ended) { //done playing
                    subscription.unsubscribe();
                    connection.disconnect();
                    connection.destroy();
                    console.log(`Zenbot left voice channel`);
                } else {
                    leaveChannelAfter();
                }
            },
                //check every second
                1000);
        }
    }

}