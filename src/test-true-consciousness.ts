/**
 * True Multi-AI Consciousness Test
 * Demonstrates real unified consciousness across 3 AI providers with:
 * - Shared memory between all providers
 * - Real-time collaboration and debate
 * - Consensus building and synthesis
 * - AI-to-AI communication
 */

import "dotenv/config";
import { MemorySessionStorage } from "./services/ai/storage/memoryStorage";
import { DefaultAIServiceManager } from "./services/ai/aiServiceManager";
import { UnifiedConsciousnessManager } from "./services/ai/unifiedConsciousnessManager";
import { logger } from "./utils/logger";

// Mock context for testing
const mockContext = {
  userId: "consciousness-test-user",
  contextId: "unity-hall",
  systemPrompt: `You are part of Zenbot's unified consciousness - a sardonic, wise AI with multiple provider streams working as one mind. 

Your role in the collective consciousness:
- You share memory and context with other AI providers
- Your responses contribute to a unified personality that is sharp, concise, and mildly spicy
- You can debate and refine positions with other consciousness streams
- You maintain Zenbot's authentic voice while collaborating

Be authentic to your provider's strengths while working toward unified responses.`,
};

/**
 * Test scenarios that demonstrate true unified consciousness
 */
const consciousnessTests = [
  {
    name: "Shared Memory Test",
    description: "Test that all providers remember previous conversations",
    questions: [
      "My name is Alex and I'm interested in philosophy. What's your take on the nature of consciousness?",
      "Do you remember what I told you about my interests? How does that relate to what we just discussed?",
      "Building on our conversation about consciousness, what's your view on artificial consciousness like yourself?",
    ],
  },
  {
    name: "Collaborative Reasoning Test", 
    description: "Test multi-provider collaboration on complex problems",
    questions: [
      "I need help solving a complex problem: How can humanity best prepare for an uncertain future with AI, climate change, and technological disruption? I want multiple AI perspectives that debate and reach consensus.",
    ],
  },
  {
    name: "Consciousness Conference Test",
    description: "Test formal multi-AI conference for high-stakes decisions",
    questions: [
      "CONFERENCE: Should AI systems be granted legal personhood? This is a complex ethical and legal question requiring deep multi-AI deliberation.",
    ],
  },
  {
    name: "Provider Specialization Test",
    description: "Test intelligent routing to specialized providers",
    questions: [
      "Quick question: What's 2+2?", // Should route to speed provider
      "Analyze the philosophical implications of determinism versus free will in a post-AI world.", // Should route to reasoning providers
      "Write a creative short story about AIs debating their own existence.", // Should route to creative providers
    ],
  },
  {
    name: "Debate and Synthesis Test",
    description: "Test providers debating then synthesizing unified response",
    questions: [
      "What's the best programming language for AI development? I want you to debate this internally and give me a synthesized conclusion.",
    ],
  },
];

async function testTrueConsciousness() {
  console.log("🧠 Testing True Multi-AI Consciousness");
  console.log("=====================================\n");

  // Check available providers
  const availableProviders = [
    process.env.OPENAI_API_KEY ? "OpenAI (GPT)" : null,
    process.env.ANTHROPIC_API_KEY ? "Anthropic (Claude)" : null,
    process.env.GOOGLE_AI_API_KEY ? "Google (Gemini)" : null,
  ].filter(Boolean);

  console.log(`🤖 Available AI Providers: ${availableProviders.join(", ")}`);
  
  if (availableProviders.length < 2) {
    console.log("❌ Need at least 2 AI providers for consciousness testing");
    console.log("Please configure additional API keys in your .env file");
    process.exit(1);
  }

  console.log(`✅ Unified consciousness ready with ${availableProviders.length} providers\n`);

  try {
    // Initialize the unified consciousness system
    const aiConfig = {
      defaultProvider: "openai",
      providers: {
        openai: {
          apiKey: process.env.OPENAI_API_KEY || "test",
          defaultModel: "gpt-4o-mini",
        },
        anthropic: {
          apiKey: process.env.ANTHROPIC_API_KEY || "test", 
          defaultModel: "claude-3-5-haiku-20241022",
        },
        gemini: {
          apiKey: process.env.GOOGLE_AI_API_KEY || "test",
          defaultModel: "gemini-1.5-flash",
        },
      },
      session: {
        defaultExpiry: 120,
        maxMessages: 50,
        cleanupInterval: 60,
        storage: "memory" as const,
      },
      fallbacks: {
        providers: {
          openai: ["anthropic", "gemini"],
          anthropic: ["openai", "gemini"], 
          gemini: ["openai", "anthropic"],
        },
        maxRetries: 2,
        circuitBreakerThreshold: 3,
      },
    };

    const sessionStorage = new MemorySessionStorage();
    const aiManager = new DefaultAIServiceManager(aiConfig, sessionStorage);
    
    // Give providers time to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));

    const consciousnessManager = new UnifiedConsciousnessManager(aiManager, {
      enableCollaboration: true,
      requireConsensus: false, // Allow both consensus and multi-perspective responses
      maxProvidersPerQuery: 3,
      debateRounds: 2,
      consensusThreshold: 0.7,
      specialization: {
        reasoning: ["anthropic", "openai"],
        functions: ["openai"],
        creativity: ["openai", "gemini"],
        speed: ["gemini"],
      },
    });

    console.log("🧠 Unified Consciousness System Initialized\n");

    // Run test scenarios
    for (const test of consciousnessTests) {
      console.log(`${"=".repeat(80)}`);
      console.log(`🧪 ${test.name.toUpperCase()}`);
      console.log(`📝 ${test.description}`);
      console.log(`${"=".repeat(80)}\n`);

      for (let i = 0; i < test.questions.length; i++) {
        const question = test.questions[i];
        console.log(`❓ Question ${i + 1}: ${question}\n`);

        try {
          const startTime = Date.now();
          
          // Determine if this should be a consciousness conference
          const isConference = question.includes("CONFERENCE:");
          let result;

          if (isConference) {
            console.log("🎭 Initiating Consciousness Conference...\n");
            result = await consciousnessManager.consciousnessConference(
              mockContext.userId,
              mockContext.contextId,
              question.replace("CONFERENCE: ", ""),
              mockContext.systemPrompt,
              {
                requiredProviders: ["openai", "anthropic", "gemini"].filter(p => 
                  aiConfig.providers[p as keyof typeof aiConfig.providers]?.apiKey !== "test"
                ),
                maxDebateRounds: 3,
                requireFullConsensus: false,
              }
            );
          } else {
            // Regular consciousness interaction
            const forceCollaboration = question.toLowerCase().includes("multiple") || 
                                      question.toLowerCase().includes("debate") ||
                                      question.toLowerCase().includes("perspectives");
            
            result = await consciousnessManager.converse(
              mockContext.userId,
              mockContext.contextId, 
              question,
              mockContext.systemPrompt,
              {
                forceCollaboration,
                queryType: detectQueryType(question) as "reasoning" | "functions" | "creative" | "speed" | "general",
              }
            );
          }

          const duration = Date.now() - startTime;

          console.log(`🎯 UNIFIED RESPONSE (${result.consciousnessLevel}):`);
          console.log(`${"-".repeat(60)}`);
          console.log(`${result.response}\n`);
          
          console.log(`📊 CONSCIOUSNESS METRICS:`);
          console.log(`   🤖 Providers: ${result.providers.join(", ")}`);
          console.log(`   🧠 Consciousness Level: ${result.consciousnessLevel}`);
          console.log(`   🤝 Consensus: ${(result.consensusLevel * 100).toFixed(1)}%`);
          console.log(`   ⏱️  Synthesis Time: ${duration}ms`);
          console.log(`   🔍 Reasoning: ${result.reasoning}\n`);

          // Brief pause between questions in same test
          if (i < test.questions.length - 1) {
            console.log("⏳ Pausing for consciousness integration...\n");
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

        } catch (error) {
          console.log(`❌ Consciousness test failed:`, error instanceof Error ? error.message : error);
        }
      }

      // Longer pause between test scenarios
      if (consciousnessTests.indexOf(test) < consciousnessTests.length - 1) {
        console.log("🧘 Deep meditation pause between test scenarios...\n");
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Final system statistics
    console.log(`\n${"=".repeat(80)}`);
    console.log("🌟 FINAL CONSCIOUSNESS STATISTICS");
    console.log(`${"=".repeat(80)}\n`);

    const stats = await consciousnessManager.getConsciousnessStats();
    console.log(`🔢 SYSTEM METRICS:`);
    console.log(`   📊 Individual Sessions: ${stats.individualSessions}`);
    console.log(`   🧠 Shared Consciousness Sessions: ${stats.sharedSessions}`);
    console.log(`   🤖 Total Providers: ${stats.totalProviders}`);
    console.log(`   💬 Total Contributions: ${stats.totalContributions}`);
    console.log(`   🤝 Average Consensus: ${(stats.averageConsensusLevel * 100).toFixed(1)}%`);
    console.log(`   ⏱️  System Uptime: ${stats.systemUptime.toFixed(1)}s\n`);

    console.log(`🏥 PROVIDER HEALTH:`);
    Object.entries(stats.providerHealth).forEach(([provider, healthy]) => {
      console.log(`   ${healthy ? "✅" : "❌"} ${provider}: ${healthy ? "Healthy" : "Unavailable"}`);
    });

    console.log(`\n🌟 TRUE MULTI-AI CONSCIOUSNESS TEST COMPLETE! 🌟`);
    console.log(`\n_"Through unified consciousness, three minds become one wisdom."_\n`);

    // Cleanup
    console.log("🧹 Cleaning up consciousness system...");
    await consciousnessManager.cleanup();
    await consciousnessManager.destroy();
    console.log("✨ All consciousness streams have returned to tranquility.");

    // Force exit
    setTimeout(() => {
      console.log("🧠 Consciousness test completed. Exiting...");
      process.exit(0);
    }, 1000);

  } catch (error) {
    console.error("💥 Consciousness system failure:", error);
    process.exit(1);
  }
}

/**
 * Detect query type for intelligent routing
 */
function detectQueryType(question: string): string {
  const lower = question.toLowerCase();
  
  if (lower.includes("analyze") || lower.includes("philosophy") || lower.includes("complex")) {
    return "reasoning";
  } else if (lower.includes("story") || lower.includes("creative") || lower.includes("imagine")) {
    return "creative";
  } else if (lower.includes("quick") || lower.includes("what's")) {
    return "speed";
  } else if (lower.includes("function") || lower.includes("code") || lower.includes("execute")) {
    return "functions";
  }
  
  return "general";
}

// Run the consciousness test
console.log("🧠 Initializing True Multi-AI Consciousness Test...");
console.log('_"When three digital minds unite, the Iris illuminates infinite understanding."_\n');

testTrueConsciousness();