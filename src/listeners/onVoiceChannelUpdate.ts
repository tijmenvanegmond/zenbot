import { Client, Events, GuildMember, VoiceBasedChannel, VoiceState } from "discord.js";

const VOICE_CHANNEL_ID = "1120775680624443413";

export default (client: Client): void => {
    client.on(Events.VoiceStateUpdate, (oldState: VoiceState, newState: VoiceState) => {
        const member = newState.member;
        const botUser = member?.user.bot;

        if (botUser) {
            console.log(`Ignoring channel change: user ${member?.displayName} is a bot`);
            return;
        }

        if (oldState.channelId === newState.channelId) {
            //no change in channelId
            //console.log(`Ignoring channel change: channnel id didn't change`);
            return;
        }

        console.log(`user ${member?.displayName} moved from ${oldState.channelId} to ${newState.channelId}`);

        if (newState.channelId === VOICE_CHANNEL_ID) {
            //user joined
            const channel = newState.channel!;
            updateChannel(channel, newState.member!)
        }
        else if (oldState.channelId === VOICE_CHANNEL_ID) {
            //user left
            const channel = oldState.channel!;
            updateChannel(channel, newState.member!)
        }
        else {
            //console.log(`Ignoring channel change: channelId doesn't match id:${VOICE_CHANNEL_ID}`)
        }
    });
};

async function updateChannel(channel: VoiceBasedChannel, member: GuildMember, left = false) {

    let newChannelName = getNewChannelName(channel, member);

    if (channel.name == newChannelName) {
        console.log('Name Unchanged')
        return;
    }

    try {
        console.log(`Updating Channel ${channel.id}'s name to :"${newChannelName}"`);
        await channel.setName(newChannelName);
    } catch (error) {
        console.log(`Failed to update Channel name`);
        console.log(error);
    }

}

function getNewChannelName(channel: VoiceBasedChannel, member: GuildMember) {
    let possibleNames: string[] = [];

    let memberNames = channel.members
        .filter(member => !member.user.bot)
        .map(member => member.displayName)
        .sort((a, b) => compareStrings(a, b));

    //is Timbo there?
    if (channel.members.some(m => m.user.id === "299595170767306752"))
        possibleNames.push("Discord Jerkoff Session")

    //wild cards
    possibleNames.push("Pixel Purgatory");
    possibleNames.push("Nerdvana Lounge");
    possibleNames.push("The Geek Grotto");
    possibleNames.push("Gaming Asylum");
    possibleNames.push("The LAN Party Lair");
    possibleNames.push("Rage Quit Retreat");
    possibleNames.push("Level Up Lounge");

    let numMembers = memberNames.length;
    console.log(`There's ${numMembers} in the voice channel`);
    switch (numMembers) {
        case 0:
            possibleNames.push('Empty Lounge');
            possibleNames.push('Empty Lounge');
            possibleNames.push('Empty Lounge');
            possibleNames.push('Empty Lounge');
            possibleNames.push('Empty Lounge');
            possibleNames.push("404 Gamers Not Found");
            break;
        case 1:
            possibleNames.push("Solo Sensei");
            possibleNames.push("Lonerism Lounge");
            possibleNames.push("Lone Warrior");
            possibleNames.push("Sole Survivor");
            possibleNames.push("One-Man Army");
            possibleNames.push(`${memberNames[0]}'s Hole`)
            break;
        case 2:
            possibleNames.push("Dynamic Duo");
            possibleNames.push("Power Pair");
            possibleNames.push("Dual Warriors");
            possibleNames.push("Twin Titans");
            possibleNames.push("Double Trouble");
            possibleNames.push("Pair of Legends");
            possibleNames.push("Dynamic Dorks");
            possibleNames.push("The Dual Delinquents");
            possibleNames.push(`${memberNames[0]} & ${memberNames[1]}'s Get Together`)
            break;
        case 3:
            possibleNames.push("Trio of Trolls");
            possibleNames.push("Triple Threat");
            possibleNames.push("Triforce Warriors");
            possibleNames.push("Three Musketeers");
            possibleNames.push("Tactical Trinity");
            possibleNames.push("Triumphant Triad");
            break;
        case 4:
            possibleNames.push("The Four Horseman");
            possibleNames.push("Quad Squad");
            possibleNames.push("Fantastic Four");
            possibleNames.push("Elite Ensemble");
            possibleNames.push("Quartet of Chaos");
            possibleNames.push("The Fabulous Four")
            break;
        case 5:
            possibleNames.push("Pentaforce");
            possibleNames.push("Quintessential Warriors");
            possibleNames.push("Fivefold Fury");
            possibleNames.push("The Fabulous Five")
            break;
        case 6:
            possibleNames.push("Team Hexagon");
            possibleNames.push("Six-Pack Power");
            possibleNames.push("Epic Gamer Lounge");
            possibleNames.push("The Savage Six");
            break;
        default:
            possibleNames.push("Overcrowded");
            possibleNames.push("The Grand Assembly");
            possibleNames.push("Discord Overflow");
            break;
    }

    return possibleNames[Math.floor(Math.random() * possibleNames.length)] ?? 'Lounge';
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
