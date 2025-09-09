/**
 * Test Discord Response Length
 * Quick test to verify AI responds concisely for Discord
 */

import "dotenv/config";
import { AIServiceManager, MemorySessionStorage } from "./services/ai";
import { AI_CONFIG } from "./config/aiConfig";
import { ZenbotService } from "./services/zenbotService";

const mockInteraction = {
  user: { id: "discord-test", username: "testuser", displayName: "Test User" },
  guildId: "test-guild",
  channelId: "test-channel",
  client: { users: { fetch: async () => ({ username: "testuser" }) } },
} as any;

async function testDiscordLength() {
  try {
    console.log("🧘 Testing Discord Response Length...");

    // Initialize with our production config
    const sessionStorage = new MemorySessionStorage();
    const aiManager = new AIServiceManager(AI_CONFIG, sessionStorage);
    ZenbotService.initialize(aiManager);
    const zenyatta = ZenbotService.getInstance();

    console.log("✅ Initialized with production AI config\n");

    const testQuestions = [
      "What is the nature of the Iris?",
      "Give me philosophical advice about dealing with stress",
      "Tell me about harmony and balance",
      "What does it mean to experience tranquility?",
      "How can I find inner peace?",
    ];

    console.log("🎯 Testing response conciseness...\n");

    for (const question of testQuestions) {
      console.log(`❓ Question: "${question}"`);
      console.log("-".repeat(50));

      try {
        const response = await zenyatta.converse(mockInteraction, question);

        console.log(`💭 Response (${response.text.length} chars):`);
        console.log(`"${response.text}"`);
        console.log(`🎭 Mood: ${response.mood}\n`);

        // Check if response is Discord-friendly
        if (response.text.length > 500) {
          console.log(
            `⚠️ Warning: Response is ${response.text.length} chars (might be too long for Discord)`,
          );
        } else if (response.text.length > 200) {
          console.log(
            `📏 Response is ${response.text.length} chars (acceptable length)`,
          );
        } else {
          console.log(
            `✅ Response is ${response.text.length} chars (perfect for Discord)`,
          );
        }

        console.log();

        // Brief pause between requests
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.log(
          `❌ Error: ${error instanceof Error ? error.message : error}\n`,
        );
      }
    }

    // Get final stats
    const stats = await aiManager.getStats();
    console.log("📊 Test Complete:");
    console.log(`   Provider: ${AI_CONFIG.defaultProvider}`);
    console.log(`   Sessions: ${stats.activeSessions}`);
    console.log(`   Messages: ${stats.totalMessages}`);

    // Cleanup
    aiManager.destroy();
    setTimeout(() => {
      console.log("🧘 Experience harmony... test complete.");
      process.exit(0);
    }, 500);
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

testDiscordLength();
