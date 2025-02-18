import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import onReady from "./listeners/onReady";
import onInteractionCreate from "./listeners/onInteractionCreate";
import onVoiceChannelUpdate from "./listeners/onVoiceChannelUpdate";
import Fastify from "fastify";
import onPlayerUpdate from "./listeners/onPlayerUpdate";
const DISCORD_API_TOKEN = process.env.DISCORD_API_TOKEN;
const LOG_LEVEL = process.env.LOG_LEVEL;
const PORT = process.env.PORT;

console.log("Zenbot is starting...");

const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    //GatewayIntentBits.GuildPresences
  ],
});

//run listeners
onReady(discordClient);
onInteractionCreate(discordClient);
onVoiceChannelUpdate(discordClient);
onPlayerUpdate(discordClient);
discordClient.login(DISCORD_API_TOKEN);

//A small server for health checks
const fastify = Fastify({
  logger: LOG_LEVEL === "DEBUG",
});
fastify.get("/", async function handler(request, reply) {
  reply
    .code(200)
    .header("Content-Type", "application/json; charset=utf-8")
    .send({
      numberOfGuilds: discordClient.guilds.cache.size,
      uptimeInSeconds: discordClient.uptime! / 1000,
    });
});
fastify.listen({ host: "0.0.0.0", port: Number(PORT) });

