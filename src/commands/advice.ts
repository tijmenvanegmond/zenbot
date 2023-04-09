import { CommandInteraction, Client, ApplicationCommandType, GuildMember, Channel, VoiceChannel } from "discord.js";
import { Command } from "./command";
import { StreamType, createAudioPlayer, createAudioResource, joinVoiceChannel } from '@discordjs/voice';

export const Advice: Command = {
    name: "advice",
    description: "Zen has an answer for everything (make sure you are in a voice channel)",
    type: ApplicationCommandType.ChatInput,
    run: async (client: Client, interaction: CommandInteraction) => {

        const member = interaction?.member as GuildMember;
        if (!member?.voice?.channelId) {
            return await interaction.followUp({ content: 'Amid discord, we will find tranquility.', ephemeral: true })
        }

        const channel = member.voice.channel as VoiceChannel;
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guildId,
            adapterCreator: channel.guild.voiceAdapterCreator,
        });

        const voiceLineUri = "https://static.wikia.nocookie.net/overwatch_gamepedia/images/c/cd/Zenyatta_-_Amid_discord%2C_we_will_find_tranquility.ogg/revision/latest?cb=20220630044422"

        const audioPlayer = createAudioPlayer();
        const subscription = connection.subscribe(audioPlayer);
        const resource = createAudioResource(voiceLineUri, {
            inputType: StreamType.Arbitrary,
        });

        await audioPlayer.play(resource)

        // subscription could be undefined if the connection is destroyed!
        if (subscription) {
            // Unsubscribe after 5 seconds (stop playing audio on the voice connection)
            setTimeout(() => {
                subscription.unsubscribe()
                connection.disconnect()
                connection.destroy()
            }, 5_000);
        }

        const content = "consider this..";
        await interaction.followUp({
            ephemeral: true,
            content
        });


    }
}; 