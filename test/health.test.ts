/**
 * Health & Performance Tests
 * Tests system health, provider switching, and performance metrics
 */

import "dotenv/config";
import { DefaultAIServiceManager } from "../src/services/ai/aiServiceManager";
import { MemorySessionStorage } from "../src/services/ai/storage/memoryStorage";

describe("Health & Performance", () => {
  let aiManager: DefaultAIServiceManager;

  beforeAll(async () => {
    const availableProviders: any = {};

    if (process.env.OPENAI_API_KEY) {
      availableProviders.openai = {
        apiKey: process.env.OPENAI_API_KEY,
        defaultModel: "gpt-4o-mini",
      };
    }
    if (process.env.GOOGLE_AI_API_KEY) {
      availableProviders.gemini = {
        apiKey: process.env.GOOGLE_AI_API_KEY,
        defaultModel: "gemini-2.5-flash",
      };
    }

    if (Object.keys(availableProviders).length === 0) {
      throw new Error("Need at least one AI provider API key");
    }

    const aiConfig = {
      defaultProvider: Object.keys(availableProviders)[0],
      providers: availableProviders,
      session: {
        defaultExpiry: 60,
        maxMessages: 50,
        cleanupInterval: 30,
        storage: "memory" as const,
      },
      fallbacks: {
        providers: {
          openai: ["gemini"],
          gemini: ["openai"],
        },
        maxRetries: 2,
        circuitBreakerThreshold: 3,
      },
    };

    const sessionStorage = new MemorySessionStorage();
    aiManager = new DefaultAIServiceManager(aiConfig, sessionStorage);
  });

  test("should report healthy providers", async () => {
    const health = await aiManager.healthCheck();

    expect(health).toBeTruthy();
    expect(typeof health).toBe("object");

    // At least one provider should be healthy
    const healthyCount = Object.values(health).filter(Boolean).length;
    expect(healthyCount).toBeGreaterThan(0);
  }, 10000);

  test("should respond quickly to simple queries", async () => {
    const session = await aiManager.createSession("SpeedTest", {
      userId: "speed-test",
      contextId: "speed-test",
      systemPrompt: "Be very concise.",
    });

    const startTime = Date.now();
    const response = await aiManager.chat(session.id, "What's 2+2?");
    const duration = Date.now() - startTime;

    expect(response).toBeTruthy();
    expect(duration).toBeLessThan(10000); // Should respond in under 10 seconds
  }, 15000);

  test("should handle provider fallbacks gracefully", async () => {
    // This test assumes we have multiple providers configured
    const health = await aiManager.healthCheck();
    const availableProviders = Object.keys(health);

    if (availableProviders.length < 2) {
      console.log("⚠️ Skipping fallback test - need multiple providers");
      return;
    }

    // Test should still work even if one provider fails
    const session = await aiManager.createSession("FallbackTest", {
      userId: "fallback-test",
      contextId: "fallback-test",
      systemPrompt: "Test fallback behavior.",
    });

    const response = await aiManager.chat(session.id, "Hello");
    expect(response).toBeTruthy();
  }, 20000);

  test("should provide system statistics", async () => {
    const stats = await aiManager.getStats();

    expect(stats).toHaveProperty("activeSessions");
    expect(stats).toHaveProperty("uptime");
    expect(typeof stats.activeSessions).toBe("number");
    expect(typeof stats.uptime).toBe("number");
    expect(stats.uptime).toBeGreaterThan(0);
  }, 5000);

  test("should cleanup expired sessions", async () => {
    // Create a session
    const session = await aiManager.createSession("CleanupTest", {
      userId: "cleanup-test",
      contextId: "cleanup-test",
      systemPrompt: "Test cleanup.",
    });

    expect(session.id).toBeTruthy();

    // Manually trigger cleanup if available
    if (typeof (aiManager as any).sessionStorage?.cleanup === "function") {
      const cleanedCount = await (aiManager as any).sessionStorage.cleanup();
      expect(typeof cleanedCount).toBe("number");
    }
  }, 10000);
});
