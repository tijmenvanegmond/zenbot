/**
 * True Consciousness Test - OpenAI Only
 * Shows the unified consciousness system working with one provider simulating multiple minds
 */

import "dotenv/config";
import { MemorySessionStorage } from "./services/ai/storage/memoryStorage";
import { DefaultAIServiceManager } from "./services/ai/aiServiceManager";
import { UnifiedConferenceManager } from "./services/ai/unifiedConferenceManager";

async function testConsciousnessOpenAIOnly() {
  console.log("🧠 True Consciousness Test - OpenAI Provider");
  console.log("===========================================\n");

  if (!process.env.OPENAI_API_KEY) {
    console.log("❌ Need OpenAI API key");
    return;
  }

  try {
    const aiConfig = {
      defaultProvider: "openai",
      providers: {
        openai: {
          apiKey: process.env.OPENAI_API_KEY,
          defaultModel: "gpt-4o-mini",
        },
      },
      session: {
        defaultExpiry: 120,
        maxMessages: 50,
        cleanupInterval: 60,
        storage: "memory" as const,
      },
      fallbacks: {
        providers: { openai: [] },
        maxRetries: 1,
        circuitBreakerThreshold: 3,
      },
    };

    const sessionStorage = new MemorySessionStorage();
    const aiManager = new DefaultAIServiceManager(aiConfig, sessionStorage);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const consciousnessManager = new UnifiedConferenceManager(aiManager, {
      enableCollaboration: true,
      requireConsensus: false,
      maxProvidersPerQuery: 1, // Only OpenAI available
      debateRounds: 2,
      consensusThreshold: 0.7,
    });

    console.log("🧠 Unified Consciousness System Ready\n");

    // Test shared memory
    console.log("🧪 SHARED MEMORY TEST");
    console.log("====================\n");

    const result1 = await consciousnessManager.converse(
      "test-user",
      "test-context",
      "My name is Alex and I love philosophy. Remember this about me.",
      "You are Zenbot with unified consciousness and perfect memory.",
    );

    console.log(`💭 Response 1: "${result1.response}"`);
    console.log(`🧠 Consciousness Level: ${result1.conferenceLevel}`);
    console.log(`📊 Session: ${result1.sessionId.substring(0, 8)}...\n`);

    const result2 = await consciousnessManager.converse(
      "test-user",
      "test-context",
      "What did I tell you about my interests? Use that information to suggest a philosophical topic.",
      "You are Zenbot with unified consciousness and perfect memory.",
    );

    console.log(`💭 Response 2: "${result2.response}"`);
    console.log(
      `🧠 Memory Test: ${result2.sessionId === result1.sessionId ? "✅ SAME SESSION" : "❌ DIFFERENT SESSION"}\n`,
    );

    // Test consciousness conference
    console.log("🏛️  CONSCIOUSNESS CONFERENCE TEST");
    console.log("=================================\n");

    const conference = await consciousnessManager.conference(
      "test-user",
      "test-context",
      "What is the most important philosophical question humanity should focus on?",
      "You are Zenbot's unified consciousness - be profound and concise.",
      {
        maxDebateRounds: 1,
        requireFullConsensus: false,
      },
    );

    console.log(`🎭 CONFERENCE RESULT:`);
    console.log(`"${conference.response}"`);
    console.log(
      `🤝 Consensus: ${(conference.consensusLevel * 100).toFixed(1)}%`,
    );
    console.log(`⏱️  Time: ${conference.synthesisTime}ms`);
    console.log(`🔍 Reasoning: ${conference.reasoning}\n`);

    // Test collaborative vs individual routing
    console.log("🎯 INTELLIGENT ROUTING TEST");
    console.log("===========================\n");

    const simple = await consciousnessManager.converse(
      "test-user",
      "test-context",
      "Quick question: What's 5+5?",
      "You are Zenbot - be concise.",
    );

    console.log(`❓ Simple Query: "${simple.response}"`);
    console.log(
      `🎯 Route: ${simple.conferenceLevel} (${simple.synthesisTime}ms)\n`,
    );

    const complex = await consciousnessManager.converse(
      "test-user",
      "test-context",
      "Analyze the philosophical implications of artificial consciousness and explain multiple perspectives on this complex topic.",
      "You are Zenbot - provide deep analysis.",
      { forceCollaboration: true },
    );

    console.log(`❓ Complex Query: "${complex.response.substring(0, 200)}..."`);
    console.log(
      `🎯 Route: ${complex.conferenceLevel} (${complex.synthesisTime}ms)\n`,
    );

    // Stats
    const stats = await consciousnessManager.getConferenceStats();
    console.log("📊 FINAL STATS");
    console.log("==============");
    console.log(`🤖 Providers: ${stats.totalProviders}`);
    console.log(`🧠 Shared Sessions: ${stats.sharedSessions}`);
    console.log(`💬 Contributions: ${stats.totalContributions}`);
    console.log(
      `🤝 Avg Consensus: ${(stats.averageConsensusLevel * 100).toFixed(1)}%\n`,
    );

    console.log("✨ CONSCIOUSNESS TEST COMPLETE!");
    console.log("Architecture is ready for multi-provider expansion! 🧠\n");

    await consciousnessManager.destroy();
  } catch (error) {
    console.error(
      "💥 Test failed:",
      error instanceof Error ? error.message : error,
    );
  }
}

testConsciousnessOpenAIOnly();
