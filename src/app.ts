import { Client, GatewayIntentBits } from 'discord.js';
import * as dotenv from 'dotenv'
import onReady from './listeners/onReady';
import onInteractionCreate from './listeners/onInteractionCreate';
import onVoiceChannelUpdate from './listeners/onVoiceChannelUpdate';
dotenv.config()
const DISOCRD_API_TOKEN = process.env.DISOCRD_API_TOKEN;

console.log("Zenbot is starting...");

const client = new Client({
    //get acces to voicedata, etc
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        //GatewayIntentBits.MessageContent,
        //GatewayIntentBits.GuildPresences
    ]
});



//run listeners
onReady(client);
onInteractionCreate(client)
onVoiceChannelUpdate(client)

client.login(DISOCRD_API_TOKEN);
