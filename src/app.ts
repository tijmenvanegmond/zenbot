import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import onReady from "./listeners/onReady";
import onInteractionCreate from "./listeners/onInteractionCreate";
import onVoiceChannelUpdate from "./listeners/onVoiceChannelUpdate";
import Fastify from "fastify";
import onPlayerUpdate from "./listeners/onPlayerUpdate";
import onMessageCreate from "./listeners/onMessageCreate";
import { registerApiRoutes } from "./api";
import { logger } from "./utils/logger";

// Initialize AI Services
import { AIServiceManager, MemorySessionStorage } from "./services/ai";
import { AI_CONFIG, AI_ENABLED } from "./config/aiConfig";
import { ZenbotService } from "./services/zenbotService";
import { UnifiedVoiceService } from "./services/voice/UnifiedVoiceService";

// Allow overriding via command line arguments
const DISCORD_API_TOKEN = process.argv[2] || process.env.DISCORD_API_TOKEN;
const LOG_LEVEL = process.env.LOG_LEVEL;
const PORT = process.argv[3] || process.env.PORT || 3001;

logger.info("Zenbot awakens... Experience tranquility through code.");

// Initialize AI Services (optional) - without a provider, Zenbot uses curated responses
const aiManager = AI_ENABLED
  ? new AIServiceManager(AI_CONFIG, new MemorySessionStorage())
  : null;
ZenbotService.initialize(aiManager);

// Initialize Voice Service to show provider status at startup
UnifiedVoiceService.getInstance();
logger.info("🎤 Voice service initialized");

if (aiManager) {
  logger.info("🧘 AI services initialized - The Iris connects all providers");
}

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
onMessageCreate(discordClient);
/**
 * Two bots on one token both receive every slash command and fight over
 * voice connections (commands fail with "unknown interaction", the bot joins
 * voice and stays silent). In `npm run dev`, use DISCORD_DEV_TOKEN if set,
 * otherwise refuse to start while the live bot (Docker) is running.
 */
const resolveDiscordToken = async (): Promise<string | undefined> => {
  const isDev = process.env.npm_lifecycle_event === "dev";
  if (!isDev) return DISCORD_API_TOKEN;

  if (process.env.DISCORD_DEV_TOKEN) {
    logger.info("🧪 Dev mode: logging in with DISCORD_DEV_TOKEN");
    return process.env.DISCORD_DEV_TOKEN;
  }

  const liveUrl = process.env.LIVE_BOT_URL || "http://localhost:3001/";
  const liveBotRunning = await fetch(liveUrl, {
    signal: AbortSignal.timeout(2000),
  })
    .then((res) => res.ok)
    .catch(() => false);

  if (liveBotRunning) {
    logger.error(
      `❌ Dev mode: the live bot is running (${liveUrl} answered) and would share this token. ` +
        "Stop it first (docker stop zenbot) or set DISCORD_DEV_TOKEN to a separate test bot.",
    );
    process.exit(1);
  }

  logger.warn(
    "⚠️ Dev mode with the live token - don't start the Docker bot while this runs",
  );
  return DISCORD_API_TOKEN;
};

// The API server starts after the check, so the check never finds itself
resolveDiscordToken().then((token) => {
  discordClient.login(token);
  startApiServer();
});

// Initialize Fastify server - the gateway to digital enlightenment
const fastify = Fastify({
  logger: LOG_LEVEL === "DEBUG",
});

// Register all API routes - true self flows through many forms
registerApiRoutes(fastify, discordClient);

function startApiServer(): void {
  fastify.listen({ host: "0.0.0.0", port: Number(PORT) }, (err, address) => {
    if (err) {
      logger.error("❌ Failed to start API server:", err);
      process.exit(1);
    }
    logger.info(
      `🌐 API server listening on ${address} - the path to enlightenment is open`,
    );
  });
}
