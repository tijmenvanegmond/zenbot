import { Client, Events, GuildMember, VoiceBasedChannel } from "discord.js";

export default (client: Client): void => {
    client.on(Events.VoiceStateUpdate, (oldState, newState) => {
        var name = newState.member?.displayName;
        if (newState.member?.user.bot) {
            console.log(`ignoring bot user ${name}`);
            return;
        }
        if (newState.channelId === null) {
            console.log(`user ${name} left channel ${oldState.channelId} : ${oldState.channel?.name}`);
            if (oldState.channelId === "1120775680624443413") {
                updateChannel(client, oldState.channelId, newState.member!)
            }
        }
        else if (oldState.channelId === null) {
            console.log(`user ${name} joined channel ${newState.channelId}  : ${newState.channel?.name}`);
            if (newState.channelId === "1120775680624443413") {
                updateChannel(client, newState.channelId, newState.member!)
            }
        }
        else {
            console.log(`user ${name} moved channels ${oldState.channelId} ${newState.channelId}`);
            if (newState.channelId === "1120775680624443413") {
                updateChannel(client, newState.channelId, newState.member!)
            }
            if (oldState.channelId === "1120775680624443413") {
                updateChannel(client, oldState.channelId, newState.member!)
            }
        }
    });

};

async function updateChannel(client: Client, channelId: string, member: GuildMember, left = false) {

    let channel = await client.channels.fetch(channelId) as VoiceBasedChannel;
    let newChannelName = getNewChannelName(channel, member);

    if (channel.name == newChannelName) {
        console.log('Name Unchanged')
        return;
    }

    try {
        await channel.setName(newChannelName)
        console.log(`Updating Channel ${channel.id}'s name ${newChannelName}`);
    } catch (error) {
        console.log(`Failed to update Channel name`);
        console.log(error);
    }

}

function getNewChannelName(channel: VoiceBasedChannel, member: GuildMember) {

    let members = channel.members.map(x => x)
        .filter(x => !x.user.bot)
        .sort((a, b) => compareStrings(a.user.username, b.user.username));

    let numMembers = members.length;
    switch (numMembers) {
        case 0:
            return 'Empty Lounge';
        case 1:
            if (member.user.id == "299595170767306752") //timbo
                return "Discord Jerkoff Session"

            return "Lonerism Lounge"
        case 2:
            return "Fun for 2 Lounge"
        case 3:
            return "A Happy Treesome"
        case 4:
            return "The Four Horseman"
        case 5:
            return "One Swell Overwatch Team"
        case 6:
            return "Epic Gamer Lounge"
        default:
            return "Overcrowded"
    }
}

function compareStrings(a: string, b: string) {
    const stringA = a.toUpperCase();
    const stringB = b.toUpperCase();
    if (stringA < stringB) {
        return -1;
    }
    if (stringA > stringB) {
        return 1;
    }
    // strings must be equal
    return 0;
}
