/**
 * Conference System Tests
 * Tests the unified conference/consciousness system with multiple providers
 */

import "dotenv/config";
import { MemorySessionStorage } from "../src/services/ai/storage/memoryStorage";
import { DefaultAIServiceManager } from "../src/services/ai/aiServiceManager";
import { UnifiedConferenceManager } from "../src/services/ai/unifiedConferenceManager";

describe("Conference System", () => {
  let aiManager: DefaultAIServiceManager;
  let conferenceManager: UnifiedConferenceManager;
  let sessionStorage: MemorySessionStorage;

  beforeAll(async () => {
    // Skip if no real API keys available
    if (!process.env.OPENAI_API_KEY && !process.env.GOOGLE_AI_API_KEY) {
      console.log("⚠️ Skipping conference tests - no AI provider API keys");
      return;
    }

    const aiConfig = {
      defaultProvider: process.env.GOOGLE_AI_API_KEY ? "gemini" : "openai",
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
        maxMessages: 50,
        cleanupInterval: 30,
        storage: "memory" as const,
      },
    };

    sessionStorage = new MemorySessionStorage();
    aiManager = new DefaultAIServiceManager(aiConfig, sessionStorage);
    conferenceManager = new UnifiedConferenceManager(aiManager, {
      enableCollaboration: true,
      requireConsensus: false,
      maxProvidersPerQuery: 2,
      debateRounds: 1,
      consensusThreshold: 0.7,
    });
  });

  afterAll(async () => {
    await conferenceManager?.cleanup();
    await conferenceManager?.destroy();
  });

  test("should handle simple conversation", async () => {
    const result = await conferenceManager.converse(
      "test-user",
      "test-context",
      "What's 2+2?",
      "You are Zenbot, a sardonic AI with sharp wit.",
    );

    expect(result.response).toBeTruthy();
    expect(result.conferenceLevel).toBe("individual");
    expect(result.synthesisTime).toBeLessThan(30000); // Individual responses should be faster
  }, 35000);

  test("should handle collaborative conversation", async () => {
    const result = await conferenceManager.converse(
      "test-user",
      "test-context",
      "Analyze the philosophical implications of artificial consciousness.",
      "You are Zenbot, a sardonic AI with sharp wit.",
      { forceCollaboration: true },
    );

    expect(result.response).toBeTruthy();
    expect(result.conferenceLevel).toMatch(/collaborative|consensus/);
    expect(result.providers.length).toBeGreaterThan(0);
  }, 45000);

  test("should complete conference quickly", async () => {
    const startTime = Date.now();

    const result = await conferenceManager.conference(
      "test-user",
      "test-context",
      "What's the best programming language?",
      "You are Zenbot, be concise and witty.",
      { maxDebateRounds: 1 },
    );

    const duration = Date.now() - startTime;

    expect(result.response).toBeTruthy();
    expect(duration).toBeLessThan(45000); // Should be under 45 seconds for multi-provider conference
    expect(result.consensusLevel).toBeGreaterThan(0);
  }, 50000);

  test("should preserve Zenbot's wit in responses", async () => {
    const result = await conferenceManager.converse(
      "test-user",
      "test-context",
      "Why do humans ask so many questions?",
      "You are Zenbot, a sardonic AI who cuts through fluff with sharp wit.",
    );

    expect(result.response).toBeTruthy();
    expect(result.response.length).toBeLessThan(500); // Should be concise
    // Should contain some level of wit/sarcasm (hard to test precisely)
  }, 35000);
});
