/**
 * Multi-Personality Conference System Test
 * Tests multiple Zenbot personalities debating in conferences
 */

import { vi } from "vitest";
import { DefaultAIServiceManager } from "../src/services/ai/aiServiceManager";
import { UnifiedConferenceManager } from "../src/services/ai/unifiedConferenceManager";
import { MemorySessionStorage } from "../src/services/ai/storage/memoryStorage";
import { ZenbotService } from "../src/services/zenbotService";

// Unmock AI providers for real testing
vi.unmock("openai");
vi.unmock("@google/generative-ai");

describe("Multi-Personality Conference", () => {
  let aiManager: DefaultAIServiceManager;
  let conferenceManager: UnifiedConferenceManager;
  let sessionStorage: MemorySessionStorage;

  beforeAll(async () => {
    // Skip if no API keys
    if (!process.env.OPENAI_API_KEY && !process.env.GOOGLE_AI_API_KEY) {
      console.log(
        "⚠️ Skipping multi-personality tests - no AI provider API keys",
      );
      return;
    }

    const aiConfig = {
      defaultProvider: process.env.GOOGLE_AI_API_KEY
        ? ("gemini" as const)
        : ("openai" as const),
      providers: {
        ...(process.env.OPENAI_API_KEY && {
          openai: {
            apiKey: process.env.OPENAI_API_KEY,
            defaultModel: "gpt-4o-mini",
          },
        }),
        ...(process.env.GOOGLE_AI_API_KEY && {
          gemini: {
            apiKey: process.env.GOOGLE_AI_API_KEY,
            defaultModel: "gemini-2.5-flash",
          },
        }),
      },
      session: {
        defaultExpiry: 60,
        maxMessages: 20,
        cleanupInterval: 30,
        storage: "memory" as const,
      },
    };

    sessionStorage = new MemorySessionStorage();
    aiManager = new DefaultAIServiceManager(aiConfig, sessionStorage);

    // Initialize ZenbotService
    ZenbotService.initialize(aiManager);

    // Conference with multiple personalities
    conferenceManager = new UnifiedConferenceManager(aiManager, {
      enableCollaboration: true,
      requireConsensus: false,
      maxProvidersPerQuery: 3,
      debateRounds: 1, // Quick test
      consensusThreshold: 0.7,
      zenbotPersonalities: [
        "zenbot-default",
        "zenbot-philosopher",
        "zenbot-chaos",
      ],
      specialization: {
        reasoning: ["openai", "gemini"],
        functions: ["openai"],
        creativity: ["openai", "gemini"],
        speed: ["gemini"],
      },
    });
  }, 30000);

  afterAll(async () => {
    await conferenceManager?.cleanup();
    // Note: aiManager doesn't have cleanup method
  });

  test("should register multiple Zenbot personalities", async () => {
    if (!process.env.OPENAI_API_KEY && !process.env.GOOGLE_AI_API_KEY) {
      return; // Skip test
    }

    const stats = await conferenceManager.getConferenceStats();
    console.log("🎭 Conference stats:", stats);

    // Should have multiple providers including personalities
    expect(stats.totalProviders).toBeGreaterThan(0);
  }, 15000);

  test("should conduct multi-personality debate", async () => {
    if (!process.env.OPENAI_API_KEY && !process.env.GOOGLE_AI_API_KEY) {
      return; // Skip test
    }

    console.log("🧠 Testing multi-personality debate...");

    const response = await conferenceManager.converse(
      "test-user",
      "creativity-test",
      "What makes something creative? Is AI creativity real or just mimicry?",
      "Multiple Zenbot personalities should debate this philosophical question.",
      { forceCollaboration: true },
    );

    console.log("🎭 Participants:", response.providers);
    console.log("📊 Conference Level:", response.conferenceLevel);
    console.log("🎯 Consensus Level:", response.consensusLevel);
    console.log("⏱️ Synthesis Time:", response.synthesisTime, "ms");
    console.log("📝 Response Length:", response.response.length, "characters");

    expect(response.response).toBeTruthy();
    expect(response.providers.length).toBeGreaterThan(0);
    expect(response.conferenceLevel).toMatch(
      /individual|collaborative|consensus/,
    );
    expect(response.consensusLevel).toBeGreaterThanOrEqual(0);
    expect(response.synthesisTime).toBeGreaterThan(0);
  }, 60000); // 60 second timeout for AI response

  test("should demonstrate personality differences", async () => {
    if (!process.env.OPENAI_API_KEY && !process.env.GOOGLE_AI_API_KEY) {
      return; // Skip test
    }

    console.log("🎭 Testing personality differences...");

    const response = await conferenceManager.converse(
      "test-user",
      "humor-test",
      "What is humor? Why do humans laugh?",
      "Show different perspectives from multiple personalities.",
      { forceCollaboration: true },
    );

    console.log("🎪 Humor debate results:");
    console.log("Participants:", response.providers);
    console.log(
      "Response preview:",
      response.response.substring(0, 300) + "...",
    );

    expect(response.response).toBeTruthy();
    expect(response.response.length).toBeGreaterThan(50); // More realistic for real responses
  }, 45000);
});
