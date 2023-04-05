import { CommandInteraction, Client, ApplicationCommandType, GuildMember, Channel, VoiceChannel } from "discord.js";
import { Command } from "./command";
import { StreamType, createAudioPlayer, createAudioResource, joinVoiceChannel } from '@discordjs/voice';
import { channel } from "diagnostics_channel";

export const Advice: Command = {
    name: "advice",
    description: "Zen has an answer for everything (make sure you are in a voice channel)",
    type: ApplicationCommandType.ChatInput,
    run: async (client: Client, interaction: CommandInteraction) => {

        const member = interaction?.member as GuildMember;
        if (!member?.voice?.channelId) {
            return await interaction.followUp({ content: 'You need to enter a voice channel before use the command', ephemeral: true })
        }

        // const lounge = await guild.channels.fetch("1055169128945688648")
        //member.voice.setChannel("1055169128945688648");

        const channel = member.voice.channel as VoiceChannel;
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guildId,
            adapterCreator: channel.guild.voiceAdapterCreator,
        });

        const audioPlayer = createAudioPlayer();
        const subscription = connection.subscribe(audioPlayer);
        const resource = createAudioResource('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', {
            inputType: StreamType.Arbitrary,
        });

        await audioPlayer.play(resource)

        // subscription could be undefined if the connection is destroyed!
        if (subscription) {
            // Unsubscribe after 5 seconds (stop playing audio on the voice connection)
            setTimeout(() => subscription.unsubscribe(), 5_000);
        }

        const content = "consider this..";
        await interaction.followUp({
            ephemeral: true,
            content
        });


    }
}; 