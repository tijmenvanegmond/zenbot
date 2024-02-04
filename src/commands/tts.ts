import { CommandInteraction, Client, GuildMember, VoiceChannel, SlashCommandBuilder, CommandInteractionOptionResolver } from "discord.js";
import { Command } from "./command";
import { StreamType, createAudioPlayer, createAudioResource, joinVoiceChannel } from '@discordjs/voice';
import { PythonShell } from 'python-shell';


export const TTS: Command = {
    data: new SlashCommandBuilder()
        .setName("tts")
        .setDescription("just TTS")
        .addStringOption((option =>
            option.setName('tts_text')
                .setDescription('The text to TTS'))
        ),

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
        console.log("Passing text to a tts-python script");
        var result = await PythonShell.run('src/tts.py', ttsPyOptions); //writes to output.mp3
            
        console.log(result);
        console.log("Joining voice-channel to tts");

        PlayVoiceLine(member.voice.channel as VoiceChannel);

        const content = "attemting to TTS";
        await interaction.followUp({
            ephemeral: true,
            content
        });
    }
};


async function PlayVoiceLine(voiceChannel: VoiceChannel, __dirname = "./output.mp3") {
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