/**
 * Test Claude vs OpenAI Comparison
 * Tests conversation memory and provider switching with both AI services
 */

import "dotenv/config";
import { AIServiceManager, MemorySessionStorage } from "./services/ai";
import { AI_CONFIG } from "./config/aiConfig";
import { ZenbotService } from "./services/zenbotService";
import { logger } from "./utils/logger";

// Mock interaction for testing
const mockInteraction = {
  user: {
    id: "test-user-456", // Different user ID for separate session
    username: "claudeuser",
    displayName: "Claude Test User",
  },
  guildId: "test-guild-789",
  channelId: "test-channel-012",
  client: {
    users: {
      fetch: async (id: string) => ({ username: "claudeuser" }),
    },
  },
} as any;

async function testProviderComparison() {
  try {
    console.log("🧘 Testing AI Provider Comparison (OpenAI vs Claude)...");
    console.log(
      "ANTHROPIC_API_KEY available:",
      !!process.env.ANTHROPIC_API_KEY,
    );

    if (!process.env.ANTHROPIC_API_KEY) {
      console.log(
        "⚠️ ANTHROPIC_API_KEY not set. Please set it to test Claude:",
      );
      console.log("export ANTHROPIC_API_KEY=your_key_here");
      return;
    }

    // Update config to include Anthropic
    const testConfig = {
      ...AI_CONFIG,
      providers: {
        ...AI_CONFIG.providers,
        anthropic: {
          apiKey: process.env.ANTHROPIC_API_KEY,
          defaultModel: "claude-3-5-haiku-20241022",
          maxTokens: 1000,
          temperature: 0.7,
        },
      },
    };

    console.log("🤖 Available providers:", Object.keys(testConfig.providers));

    // Initialize AI services with both providers
    const sessionStorage = new MemorySessionStorage();
    const aiManager = new AIServiceManager(testConfig, sessionStorage);

    // Initialize Unified Zenyatta Service
    ZenbotService.initialize(aiManager);
    const zenyatta = ZenbotService.getInstance();

    // Test provider health
    console.log("\n=== Provider Health Check ===");
    const health = await aiManager.healthCheck();
    console.log("Provider Health:", health);

    // Test 1: OpenAI Conversation
    console.log("\n=== Test 1: OpenAI Conversation ===");
    testConfig.defaultProvider = "openai";
    const openaiResponse = await zenyatta.converse(
      mockInteraction,
      "Hello Zenyatta, tell me about the nature of balance.",
    );
    console.log(
      "OpenAI Response:",
      openaiResponse.text.substring(0, 200) + "...",
    );
    console.log("Session ID:", openaiResponse.sessionId);
    console.log("Provider used:", testConfig.defaultProvider);

    // Test 2: Switch to Claude for same conversation
    console.log("\n=== Test 2: Claude Continuation ===");
    // Get the session and manually update it to use Claude
    const session = await aiManager
      .getProvider()
      .getSession(openaiResponse.sessionId);
    if (session) {
      await aiManager.getProvider().updateSession(openaiResponse.sessionId, {
        provider: "anthropic",
        model: "claude-3-5-haiku-20241022",
      });
    }

    // Create Claude manager for this test
    const claudeManager = new AIServiceManager(
      {
        ...testConfig,
        defaultProvider: "anthropic",
      },
      sessionStorage,
    );

    // Test Claude with same session context
    const claudeResponse = await claudeManager.chat(
      openaiResponse.sessionId,
      "Can you elaborate on what we just discussed about balance?",
    );
    console.log("Claude Response:", claudeResponse.substring(0, 200) + "...");

    // Test 3: Remark Generation Comparison
    console.log("\n=== Test 3: Remark Generation Comparison ===");

    // Reset to OpenAI
    const openaiRemark = await zenyatta.generateRemark(
      mockInteraction,
      "a wise teacher",
      true,
    );
    console.log("OpenAI Remark:", openaiRemark.text);

    // Switch to Claude for comparison
    ZenbotService.initialize(claudeManager);
    const zenyattaClaude = ZenbotService.getInstance();

    const claudeRemark = await zenyattaClaude.generateRemark(
      {
        ...mockInteraction,
        user: { ...mockInteraction.user, id: "claude-test-789" },
      },
      "a wise teacher",
      true,
    );
    console.log("Claude Remark:", claudeRemark.text);

    // Test 4: Provider Performance
    console.log("\n=== Test 4: Performance Comparison ===");

    const startOpenAI = Date.now();
    await aiManager
      .getProvider("openai")
      .generateText("Give me a short zen quote.");
    const openAITime = Date.now() - startOpenAI;

    const startClaude = Date.now();
    await aiManager
      .getProvider("anthropic")
      .generateText("Give me a short zen quote.");
    const claudeTime = Date.now() - startClaude;

    console.log(`OpenAI Response Time: ${openAITime}ms`);
    console.log(`Claude Response Time: ${claudeTime}ms`);

    // Test 5: Session Statistics
    console.log("\n=== Test 5: Final Statistics ===");
    const stats = await aiManager.getStats();
    console.log("Final Stats:", stats);

    console.log("✅ Provider comparison tests completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

// Run tests
testProviderComparison();
