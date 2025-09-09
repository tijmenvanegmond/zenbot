/**
 * Test script for Unified Zenyatta Service
 * Verifies that the AI abstraction layer works with conversation memory
 */

import "dotenv/config";
import { AIServiceManager, MemorySessionStorage } from "./services/ai";
import { AI_CONFIG } from "./config/aiConfig";
import { ZenbotService } from "./services/zenbotService";
import { logger } from "./utils/logger";

// Mock interaction for testing
const mockInteraction = {
  user: {
    id: "test-user-123",
    username: "testuser",
    displayName: "Test User",
  },
  guildId: "test-guild-456",
  channelId: "test-channel-789",
  client: {
    users: {
      fetch: async (id: string) => ({ username: "mockuser" }),
    },
  },
} as any;

async function testUnifiedZenyatta() {
  try {
    logger.info("🧘 Testing Unified Zenyatta Service...");

    // Initialize AI services
    const sessionStorage = new MemorySessionStorage();
    const aiManager = new AIServiceManager(AI_CONFIG, sessionStorage);

    // Initialize Unified Zenyatta Service
    ZenbotService.initialize(aiManager);
    const zenyatta = ZenbotService.getInstance();

    logger.info(
      "🤖 AI Manager initialized with providers:",
      Object.keys(AI_CONFIG.providers),
    );

    // Test 1: Basic conversation
    logger.info("\n=== Test 1: Basic Conversation ===");
    const response1 = await zenyatta.converse(
      mockInteraction,
      "Hello Zenyatta, how are you today?",
    );
    console.log("Response 1:", response1.text);
    console.log("Session ID:", response1.sessionId);
    console.log("Mood:", response1.mood);

    // Test 2: Conversation with memory (should remember previous interaction)
    logger.info("\n=== Test 2: Conversation Memory ===");
    const response2 = await zenyatta.converse(
      mockInteraction,
      "What did we just talk about?",
    );
    console.log("Response 2:", response2.text);
    console.log("Same session?", response1.sessionId === response2.sessionId);

    // Test 3: Advice generation
    logger.info("\n=== Test 3: Advice Generation ===");
    const advice = await zenyatta.getAdvice(
      mockInteraction,
      "meditation",
      "medium",
    );
    console.log("Advice:", advice.text);

    // Test 4: Remark generation
    logger.info("\n=== Test 4: Remark Generation ===");
    const positiveRemark = await zenyatta.generateRemark(
      mockInteraction,
      "a helpful person",
      true,
    );
    console.log("Positive Remark:", positiveRemark.text);

    const negativeRemark = await zenyatta.generateRemark(
      mockInteraction,
      "a troublemaker",
      false,
    );
    console.log("Negative Remark:", negativeRemark.text);

    // Test 5: Service stats
    logger.info("\n=== Test 5: Service Statistics ===");
    const stats = await zenyatta.getStats();
    console.log("Stats:", stats);

    // Test 6: Health check
    logger.info("\n=== Test 6: Provider Health Check ===");
    const health = await aiManager.healthCheck();
    console.log("Provider Health:", health);

    logger.info("✅ All tests completed successfully!");
  } catch (error) {
    logger.error("❌ Test failed:", error);
    process.exit(1);
  }
}

// Run tests
testUnifiedZenyatta();
