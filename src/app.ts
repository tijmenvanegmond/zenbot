import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import onReady from "./listeners/onReady";
import onInteractionCreate from "./listeners/onInteractionCreate";
import onVoiceChannelUpdate from "./listeners/onVoiceChannelUpdate";
import Fastify from "fastify";
import onPlayerUpdate from "./listeners/onPlayerUpdate";
import { registerApiRoutes } from "./api";
import { logger } from "./utils/logger";

// Initialize AI Services
import {
  AIServiceManager,
  MemorySessionStorage,
  OpenAIProvider,
  AnthropicProvider,
} from "./services/ai";
import { AI_CONFIG } from "./config/aiConfig";
import { ZenbotService } from "./services/zenbotService";

// Allow overriding via command line arguments
const DISCORD_API_TOKEN = process.argv[2] || process.env.DISCORD_API_TOKEN;
const LOG_LEVEL = process.env.LOG_LEVEL;
const PORT = process.argv[3] || process.env.PORT || 3001;

logger.info("Zenbot awakens... Experience tranquility through code.");

// Initialize AI Services - The Path of Unified Intelligence
const sessionStorage = new MemorySessionStorage();
const aiManager = new AIServiceManager(AI_CONFIG, sessionStorage);

// Initialize Unified Zenyatta Service
ZenbotService.initialize(aiManager);

logger.info("🧘 AI services initialized - The Iris connects all providers");

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

// Embrace the harmony of listeners - each one a pillar of enlightenment
onReady(discordClient);
onInteractionCreate(discordClient);
onVoiceChannelUpdate(discordClient);
onPlayerUpdate(discordClient);
discordClient.login(DISCORD_API_TOKEN);

// Initialize Fastify server - the gateway to digital enlightenment
const fastify = Fastify({
  logger: LOG_LEVEL === "DEBUG",
});

// Register all API routes - true self flows through many forms
registerApiRoutes(fastify, discordClient);

fastify.listen({ host: "0.0.0.0", port: Number(PORT) });
