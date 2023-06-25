import { Channel, Client, Events, GuildMember, VoiceBasedChannel } from 'discord.js';
import * as dotenv from 'dotenv'
import ready from './listeners/ready';
import interactionCreate from './listeners/interactionCreate';
import { channel } from 'diagnostics_channel';
dotenv.config()
const TOKEN = process.env.TOKEN;

console.log("Bot is starting...");

const client = new Client({
    //get acces to voicedata, etc
    intents: [641]
});

ready(client);
interactionCreate(client)
client.login(TOKEN);


client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    var name = newState.member?.displayName;
    if (newState.channelId === null) {
        console.log(`user ${name} left channel ${oldState.channelId}`);
        if (oldState.channelId === "1120775680624443413") {
            updateChannel(oldState.channelId, newState.member!)
        }
    }
    else if (oldState.channelId === null) {
        console.log(`user ${name} joined channel ${newState.channelId}`);
        if (newState.channelId === "1120775680624443413") {
            updateChannel(newState.channelId, newState.member!)
        }
    }
    else {
        console.log(`user ${name} moved channels ${oldState.channelId} ${newState.channelId}`);
        if (newState.channelId === "1120775680624443413") {
            updateChannel(newState.channelId, newState.member!)
        }
        if (oldState.channelId === "1120775680624443413") {
            updateChannel(oldState.channelId, newState.member!)
        }
    }
});

async function updateChannel(channelId: string, member: GuildMember) {

    var channel = await client.channels.fetch(channelId) as VoiceBasedChannel;
    console.log(channel!.name);

    var members = channel.members;
    var newChanelName = members.map(x => x.displayName).join(' ') + ' Lounge' 

    await channel.setName(newChanelName)

    console.log(`Updating Channel ${channel.id}'s name ${newChanelName}`);
}
