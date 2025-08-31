import dotenv from "dotenv";
import { logger } from "../utils/logger";

// Load environment variables
dotenv.config();

/**
 * Centralized configuration management with validation
 * All environment variables and configuration constants in one place
 */
export class Config {
  // Environment Variables
  static readonly DISCORD_TOKEN = Config.getRequiredEnv('DISCORD_API_TOKEN');
  static readonly OPENAI_API_KEY = Config.getRequiredEnv('OPENAI_API_KEY');
  static readonly PORT = parseInt(Config.getEnv('PORT', '3001'));
  static readonly LOG_LEVEL = Config.getEnv('LOG_LEVEL', 'INFO');

  // Discord Channel Types (avoiding magic numbers)
  static readonly CHANNEL_TYPES = {
    GUILD_TEXT: 0,
    GUILD_VOICE: 2,
  } as const;

  // Voice Configuration
  static readonly VOICE_CONFIG = {
    TTS_MODEL: 'gpt-4o-mini-tts',
    TTS_VOICE: 'echo',
    TTS_FORMAT: 'mp3' as const,
    LEGACY_TTS_MODEL: 'tts-1',
    LEGACY_TTS_VOICE: 'nova',
    LEGACY_TTS_FORMAT: 'opus' as const,
    ZENYATTA_INSTRUCTIONS: 'Speak in a calm, wise, and serene tone like Zenyatta from Overwatch - an omnic monk with a deep, resonant, slightly robotic voice. Add subtle pauses between phrases for contemplation. Be philosophical and peaceful.',
  } as const;

  // AI Configuration
  static readonly AI_CONFIG = {
    CHAT_MODEL: 'gpt-4o-mini',
    DEFAULT_TEMPERATURE: 0.8,
    DEFAULT_MAX_TOKENS: 100,
  } as const;

  // Voice Channel Exclusions
  static readonly EXCLUDED_VOICE_CHANNELS = [
    '1146803612492777',
    '1146803612492775517',
    '1226931698336534652',
    '1163888773617176646',
  ] as const;

  // Quote Channel Detection
  static readonly QUOTE_CHANNEL_NAMES = [
    '🌸quotes',
    'quotes',
    'quote', 
    'memes'
  ] as const;

  // API Configuration
  static readonly API_CONFIG = {
    DEFAULT_QUOTE_LIMIT: 100,
    MAX_QUOTE_LIMIT: 100,
    REQUEST_TIMEOUT: 10000,
  } as const;

  /**
   * Gets required environment variable or throws error
   */
  private static getRequiredEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
      const error = `Required environment variable ${key} is not set`;
      logger.error(error);
      throw new Error(error);
    }
    return value;
  }

  /**
   * Gets optional environment variable with default
   */
  private static getEnv(key: string, defaultValue: string): string {
    return process.env[key] || defaultValue;
  }

  /**
   * Validates all required configuration on startup
   */
  static validate(): void {
    try {
      // Test required variables by accessing them
      Config.DISCORD_TOKEN;
      Config.OPENAI_API_KEY;
      
      logger.info('Configuration validation successful');
      logger.info(`Server configured for port: ${Config.PORT}`);
      logger.info(`Log level: ${Config.LOG_LEVEL}`);
    } catch (error) {
      logger.error('Configuration validation failed:', error);
      throw error;
    }
  }

  /**
   * Gets environment info for debugging
   */
  static getEnvironmentInfo() {
    return {
      nodeEnv: process.env.NODE_ENV || 'development',
      port: Config.PORT,
      logLevel: Config.LOG_LEVEL,
      hasDiscordToken: !!Config.DISCORD_TOKEN,
      hasOpenAiKey: !!Config.OPENAI_API_KEY,
    };
  }
}

// Validate configuration on module load
Config.validate();

// Export commonly used values for convenience
export const {
  DISCORD_TOKEN,
  OPENAI_API_KEY,
  PORT,
  LOG_LEVEL,
  CHANNEL_TYPES,
  VOICE_CONFIG,
  AI_CONFIG,
  EXCLUDED_VOICE_CHANNELS,
  QUOTE_CHANNEL_NAMES,
  API_CONFIG
} = Config;