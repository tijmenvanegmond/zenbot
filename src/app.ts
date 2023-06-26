import { Client, GatewayIntentBits } from 'discord.js';
import * as dotenv from 'dotenv'
import onReady from './listeners/onReady';
import onInteractionCreate from './listeners/onInteractionCreate';
import onVoiceChannelUpdate from './listeners/onVoiceChannelUpdate';
dotenv.config()
const TOKEN = process.env.TOKEN;

console.log("Zenbot is starting...");

const client = new Client({
    //get acces to voicedata, etc
    intents: [GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates] //GatewayIntentBits.GuildPresences]
});

//run listeners
onReady(client);
onInteractionCreate(client)
onVoiceChannelUpdate(client)

client.login(TOKEN);
