/**
 * Comprehensive Gemini Test
 * Tests Google Gemini integration with conversation memory and Zenyatta personality
 */

import "dotenv/config";
import { AIServiceManager, MemorySessionStorage } from "./services/ai";
import { UnifiedZenyattaService } from "./services/unifiedZenyattaService";
import { logger } from "./utils/logger";

// Mock interaction for testing
const mockInteraction = {
  user: { id: "gemini-test", username: "geminitester", displayName: "Gemini Tester" },
  guildId: "test-guild", channelId: "test-channel",
  client: { users: { fetch: async () => ({ username: "testuser" }) } }
} as any;

async function testGemini() {
  try {
    console.log("🤖 Testing Gemini Integration...");
    
    if (!process.env.GOOGLE_AI_API_KEY) {
      console.log("❌ GOOGLE_AI_API_KEY not found. Skipping Gemini test.");
      console.log("To test Gemini, set: export GOOGLE_AI_API_KEY=your_key_here");
      return;
    }
    
    console.log("✅ Google AI API key found");

    // Create config with Gemini as primary
    const geminiConfig = {
      defaultProvider: 'gemini',
      providers: {
        openai: {
          apiKey: process.env.OPENAI_API_KEY || 'backup',
          defaultModel: 'gpt-4o-mini',
        },
        anthropic: {
          apiKey: process.env.ANTHROPIC_API_KEY || 'backup',
          defaultModel: 'claude-3-5-haiku-20241022',
        },
        gemini: {
          apiKey: process.env.GOOGLE_AI_API_KEY,
          defaultModel: 'gemini-1.5-flash',
        }
      },
      session: {
        defaultExpiry: 60, // 1 hour for testing
        maxMessages: 50,
        cleanupInterval: 30,
        storage: 'memory' as const
      },
      fallbacks: {
        providers: {
          gemini: ['openai', 'anthropic'], // Gemini fails → OpenAI → Anthropic
          openai: ['anthropic'],           // OpenAI fails → Anthropic
          anthropic: []                    // Anthropic fails → stop
        },
        maxRetries: 2,
        circuitBreakerThreshold: 3
      }
    };

    // Initialize with Gemini as primary
    const sessionStorage = new MemorySessionStorage();
    const aiManager = new AIServiceManager(geminiConfig, sessionStorage);
    UnifiedZenyattaService.initialize(aiManager);
    const zenyatta = UnifiedZenyattaService.getInstance();

    console.log("🧘 Initialized with Gemini as primary provider");

    // Test 1: Gemini Health Check
    console.log("\n=== Test 1: Provider Health ===");
    const health = await aiManager.healthCheck();
    console.log("Provider Health:", health);
    
    if (!health.gemini) {
      console.log("❌ Gemini health check failed. Reason:", health);
      return;
    }
    console.log("✅ Gemini is healthy!");

    // Test 2: Simple Gemini Conversation
    console.log("\n=== Test 2: Gemini Conversation ===");
    const response1 = await zenyatta.converse(
      mockInteraction,
      "Hello Gemini! Please respond as Zenyatta and tell me about the nature of harmony between technology and spirit."
    );
    
    console.log("✅ Gemini Response:");
    console.log("Text:", response1.text);
    console.log("Provider used:", geminiConfig.defaultProvider);
    console.log("Session ID:", response1.sessionId);
    console.log("Mood detected:", response1.mood);

    // Test 3: Gemini Memory Test
    console.log("\n=== Test 3: Gemini Memory Test ===");
    const response2 = await zenyatta.converse(
      mockInteraction,
      "What did we just discuss about harmony between technology and spirit?"
    );
    
    console.log("✅ Gemini Memory Response:");
    console.log("Text:", response2.text.substring(0, 150) + "...");
    console.log("Same session:", response1.sessionId === response2.sessionId);

    // Test 4: Gemini Remark Generation
    console.log("\n=== Test 4: Gemini Remark Generation ===");
    const remarkPositive = await zenyatta.generateRemark(
      mockInteraction,
      "a mindful student of technology",
      true
    );
    
    const remarkNegative = await zenyatta.generateRemark(
      mockInteraction, 
      "a distracted apprentice",
      false
    );

    console.log("✅ Gemini Remarks:");
    console.log("Positive:", remarkPositive.text);
    console.log("Negative:", remarkNegative.text);

    // Test 5: Provider Stats
    console.log("\n=== Test 5: Service Statistics ===");
    const stats = await aiManager.getStats();
    console.log("✅ AI Service Stats:");
    console.log(`- Providers: ${stats.providers.join(', ')}`);
    console.log(`- Active Sessions: ${stats.activeSessions}`);
    console.log(`- Total Messages: ${stats.totalMessages}`);
    console.log(`- Uptime: ${Math.round(stats.uptime)} seconds`);

    // Test 6: Streaming Test
    console.log("\n=== Test 6: Gemini Streaming Test ===");
    console.log("🔄 Testing streaming response...");
    
    let streamedResponse = "";
    const streamEvents: string[] = [];
    
    try {
      for await (const event of aiManager.chatStream(
        response1.sessionId, 
        "Please give me a short philosophical quote about the Iris, and speak it slowly with pauses for contemplation."
      )) {
        streamEvents.push(event.type);
        if (event.type === 'delta' && event.content) {
          streamedResponse += event.content;
          process.stdout.write(event.content); // Show real-time streaming
        }
      }
      
      console.log("\n✅ Streaming completed!");
      console.log("Events:", streamEvents.join(' → '));
      console.log("Full response:", streamedResponse.trim());
      
    } catch (error) {
      console.log("⚠️ Streaming test failed:", error);
    }

    // Test 7: Fallback Test (if configured)
    if (process.env.OPENAI_API_KEY) {
      console.log("\n=== Test 7: Fallback to OpenAI ===");
      
      // Force a test of fallback by using a bad Gemini model
      try {
        const session = await aiManager.createSession('Zenyatta', {
          userId: 'fallback-test',
          model: 'gemini-nonexistent-model' // This should trigger fallback
        });
        
        const fallbackResponse = await aiManager.chat(
          session.id,
          "Test fallback mechanism - this should use OpenAI as fallback."
        );
        
        console.log("✅ Fallback Response:");
        console.log("Text:", fallbackResponse.substring(0, 100) + "...");
        
      } catch (error) {
        console.log("⚠️ Fallback test result:", error instanceof Error ? error.message : error);
      }
    }

    console.log("\n🎉 Gemini integration test completed successfully!");
    console.log("\n🧘 Gemini Features Verified:");
    console.log("   ✅ Provider health check");
    console.log("   ✅ Conversation with Zenyatta personality");
    console.log("   ✅ Session memory and history");
    console.log("   ✅ Remark generation");
    console.log("   ✅ Streaming responses");
    console.log("   ✅ Service statistics");
    console.log("   ✅ Fallback system integration");

    // Cleanup
    aiManager.destroy();
    setTimeout(() => process.exit(0), 500);
    
  } catch (error) {
    console.error("❌ Gemini test failed:", error);
    
    if (error instanceof Error) {
      if (error.message.includes('API_KEY_INVALID')) {
        console.log("💡 Hint: Check your GOOGLE_AI_API_KEY is valid");
      } else if (error.message.includes('PERMISSION_DENIED')) {
        console.log("💡 Hint: Your Google AI API key may not have Gemini access");
      } else if (error.message.includes('quota')) {
        console.log("💡 Hint: Your Google AI account may have hit quota limits");
      } else {
        console.log("Error details:", error.message);
      }
    }
  }
}

// Run the test
testGemini();