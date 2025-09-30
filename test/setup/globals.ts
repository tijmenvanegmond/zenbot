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
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: "Mocked response",
                role: "assistant",
              },
              finish_reason: "stop",
            },
          ],
          usage: { total_tokens: 10 },
        }),
      },
    },
    audio: {
      speech: {
        create: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
      },
    },
    models: {
      list: vi.fn().mockResolvedValue({ data: [] }),
    },
  })),
}));

// Mock Google Generative AI
vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: vi
            .fn()
            .mockReturnValue("Mocked Gemini response with wit and wisdom."),
          candidates: [
            {
              content: {
                parts: [
                  { text: "Mocked Gemini response with wit and wisdom." },
                ],
              },
              finishReason: "STOP",
            },
          ],
        },
      }),
      generateContentStream: vi.fn().mockResolvedValue({
        stream: {
          [Symbol.asyncIterator]: async function* () {
            yield {
              candidates: [
                {
                  content: {
                    parts: [{ text: "Mocked " }],
                  },
                  finishReason: null,
                },
              ],
            };
            yield {
              candidates: [
                {
                  content: {
                    parts: [{ text: "streaming response" }],
                  },
                  finishReason: "STOP",
                },
              ],
            };
          },
        },
      }),
    }),
  })),
  HarmBlockThreshold: {
    BLOCK_ONLY_HIGH: "BLOCK_ONLY_HIGH",
    BLOCK_MEDIUM_AND_ABOVE: "BLOCK_MEDIUM_AND_ABOVE",
    BLOCK_LOW_AND_ABOVE: "BLOCK_LOW_AND_ABOVE",
    BLOCK_NONE: "BLOCK_NONE",
  },
  HarmCategory: {
    HARM_CATEGORY_SEXUALLY_EXPLICIT: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
    HARM_CATEGORY_HATE_SPEECH: "HARM_CATEGORY_HATE_SPEECH",
    HARM_CATEGORY_HARASSMENT: "HARM_CATEGORY_HARASSMENT",
    HARM_CATEGORY_DANGEROUS_CONTENT: "HARM_CATEGORY_DANGEROUS_CONTENT",
  },
}));

// Mock environment variables
process.env.DISCORD_API_TOKEN = "test-token";
process.env.OPENAI_API_KEY = "test-key";
process.env.GOOGLE_AI_API_KEY = "test-gemini-key";
process.env.NODE_ENV = "test";
