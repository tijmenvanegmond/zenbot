import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import onReady from "./infrastructure/listeners/onReady";
import onInteraction from "./infrastructure/listeners/onInteraction";
import onVoiceChannelUpdate from "./infrastructure/listeners/onVoiceChannelUpdate";
import Fastify from "fastify";
import onPlayerUpdate from "./infrastructure/listeners/onPlayerUpdate";
import { registerApiRoutes } from "./infrastructure/api";
import { logger } from "./utils/logger";

import { ModernCommandCollection as SlashCommandCollection } from './infrastructure/slashCommands/ModernCommandCollection'

// Import new hybrid system
import { ZenbotOrchestrator } from "./application/ZenbotOrchestrator";

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

// Initialize the hybrid command/event system
logger.info("🧘 Initializing Zenbot Orchestrator - The path to harmony begins");
const orchestrator = new ZenbotOrchestrator(discordClient);

// Embrace the harmony of listeners - each one a pillar of enlightenment

const slashCommands = new SlashCommandCollection(orchestrator.getEventBus());

onReady(discordClient, slashCommands);
onInteraction(discordClient, slashCommands);
onVoiceChannelUpdate(discordClient);
onPlayerUpdate(discordClient);
discordClient.login(DISCORD_API_TOKEN);

// Initialize Fastify server - the gateway to digital enlightenment
const fastify = Fastify({
  logger: LOG_LEVEL === "DEBUG",
});

// Register all API routes - true self flows through many forms
registerApiRoutes(fastify, discordClient, orchestrator, slashCommands);

fastify.listen({ host: "0.0.0.0", port: Number(PORT) });