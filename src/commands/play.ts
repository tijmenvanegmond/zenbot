import { CommandInteraction, Client, GuildMember, VoiceChannel, SlashCommandBuilder, CommandInteractionOptionResolver } from "discord.js";
import { Command } from "./command";
import { StreamType, createAudioPlayer, createAudioResource, joinVoiceChannel } from '@discordjs/voice';
import { PythonShell } from 'python-shell';


export const play: Command = {
    data: new SlashCommandBuilder()
        .setName("play")
        .setDescription("plays an audio file"),

    execute: async (client: Client, interaction: CommandInteraction) => {

        const member = interaction?.member as GuildMember;

        if (!member?.voice?.channelId) {
            console.log("reply-ing in text");
            return await interaction.followUp({ content: "You have to be in voice to use this", ephemeral: true })
        }

        let options = interaction.options as CommandInteractionOptionResolver
        let text = options.getString('tts_text') || "no text provided";


        let ttsPyOptions = {
            args: [text]
        };

        var result = await PythonShell.run('src/tts2.py', ttsPyOptions); //writes to output.mp3
            
        console.log(result);
        console.log("Joining voice-channel to tts");

        PlayVoiceLine(member.voice.channel as VoiceChannel);

        await interaction.followUp({
            ephemeral: true,
            content: `Attemting to Play Voice Line in Voice Channel ${member.voice.channel?.name}`
        });
    }
};


async function PlayVoiceLine(voiceChannel: VoiceChannel, __dirname = "./output.wav") {
    const resource = createAudioResource(__dirname, {
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