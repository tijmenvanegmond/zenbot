import { CommandInteraction, Client, ApplicationCommandType, GuildMember, Channel, VoiceChannel } from "discord.js";
import { Command } from "./command";
import { StreamType, createAudioPlayer, createAudioResource, joinVoiceChannel } from '@discordjs/voice';
import { VoiceLineData, VoiceLineDataCollection } from "../voice/voiceLineData";

export const Advice: Command = {
    name: "advice",
    description: "Zen has an answer for everything (make sure you are in a voice channel)",
    type: ApplicationCommandType.ChatInput,
    run: async (client: Client, interaction: CommandInteraction) => {

        const member = interaction?.member as GuildMember;

        const voiceline = VoiceLineDataCollection[Math.floor(Math.random() * VoiceLineDataCollection.length)];
        console.log("Selected Advice:\""+voiceline.text+"\"");

        if (!member?.voice?.channelId) {
           
            return await interaction.followUp({ content: voiceline.text, ephemeral: true })
        }

        PlayVoiceLine(member.voice.channel as VoiceChannel, voiceline)

        const content = "consider this..";
        await interaction.followUp({
            ephemeral: true,
            content
        });
    }
};


async function PlayVoiceLine(voiceChannel: VoiceChannel, voiceLine: VoiceLineData) {

    const resource = createAudioResource(voiceLine.voiceUri, {
        inputType: StreamType.Arbitrary,
    });

    const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });

    const audioPlayer = createAudioPlayer();
    const subscription = connection.subscribe(audioPlayer);

    await audioPlayer.play(resource);

    console.log(resource.started);

    // subscription could be undefined if the connection is destroyed!
    if (subscription) {
        // Unsubscribe after 8 seconds (stop playing audio on the voice connection)
        setTimeout(() => {
            subscription.unsubscribe()
            connection.disconnect()
            connection.destroy()
        },
            voiceLine.length);
    }

}