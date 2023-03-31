import { REST, Routes, Client, ClientOptions } from 'discord.js';
import ready from './listeners/ready';
import interactionCreate from './listeners/interactionCreate';
import * as dotenv from 'dotenv'
dotenv.config()
const CLIENT_ID = process.env.CLIENT_ID;
const TOKEN = process.env.TOKEN;

console.log("Bot is starting...");

const client = new Client({
    intents: []
});

ready(client);
interactionCreate(client)

client.login(TOKEN);