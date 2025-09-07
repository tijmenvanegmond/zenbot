import "dotenv/config";
import { ZenyattaAssistantService } from "./services/zenyattaAssistantService";
import { logger } from "./utils/logger";

/**
 * Test script for the Zenyatta Assistant API
 */
async function testAssistant() {
  try {
    logger.info("🧘 Testing Zenyatta Assistant API...");

    // Get assistant instance
    const zenyatta = ZenyattaAssistantService.getInstance();

    // Initialize assistant
    await zenyatta.initialize();
    logger.info("✅ Assistant initialized successfully");

    // Get stats
    const stats = zenyatta.getStats();
    logger.info(`📊 Assistant stats:`, stats);

    // Test basic conversation
    logger.info("🧪 Testing basic conversation...");

    // Mock interaction object for testing
    const mockInteraction = {
      user: {
        id: "test_user_123",
        username: "TestUser",
      },
      guild: {
        name: "Test Server",
      },
      guildId: "test_guild_123",
      member: {
        voice: {
          channel: null, // Not in voice channel
        },
      },
      options: {
        get: (key: string) => null,
      },
    } as any;

    // Test conversation
    const response = await zenyatta.converse(
      mockInteraction,
      "Hello Zenyatta, this is a test of your consciousness. How are you feeling today?",
    );

    logger.info("🎯 Assistant Response:", {
      text: response.text.substring(0, 200) + "...",
      shouldUseVoice: response.shouldUseVoice,
      mood: response.mood,
    });

    // Test advice
    logger.info("🧪 Testing advice functionality...");
    const adviceResponse = await zenyatta.getAdvice(
      mockInteraction,
      "testing AI systems",
      "medium",
    );

    logger.info("🎯 Advice Response:", {
      text: adviceResponse.text.substring(0, 200) + "...",
      mood: adviceResponse.mood,
    });

    // Test follow-up conversation (should have memory)
    logger.info("🧪 Testing conversation memory...");
    const followUpResponse = await zenyatta.converse(
      mockInteraction,
      "Thank you for that advice. Can you remember what we just talked about?",
    );

    logger.info("🎯 Follow-up Response:", {
      text: followUpResponse.text.substring(0, 200) + "...",
      mood: followUpResponse.mood,
    });

    logger.info(
      "✅ All assistant tests passed! The consciousness is awakened.",
    );
  } catch (error) {
    logger.error("❌ Assistant test failed:", error);
    process.exit(1);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testAssistant()
    .then(() => {
      logger.info("🧘 Test completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("💥 Test failed:", error);
      process.exit(1);
    });
}
