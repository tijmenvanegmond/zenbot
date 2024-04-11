import {
  Channel,
  Client,
  Events,
  GuildMember,
  VoiceBasedChannel,
  VoiceState,
} from "discord.js";

const EXCLUDE_VOICE_CHANNEL_IDS = [
  "1146803612492777",
  "1146803612492775517",
  "1226931698336534652",
  "1163888773617176646",
];

export default (client: Client): void => {
  client.on(
    Events.VoiceStateUpdate,
    (oldState: VoiceState, newState: VoiceState) => {
      const member = newState.member;
      const botUser = member?.user.bot;
      let channel: Channel | null = null;

      if (oldState.channelId === newState.channelId) {
        return; //ignore if no change (it happens)
      }

      console.log(
        `user ${member?.displayName} moved from ${oldState.channel?.name} to ${newState.channel?.name}`
      );

      channel = newState.channel ?? oldState.channel;

      if (!channel) {
        console.log(`Ignoring channel change: channel not found`);
        return;
      }

      if (botUser) {
        console.log(
          `Ignoring channel change: user ${member?.displayName} is a bot`
        );
        return;
      }

      if (EXCLUDE_VOICE_CHANNEL_IDS.includes(channel.id!)) {
        console.log(`Ignoring channel[${channel.id}] is an excluded channel`);
        return;
      }

      updateChannel(channel, newState.member!);
    }
  );
};

async function updateChannel(
  channel: VoiceBasedChannel,
  member: GuildMember,
  left = false
) {
  let newChannelName = getNewChannelName(channel, member);

  if (channel.name == newChannelName) {
    console.log("Name Unchanged");
    return;
  }

  try {
    console.log(
      `Updating Channel ${channel.id}'s name to :"${newChannelName}"`
    );
    await channel.setName(newChannelName);
  } catch (error) {
    console.log(`Failed to update Channel name`);
    console.log(error);
  }
}

function getNewChannelName(channel: VoiceBasedChannel, member: GuildMember) {
  let possibleNames: string[] = [];

  let memberNames = channel.members
    .filter((member) => !member.user.bot)
    .map((member) => member.displayName)
    .sort((a, b) => compareStrings(a, b));

  //is Timbo there?
  if (channel.members.some((m) => m.user.id === "299595170767306752"))
    possibleNames.push("Discord Jerkoff Session");

  //wild cards
  possibleNames.push("Pixel Purgatory");
  possibleNames.push("Rage Quit Retreat");

  let numMembers = memberNames.length;
  console.log(`There's ${numMembers} in the voice channel`);
  switch (numMembers) {
    case 0:
      possibleNames.push("Empty Lounge");
      possibleNames.push("No one here but us chickens");
      possibleNames.push("Ghost Town");
      possibleNames.push("The Void");
      possibleNames.push("The Abyss");
      possibleNames.push("Empty Space");
      possibleNames.push("Pending Removal");
      possibleNames.push("Server cost");
      possibleNames.push("404 Lounge");
      break;
    case 1:
      possibleNames.push("👉👈");
      possibleNames.push("Lounge 2: Electric Boogaloo");
      possibleNames.push("Fire starter");
      possibleNames.push("Solo Lounge");
      possibleNames.push("Lone Lounge");
      possibleNames.push("Army of One");
      possibleNames.push("One-Man Lounge");
      possibleNames.push(`Only 1?, Lamesauce`);
      possibleNames.push(`Omg you reading this?`);
      possibleNames.push(`${memberNames[0]}'s Lounge`);
      possibleNames.push(`${memberNames[0]}'s Lounge`);
      possibleNames.push(`${memberNames[0]}'s Lounge`);
      possibleNames.push(`${memberNames[0]}'s Lounge`);
      possibleNames.push(`${memberNames[0]}'s Lounge`);
      possibleNames.push(`${memberNames[0]}'s Lounge`);
      possibleNames.push(`${memberNames[0]}'s Lounge`);
      possibleNames.push(`${memberNames[0]}'s Lounge`);
      possibleNames.push(`${memberNames[0]}'s Lounge`);
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
      possibleNames.push(
        `${memberNames[0]} & ${memberNames[1]}`
      );
      possibleNames.push(
        `${memberNames[0]} & ${memberNames[1]}'s Get Together`
      );
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
      possibleNames.push("The Fabulous Four");
      break;
    case 5:
      possibleNames.push("Pentaforce");
      possibleNames.push("Quintessential Warriors");
      possibleNames.push("Fivefold Fury");
      possibleNames.push("The Fabulous Five");
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

  return (
    possibleNames[Math.floor(Math.random() * possibleNames.length)] ?? "Lounge"
  );
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
