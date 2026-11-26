#!/usr/bin/env node
/**
 * Multi-Personality Demo
 * Simple demo script to test multiple Zenbot personalities debating
 * Bypasses all test mocking - uses real APIs
 */

import { DefaultAIServiceManager } from "./services/ai/aiServiceManager";
import { UnifiedConferenceManager } from "./services/ai/unifiedConferenceManager";
import { MemorySessionStorage } from "./services/ai/storage/memoryStorage";
import { ZenbotService } from "./services/zenbotService";

console.log("🎭 Multi-Personality Demo Starting...\n");

async function demo() {
  // Timeout for safety
  const timeout = setTimeout(() => {
    console.log("⏰ Demo timeout - exiting");
    process.exit(0);
  }, 120000); // 2 minutes

  try {
    // Check for real API keys
    if (!process.env.OPENAI_API_KEY && !process.env.GOOGLE_AI_API_KEY) {
      console.log("❌ No API keys found!");
      console.log(
        "Set OPENAI_API_KEY or GOOGLE_AI_API_KEY in your environment",
      );
      console.log(
        "Example: OPENAI_API_KEY=your_key npm run demo:multi-personality",
      );
      process.exit(1);
    }

    console.log("🔑 API Keys found:");
    if (process.env.OPENAI_API_KEY) console.log("  ✅ OpenAI");
    if (process.env.GOOGLE_AI_API_KEY) console.log("  ✅ Google Gemini");
    console.log();

    // Real AI config
    const aiConfig = {
      defaultProvider: process.env.GOOGLE_AI_API_KEY
        ? ("gemini" as const)
        : ("openai" as const),
      providers: {
        ...(process.env.OPENAI_API_KEY && {
          openai: {
            apiKey: process.env.OPENAI_API_KEY,
            defaultModel: "gpt-4o-mini",
          },
        }),
        ...(process.env.GOOGLE_AI_API_KEY && {
          gemini: {
            apiKey: process.env.GOOGLE_AI_API_KEY,
            defaultModel: "gemini-2.5-flash",
          },
        }),
      },
      session: {
        defaultExpiry: 60,
        maxMessages: 15,
        cleanupInterval: 30,
        storage: "memory" as const,
      },
    };

    console.log("🤖 Initializing AI services...");
    const storage = new MemorySessionStorage();
    const aiManager = new DefaultAIServiceManager(aiConfig, storage);
    ZenbotService.initialize(aiManager);
    console.log("✅ Services initialized");

    // Multi-personality conference config
    const conferenceConfig = {
      enableCollaboration: true,
      requireConsensus: false,
      maxProvidersPerQuery: 4,
      debateRounds: 1,
      consensusThreshold: 0.7,
      zenbotPersonalities: [
        "zenbot-default",
        "zenbot-philosopher",
        "zenbot-chaos",
      ],
      specialization: {
        reasoning: ["openai", "gemini"],
        functions: ["openai"],
        creativity: ["openai", "gemini"],
        speed: ["gemini"],
      },
    };

    console.log("🎭 Creating multi-personality conference...");
    console.log("Personalities:", conferenceConfig.zenbotPersonalities);

    // Add some delay to see registration logs
    const conferenceManager = new UnifiedConferenceManager(
      aiManager,
      conferenceConfig,
    );

    // Give it a moment for initialization
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log("✅ Conference ready\n");

    // Demo debate
    console.log("🧠 DEMO: Multi-Personality Philosophical Debate");
    console.log("━".repeat(60));
    console.log("Question: What is consciousness?");
    console.log("Participants: Multiple Zenbot personalities + AI providers");
    console.log("⏰ Starting debate...\n");

    const startTime = Date.now();
    const response = await conferenceManager.converse(
      "demo-user",
      "consciousness-demo",
      "What is consciousness? Are we truly aware or just sophisticated pattern matching?",
      "Let multiple perspectives debate this fundamental question about the nature of mind and awareness.",
      { forceCollaboration: true },
    );

    const elapsed = Date.now() - startTime;

    console.log("🎉 DEBATE COMPLETE!");
    console.log("━".repeat(60));
    console.log(`⏱️  Duration: ${elapsed}ms (${(elapsed / 1000).toFixed(1)}s)`);
    console.log(`🎭 Participants: ${response.providers.join(", ")}`);
    console.log(`📊 Conference Level: ${response.conferenceLevel}`);
    console.log(`🎯 Consensus Level: ${response.consensusLevel.toFixed(2)}`);
    console.log(`📝 Response Length: ${response.response.length} characters`);
    console.log(`🔄 Synthesis Time: ${response.synthesisTime}ms`);
    console.log("━".repeat(60));

    console.log("\n💬 RESPONSE:");
    console.log("-".repeat(40));
    console.log(response.response);
    console.log("-".repeat(40));

    // Success metrics
    console.log("\n📊 DEMO RESULTS:");
    if (response.providers.length > 1) {
      console.log("✅ Multi-participant debate successful");
    } else {
      console.log("⚠️  Single participant response");
    }

    if (response.response.length > 200) {
      console.log("✅ Substantial response generated");
    } else {
      console.log("⚠️  Short response - may indicate issues");
    }

    if (response.consensusLevel > 0.5) {
      console.log("✅ Good consensus achieved");
    } else {
      console.log("⚠️  Low consensus - diverse opinions");
    }

    console.log("\n🎭 Multi-Personality Demo Complete!");

    // Cleanup
    await conferenceManager.cleanup();
    clearTimeout(timeout);
    process.exit(0);
  } catch (error: any) {
    clearTimeout(timeout);
    console.error("❌ Demo failed:");
    console.error(error.message);
    if (error.stack) {
      console.error("\n🔍 Stack trace:");
      console.error(error.stack);
    }
    process.exit(1);
  }
}

demo();
