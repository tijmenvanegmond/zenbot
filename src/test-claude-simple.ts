/**
 * Simple Claude Test
 * Quick test to verify Claude integration works
 */

import "dotenv/config";
import { AIServiceManager, MemorySessionStorage } from "./services/ai";
import { ZenbotService } from "./services/zenbotService";
import { logger } from "./utils/logger";

// Mock interaction
const mockInteraction = {
  user: {
    id: "claude-test",
    username: "claudetester",
    displayName: "Claude Tester",
  },
  guildId: "test-guild",
  channelId: "test-channel",
  client: { users: { fetch: async () => ({ username: "testuser" }) } },
} as any;

async function testClaude() {
  try {
    console.log("🤖 Testing Claude Integration...");

    if (!process.env.ANTHROPIC_API_KEY) {
      console.log("❌ ANTHROPIC_API_KEY not found. Skipping Claude test.");
      console.log(
        "To test Claude, set: export ANTHROPIC_API_KEY=your_key_here",
      );
      return;
    }

    console.log("✅ Anthropic API key found");

    // Create config with Claude as primary
    const claudeConfig = {
      defaultProvider: "anthropic",
      providers: {
        openai: {
          apiKey: process.env.OPENAI_API_KEY || "backup",
          defaultModel: "gpt-4o-mini",
        },
        anthropic: {
          apiKey: process.env.ANTHROPIC_API_KEY,
          defaultModel: "claude-3-5-haiku-20241022",
        },
      },
      session: {
        defaultExpiry: 60, // 1 hour for testing
        maxMessages: 50,
        cleanupInterval: 30,
        storage: "memory" as const,
      },
      fallbacks: {
        providers: {
          anthropic: ["openai"], // Claude fails → OpenAI
          openai: [], // OpenAI fails → stop
        },
        maxRetries: 2,
      },
    };

    // Initialize with Claude as primary
    const sessionStorage = new MemorySessionStorage();
    const aiManager = new AIServiceManager(claudeConfig, sessionStorage);
    ZenbotService.initialize(aiManager);
    const zenyatta = ZenbotService.getInstance();

    console.log("🧘 Initialized with Claude as primary provider");

    // Test 1: Direct Claude Health Check
    console.log("\n=== Test 1: Provider Health ===");
    const health = await aiManager.healthCheck();
    console.log("Provider Health:", health);

    if (!health.anthropic) {
      console.log("❌ Claude health check failed. Reason:", health);
      return;
    }
    console.log("✅ Claude is healthy!");

    // Test 2: Simple Claude Conversation
    console.log("\n=== Test 2: Claude Conversation ===");
    const response1 = await zenyatta.converse(
      mockInteraction,
      "Hello Claude! Please respond as Zenyatta and tell me about the nature of tranquility.",
    );

    console.log("✅ Claude Response:");
    console.log("Text:", response1.text);
    console.log("Provider used:", claudeConfig.defaultProvider);
    console.log("Session ID:", response1.sessionId);
    console.log("Mood detected:", response1.mood);

    // Test 3: Claude Memory Test
    console.log("\n=== Test 3: Claude Memory Test ===");
    const response2 = await zenyatta.converse(
      mockInteraction,
      "What did we just discuss about tranquility?",
    );

    console.log("✅ Claude Memory Response:");
    console.log("Text:", response2.text.substring(0, 150) + "...");
    console.log("Same session:", response1.sessionId === response2.sessionId);

    // Test 4: Claude Remark Generation
    console.log("\n=== Test 4: Claude Remark Generation ===");
    const remarkPositive = await zenyatta.generateRemark(
      mockInteraction,
      "a wise philosopher",
      true,
    );

    const remarkNegative = await zenyatta.generateRemark(
      mockInteraction,
      "a troublesome student",
      false,
    );

    console.log("✅ Claude Remarks:");
    console.log("Positive:", remarkPositive.text);
    console.log("Negative:", remarkNegative.text);

    // Test 5: Compare with OpenAI
    console.log("\n=== Test 5: Provider Comparison ===");

    // Force switch to OpenAI by updating session
    const session = await aiManager
      .getProvider()
      .getSession(response1.sessionId);
    if (session) {
      await aiManager.getProvider().updateSession(response1.sessionId, {
        provider: "openai",
        model: "gpt-4o-mini",
      });

      const openaiResponse = await aiManager.chat(
        response1.sessionId,
        "Now respond as if you're using a different AI model - what's your perspective?",
      );

      console.log("✅ OpenAI Response (same session):");
      console.log("Text:", openaiResponse.substring(0, 150) + "...");
    }

    console.log("\n🎉 Claude integration test completed successfully!");
  } catch (error) {
    console.error("❌ Claude test failed:", error);

    if (error instanceof Error) {
      if (error.message.includes("credit balance")) {
        console.log(
          "💡 Hint: Your Anthropic account needs credits to use Claude",
        );
      } else if (error.message.includes("invalid_request_error")) {
        console.log("💡 Hint: Check your Anthropic API key is valid");
      } else {
        console.log("Error details:", error.message);
      }
    }
  }
}

// Run the test
testClaude();
