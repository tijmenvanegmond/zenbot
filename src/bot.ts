import { Client } from 'discord.js';
import * as dotenv from 'dotenv'
import ready from './listeners/ready';
import interactionCreate from './listeners/interactionCreate';
import { VoiceLineDataCollection } from './voice/voiceLineData';
dotenv.config()
const CLIENT_ID = process.env.CLIENT_ID;
const TOKEN = process.env.TOKEN;

console.log("Bot is starting...");

const client = new Client({
    //get acces to voicedata, etc
    intents: [641]
});

ready(client);
interactionCreate(client)
client.login(TOKEN);
