/**
 * AI Provider Integration Tests
 * Tests individual providers and multi-provider coordination
 */

import "dotenv/config";
import { DefaultAIServiceManager } from "../src/services/ai/aiServiceManager";
import { MemorySessionStorage } from "../src/services/ai/storage/memoryStorage";

describe("AI Provider Integration", () => {
  let aiManager: DefaultAIServiceManager;
  let sessionStorage: MemorySessionStorage;

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
      throw new Error("Need at least one AI provider API key for testing");
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
    };

    sessionStorage = new MemorySessionStorage();
    aiManager = new DefaultAIServiceManager(aiConfig, sessionStorage);
  });

  afterAll(async () => {
    if (typeof (aiManager as any).destroy === "function") {
      (aiManager as any).destroy();
    }
  });

  test("should handle basic chat conversation", async () => {
    const session = await aiManager.createSession("TestBot", {
      userId: "test-user",
      contextId: "test-context",
      systemPrompt: "You are a helpful AI assistant. Be concise.",
    });

    expect(session.id).toBeTruthy();

    const response = await aiManager.chat(session.id, "Hello, how are you?");

    expect(response).toBeTruthy();
    expect(typeof response).toBe("string");
    expect(response.length).toBeGreaterThan(0);
  }, 15000);

  test("should maintain conversation context", async () => {
    const session = await aiManager.createSession("TestBot", {
      userId: "test-user",
      contextId: "test-context",
      systemPrompt: "You are a helpful AI assistant. Remember what users tell you.",
    });

    await aiManager.chat(session.id, "My name is Alex and I like philosophy.");
    const response = await aiManager.chat(session.id, "What did I tell you about my interests?");

    expect(response.toLowerCase()).toContain("philosophy");
  }, 20000);

  test("should handle provider health checks", async () => {
    const healthStatus = await aiManager.healthCheck();

    expect(healthStatus).toBeTruthy();
    expect(typeof healthStatus).toBe("object");

    // At least one provider should be healthy
    const healthyProviders = Object.values(healthStatus).filter(healthy => healthy);
    expect(healthyProviders.length).toBeGreaterThan(0);
  }, 10000);

  test("should provide system statistics", async () => {
    const stats = await aiManager.getStats();

    expect(stats).toBeTruthy();
    expect(stats).toHaveProperty("activeSessions");
    expect(stats).toHaveProperty("uptime");
    expect(typeof stats.activeSessions).toBe("number");
  }, 5000);

  test("should handle session cleanup", async () => {
    const session = await aiManager.createSession("TestBot", {
      userId: "test-user",
      contextId: "test-context",
      systemPrompt: "Test session for cleanup",
    });

    expect(session.id).toBeTruthy();

    // Session should exist
    const retrievedSession = await aiManager.getSession(session.id);
    expect(retrievedSession).toBeTruthy();

    // Delete session
    await aiManager.deleteSession(session.id);

    // Session should no longer exist
    const deletedSession = await aiManager.getSession(session.id);
    expect(deletedSession).toBeNull();
  }, 10000);
});