import { Client, GatewayIntentBits } from "discord.js";
import * as dotenv from "dotenv";
import onReady from "./listeners/onReady";
import onInteractionCreate from "./listeners/onInteractionCreate";
import onVoiceChannelUpdate from "./listeners/onVoiceChannelUpdate";
import Fastify from "fastify";
dotenv.config();
const DISOCRD_API_TOKEN = process.env.DISOCRD_API_TOKEN;
const LOG_LEVEL = process.env.LOG_LEVEL;

console.log("Zenbot is starting...");

const discordClient = new Client({
  //get acces to voicedata, etc
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    //GatewayIntentBits.MessageContent,
    //GatewayIntentBits.GuildPresences
  ],
});

//run listeners
onReady(discordClient);
onInteractionCreate(discordClient);
onVoiceChannelUpdate(discordClient);
discordClient.login(DISOCRD_API_TOKEN);

//A small server for health checks
const fastify = Fastify({
  logger: LOG_LEVEL === "DEBUG",
});

// Declare a route
fastify.get("/", async function handler(request, reply) {
  return {
    numberOfGuilds: discordClient.guilds.cache.size,
    uptime: discordClient.uptime,
  };
});

// Run the server!
try {
  fastify.listen({ port: 8080 });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
