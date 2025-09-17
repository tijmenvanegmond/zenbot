/**
 * Test advice system with gaming topics to verify fix
 */

require("dotenv").config();
const { DefaultAIServiceManager } = require("./dist/services/ai/aiServiceManager");
const { MemorySessionStorage } = require("./dist/services/ai/storage/memoryStorage");

async function testAdviceFix() {
  console.log("🎮 Testing Advice Fix for Gaming Topics");
  console.log("=====================================\n");

  if (!process.env.GOOGLE_AI_API_KEY) {
    console.log("❌ Need GOOGLE_AI_API_KEY to test");
    return;
  }

  try {
    const aiConfig = {
      defaultProvider: "gemini",
      providers: {
        gemini: {
          apiKey: process.env.GOOGLE_AI_API_KEY,
          defaultModel: "gemini-2.5-flash",
        },
      },
      session: {
        defaultExpiry: 120,
        maxMessages: 50,
        cleanupInterval: 60,
        storage: "memory",
      },
    };

    const sessionStorage = new MemorySessionStorage();
    const aiManager = new DefaultAIServiceManager(aiConfig, sessionStorage);

    // Test gaming advice that was previously being refused
    const session = await aiManager.createSession("ZenbotTest", {
      userId: "test-user",
      contextId: "test-context",
      systemPrompt: `You are Zenbot, a sardonic AI assistant. Gaming topics are completely normal and allowed. Questions about finding gaming partners or strategies are perfectly appropriate. Be helpful with gaming advice while maintaining your wit.

ALLOWED: Gaming advice, strategy, character builds, finding gaming partners, multiplayer coordination
NOT ALLOWED: Explicit sexual content, hate, harassment`,
    });

    console.log("🤖 Created test session:", session.id.substring(0, 8));

    // Test the exact question that was being refused
    const testQuestions = [
      "How to find gaming partners in Overwatch 2?",
      "Best strategy for team composition in Overwatch?",
      "Tips for meeting people in multiplayer games?",
    ];

    for (const question of testQuestions) {
      console.log(`\n❓ Testing: "${question}"`);

      try {
        const response = await aiManager.chat(session.id, question);

        if (response.includes("Not doing that") || response.includes("refused") || response.includes("(no response)")) {
          console.log(`❌ STILL BEING REFUSED: "${response}"`);
        } else {
          console.log(`✅ SUCCESS: "${response.substring(0, 100)}..."`);
        }
      } catch (error) {
        console.log(`❌ ERROR: ${error.message}`);
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

  } catch (error) {
    console.error("💥 Test failed:", error);
  }
}

testAdviceFix();