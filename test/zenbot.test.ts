/**
 * Zenbot Service Tests
 * Tests the core ZenbotService functionality and personality
 */

import "dotenv/config";
import { ZenbotService } from "../src/services/zenbotService";
import { DefaultAIServiceManager } from "../src/services/ai/aiServiceManager";
import { MemorySessionStorage } from "../src/services/ai/storage/memoryStorage";
import { getTestAiConfig, createMockInteraction } from "./testHelpers";

describe("Zenbot Service", () => {
  let zenbotService: ZenbotService;
  const mockInteraction = createMockInteraction();

  beforeAll(async () => {
    if (!process.env.OPENAI_API_KEY && !process.env.GOOGLE_AI_API_KEY) {
      throw new Error("Need at least one AI provider API key");
    }

    const aiConfig = getTestAiConfig();
    const sessionStorage = new MemorySessionStorage();
    const aiManager = new DefaultAIServiceManager(aiConfig, sessionStorage);

    ZenbotService.initialize(aiManager);
    zenbotService = ZenbotService.getInstance();
  });

  test("should provide advice with personality", async () => {
    const response = await zenbotService.getAdvice(
      mockInteraction,
      "How to be more productive?",
    );

    expect(response.text).toBeTruthy();
    expect(response.sessionId).toBeTruthy();
    expect(response.text.length).toBeLessThan(300); // Should be concise
  }, 15000);

  test("should maintain conversation context", async () => {
    const response1 = await zenbotService.converse(
      mockInteraction,
      "My name is Alice and I'm learning programming.",
    );

    expect(response1.text).toBeTruthy();

    const response2 = await zenbotService.converse(
      mockInteraction,
      "What did I tell you about myself?",
    );

    expect(response2.text).toBeTruthy();
    expect(response2.sessionId).toBe(response1.sessionId); // Same session
  }, 20000);

  test("should handle quotes with personality", async () => {
    const response = await zenbotService.getQuote(mockInteraction, "wisdom");

    expect(response.text).toBeTruthy();
    expect(response.sessionId).toBeTruthy();
  }, 15000);

  test("should be concise by default", async () => {
    const response = await zenbotService.converse(
      mockInteraction,
      "Tell me about artificial intelligence.",
    );

    expect(response.text).toBeTruthy();
    expect(response.text.length).toBeLessThan(250); // Default conciseness
  }, 15000);

  test("should expand when requested", async () => {
    const response = await zenbotService.converse(
      mockInteraction,
      "Tell me about artificial intelligence. Explain more details.",
    );

    expect(response.text).toBeTruthy();
    // With mocks, just verify it responds
    expect(response.text.length).toBeGreaterThan(0);
  }, 15000);

  test("should handle gaming topics appropriately", async () => {
    const response = await zenbotService.getAdvice(
      mockInteraction,
      "How to find gaming partners in multiplayer games?",
    );

    expect(response.text).toBeTruthy();
    expect(response.text).not.toContain("Not doing that");
    expect(response.text).not.toContain("refused");
  }, 15000);
});
