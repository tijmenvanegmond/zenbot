import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import onReady from "./infrastructure/listeners/onReady";
import onInteractionCreate from "./infrastructure/listeners/onInteractionCreate";
import onVoiceChannelUpdate from "./infrastructure/listeners/onVoiceChannelUpdate";
import onPlayerUpdate from "./infrastructure/listeners/onPlayerUpdate";
import { registerApiRoutes } from "./infrastructure/api";
import { logger } from "./utils/logger";
import { Zenbot } from "./domain/session/Zenbot";
import { CommandCollection} from "./commands/commandCollection";
import Fastify from "fastify";
import { AIProcessor } from "./domain/ai/AIProcessor";
import { OpenAIService } from "./services/openaiService";

// Allow overriding via command line arguments
const DISCORD_API_TOKEN = process.argv[2] || process.env.DISCORD_API_TOKEN;
const LOG_LEVEL = process.env.LOG_LEVEL;
const PORT = process.argv[3] || process.env.PORT || 3001;

logger.info("Zenbot awakens... Experience tranquility through code.");

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

const zenbot = Zenbot.getInstance();
// Initialize zenbot with Discord client for action execution
zenbot.initialize(discordClient, OpenAIService AIProcessor);

const commandCollection = CommandCollection;

// Embrace the harmony of listeners - each one a pillar of enlightenment
onReady(discordClient);
onInteractionCreate(discordClient, zenbot);
onVoiceChannelUpdate(discordClient, zenbot);
onPlayerUpdate(discordClient, zenbot);
discordClient.login(DISCORD_API_TOKEN);

// Initialize Fastify server - the gateway to digital enlightenment
const fastify = Fastify({
  logger: LOG_LEVEL === "DEBUG",
});

// Register all API routes - true self flows through many forms
registerApiRoutes(fastify, discordClient);

fastify.listen({ host: "0.0.0.0", port: Number(PORT) });