import { Client } from 'discord.js';
import * as dotenv from 'dotenv'
import ready from './listeners/ready';
import interactionCreate from './listeners/interactionCreate';
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
