// Test setup file for Vitest
// This file runs before all tests

import { vi } from "vitest";

// Mock Discord.js
vi.mock("discord.js", () => ({
  Client: vi.fn(),
  GatewayIntentBits: {},
  ActivityType: {},
  Collection: vi.fn(),
  SlashCommandBuilder: vi.fn().mockImplementation(() => ({
    setName: vi.fn().mockReturnThis(),
    setDescription: vi.fn().mockReturnThis(),
    addStringOption: vi.fn().mockReturnThis(),
    addUserOption: vi.fn().mockReturnThis(),
    addChannelOption: vi.fn().mockReturnThis(),
  })),
}));

// Mock @discordjs/voice
vi.mock("@discordjs/voice", () => ({
  joinVoiceChannel: vi.fn(),
  createAudioPlayer: vi.fn(),
  createAudioResource: vi.fn(),
  AudioPlayerStatus: {},
  VoiceConnectionStatus: {},
}));

// Mock OpenAI
vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
    audio: {
      speech: {
        create: vi.fn(),
      },
    },
  })),
}));

// Mock environment variables
process.env.DISCORD_API_TOKEN = "test-token";
process.env.OPENAI_API_KEY = "test-key";
process.env.NODE_ENV = "test";
