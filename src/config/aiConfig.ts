/**
 * AI Service Configuration
 * Central configuration for all AI providers and settings
 */

import { AIServiceConfig } from "../services/ai";
import { logger } from "../utils/logger";
import { DEFAULT_GEMINI_MODEL } from "../services/ai/providers/geminiProvider";

// Load environment variables
const OPENAI_API_KEY = undefined; // process.env.OPENAI_API_KEY; // Disabled to avoid token usage
const ANTHROPIC_API_KEY = undefined; // process.env.ANTHROPIC_API_KEY; // Disabled for now
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

// Validate required API keys
if (!OPENAI_API_KEY) {
  logger.warn("⚠️ OPENAI_API_KEY disabled - OpenAI provider will be disabled");
}

if (!ANTHROPIC_API_KEY) {
  logger.warn(
    "⚠️ ANTHROPIC_API_KEY not found - Anthropic provider will be disabled",
  );
}

if (!GOOGLE_AI_API_KEY) {
  logger.warn(
    "⚠️ GOOGLE_AI_API_KEY not found - Gemini provider will be disabled",
  );
}

/**
 * AI is optional. It is enabled when at least one provider key is present,
 * unless explicitly switched off with AI_ENABLED=false. Without AI, Zenbot
 * runs on curated responses (voice, quotes, advice, remarks still work).
 */
const HAS_AI_KEY = !!(OPENAI_API_KEY || ANTHROPIC_API_KEY || GOOGLE_AI_API_KEY);
export const AI_ENABLED =
  HAS_AI_KEY && process.env.AI_ENABLED?.toLowerCase() !== "false";

if (!AI_ENABLED) {
  logger.warn(
    HAS_AI_KEY
      ? "⚠️ AI disabled via AI_ENABLED=false - running on curated responses"
      : "⚠️ No AI provider key configured - running on curated responses",
  );
}

// Determine default provider based on available keys - using Gemini since OpenAI is disabled
const getDefaultProvider = (): string => {
  if (GOOGLE_AI_API_KEY) return "gemini";
  if (ANTHROPIC_API_KEY) return "anthropic";
  if (OPENAI_API_KEY) return "openai";
  return "none";
};

export const AI_CONFIG: AIServiceConfig = {
  defaultProvider: getDefaultProvider(),

  // Provider-specific configurations
  providers: {
    // OpenAI provider disabled to avoid token usage
    // ...(OPENAI_API_KEY && {
    //   openai: {
    //     apiKey: OPENAI_API_KEY,
    //     defaultModel: "gpt-4o",
    //     maxTokens: 1000,
    //     temperature: 0.7,
    //   },
    // }),

    // Anthropic provider disabled
    // ...(ANTHROPIC_API_KEY && {
    //   anthropic: {
    //     apiKey: ANTHROPIC_API_KEY,
    //     defaultModel: "claude-3-5-haiku-20241022",
    //     maxTokens: 1000,
    //     temperature: 0.7,
    //   },
    // }),

    ...(GOOGLE_AI_API_KEY && {
      gemini: {
        apiKey: GOOGLE_AI_API_KEY,
        defaultModel: DEFAULT_GEMINI_MODEL,
        maxTokens: 4000,
        temperature: 0.7,
      },
    }),
  },

  // Session management settings
  session: {
    defaultExpiry: 1440, // 24 hours in minutes
    maxMessages: 100, // Max messages per session for Zenyatta
    cleanupInterval: 30, // Cleanup every 30 minutes
    storage: "memory", // Use memory storage for now
  },

  // Provider routing for different capabilities - prioritize Gemini since OpenAI is disabled
  routing: {
    simple: GOOGLE_AI_API_KEY
      ? "gemini"
      : ANTHROPIC_API_KEY
        ? "anthropic"
        : "openai", // Simple text generation
    conversation: GOOGLE_AI_API_KEY
      ? "gemini"
      : ANTHROPIC_API_KEY
        ? "anthropic"
        : "openai", // Conversations with memory
    functions: GOOGLE_AI_API_KEY
      ? "gemini"
      : ANTHROPIC_API_KEY
        ? "anthropic"
        : "openai", // Function calling
    streaming: GOOGLE_AI_API_KEY
      ? "gemini"
      : ANTHROPIC_API_KEY
        ? "anthropic"
        : "openai", // Streaming responses
  },

  // Fallback configuration - safe linear chains (OpenAI disabled)
  fallbacks: {
    providers: {
      openai: ["gemini", "anthropic"], // OpenAI → Gemini → Anthropic (if somehow enabled)
      anthropic: ["gemini"], // Anthropic → Gemini (skip OpenAI)
      gemini: ["anthropic"], // Gemini → Anthropic (skip OpenAI)
    },
    maxRetries: 2,
    circuitBreakerThreshold: 3,
  },
};

export const ZENYATTA_CONFIG = {
  // Character-specific settings
  character: {
    name: "Zenyatta",
    sessionExpiry: 1440, // 24 hours for character consistency
    maxHistory: 100, // More history for character continuity
    temperature: 0.8, // Slightly more creative for personality
    enableFunctions: true, // Allow function calling
  },

  // TTS settings
  tts: {
    model: "gpt-4o-mini-tts",
    voice: "echo",
    format: "mp3",
    instructions:
      "Speak in a calm, wise, and serene tone like Zenyatta from Overwatch - an omnic monk with a deep, resonant, slightly robotic voice. Add subtle pauses between phrases for contemplation. Be philosophical and peaceful.",
  },

  // Remark generation settings
  remarks: {
    useSessionMemory: true, // Use conversation history for context
    fallbackToStatic: true, // Fall back to static responses if AI fails
    maxLength: 200, // Keep remarks concise
  },
};

logger.info(`🤖 AI Config loaded with provider: ${AI_CONFIG.defaultProvider}`);
logger.info(
  `🧘 Zenyatta configured with session expiry: ${ZENYATTA_CONFIG.character.sessionExpiry} minutes`,
);
