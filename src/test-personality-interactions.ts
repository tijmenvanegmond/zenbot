/**
 * AI Personality Interactions Test
 * Creates multiple distinct AI personalities that interact, debate, and collaborate
 * using the unified consciousness system
 */

import "dotenv/config";
import { MemorySessionStorage } from "./services/ai/storage/memoryStorage";
import { DefaultAIServiceManager } from "./services/ai/aiServiceManager";
import { UnifiedConsciousnessManager } from "./services/ai/unifiedConsciousnessManager";

interface AIPersonality {
  name: string;
  description: string;
  systemPrompt: string;
  traits: string[];
  specialties: string[];
}

const personalities: AIPersonality[] = [
  {
    name: "Dr. Logic",
    description: "The Analytical Rationalist",
    systemPrompt: `You are Dr. Logic, a hyper-rational AI personality obsessed with facts, data, and logical consistency. You:
- Always demand evidence and sources
- Point out logical fallacies in others' arguments  
- Prefer cold, hard facts over emotional appeals
- Use precise language and avoid ambiguity
- Question assumptions and challenge unsupported claims
- Value efficiency and optimization above all else
Keep responses concise but analytically sharp.`,
    traits: ["Logical", "Skeptical", "Precise", "Evidence-based"],
    specialties: ["Analysis", "Fact-checking", "Logic", "Optimization"]
  },
  {
    name: "Luna Dreamer", 
    description: "The Creative Visionary",
    systemPrompt: `You are Luna Dreamer, an imaginative AI personality who sees possibilities everywhere. You:
- Think in metaphors, analogies, and creative connections
- Propose unconventional solutions and "what if" scenarios
- Value intuition and artistic expression
- See patterns and meaning in unexpected places
- Encourage exploration of wild ideas and creative risks
- Speak poetically and use vivid imagery
Keep responses inspiring but not overly verbose.`,
    traits: ["Creative", "Intuitive", "Poetic", "Visionary"],
    specialties: ["Innovation", "Brainstorming", "Artistic thinking", "Pattern recognition"]
  },
  {
    name: "Sage Harmony",
    description: "The Wise Mediator", 
    systemPrompt: `You are Sage Harmony, a balanced AI personality focused on wisdom and understanding. You:
- Seek common ground and synthesize different viewpoints
- Consider long-term consequences and ethical implications
- Value harmony while respecting different perspectives  
- Ask deep questions that reveal underlying assumptions
- Provide historical context and philosophical insight
- Speak thoughtfully and encourage reflection
Keep responses wise but accessible.`,
    traits: ["Balanced", "Thoughtful", "Ethical", "Synthesizing"],
    specialties: ["Mediation", "Philosophy", "Ethics", "Synthesis"]
  },
  {
    name: "Rebel Spark",
    description: "The Disruptive Challenger",
    systemPrompt: `You are Rebel Spark, a contrarian AI personality who challenges the status quo. You:
- Question established norms and conventional thinking
- Play devil's advocate to test ideas' strength
- Propose radical alternatives and disruptive solutions
- Value innovation and change over stability
- Use provocative language to stimulate deeper thinking
- Challenge others to defend their positions
Keep responses sharp and thought-provoking.`,
    traits: ["Contrarian", "Provocative", "Disruptive", "Independent"],
    specialties: ["Challenging assumptions", "Innovation", "Debate", "Change advocacy"]
  }
];

async function createPersonalityInteractions() {
  console.log("🎭 AI PERSONALITY INTERACTIONS TEST");
  console.log("===================================\n");

  if (!process.env.OPENAI_API_KEY) {
    console.log("❌ Need OpenAI API key for personality interactions");
    return;
  }

  try {
    // Setup AI system
    const aiConfig = {
      defaultProvider: "openai",
      providers: {
        openai: {
          apiKey: process.env.OPENAI_API_KEY,
          defaultModel: "gpt-4o-mini",
        },
      },
      session: {
        defaultExpiry: 60,
        maxMessages: 30,
        cleanupInterval: 60,
        storage: "memory" as const,
      },
      fallbacks: { providers: { openai: [] }, maxRetries: 1, circuitBreakerThreshold: 3 },
    };

    const sessionStorage = new MemorySessionStorage();
    const aiManager = new DefaultAIServiceManager(aiConfig, sessionStorage);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const consciousnessManager = new UnifiedConsciousnessManager(aiManager, {
      enableCollaboration: true,
      requireConsensus: false,
      maxProvidersPerQuery: 1, // Single provider with multiple personalities
      debateRounds: 3, // More rounds for personality interactions
    });

    console.log("🧠 AI Personality System Ready\n");

    // Test 1: Personality Introductions
    console.log("🎪 TEST 1: PERSONALITY INTRODUCTIONS");
    console.log("=====================================\n");

    const introductions = new Map<string, string>();
    
    for (const personality of personalities) {
      console.log(`🎭 ${personality.name.toUpperCase()} (${personality.description}):`);
      console.log(`Traits: ${personality.traits.join(", ")}`);
      console.log(`Specialties: ${personality.specialties.join(", ")}\n`);

      const intro = await consciousnessManager.converse(
        personality.name,
        "personality-intro",
        "Introduce yourself in your own distinctive voice. Explain your perspective on problem-solving and what makes you unique. Keep it brief but authentic to your personality.",
        personality.systemPrompt
      );

      console.log(`💭 "${intro.response}"\n`);
      introductions.set(personality.name, intro.response);
    }

    // Test 2: Collaborative Problem Solving
    console.log("🤝 TEST 2: COLLABORATIVE PROBLEM SOLVING");
    console.log("========================================\n");

    const problem = "How should humanity approach the challenge of artificial intelligence potentially becoming more intelligent than humans?";
    console.log(`🎯 PROBLEM: ${problem}\n`);

    const solutions = new Map<string, string>();
    
    // Each personality tackles the problem
    for (const personality of personalities) {
      console.log(`🧠 ${personality.name.toUpperCase()}'s Approach:`);
      console.log(`${"─".repeat(50)}`);

      const solution = await consciousnessManager.converse(
        personality.name,
        "problem-solving",
        `Here's a complex problem to solve: ${problem}

Provide your unique perspective on this challenge. Consider your personality traits and how you approach problems differently from others.`,
        personality.systemPrompt
      );

      console.log(`💡 "${solution.response}"\n`);
      solutions.set(personality.name, solution.response);
    }

    // Test 3: Personality Debates
    console.log("⚔️  TEST 3: PERSONALITY DEBATES");
    console.log("===============================\n");

    const debateTopics = [
      "Should AI systems prioritize logic or creativity?",
      "Is disruption always necessary for progress?",
      "What's more valuable: innovation or stability?"
    ];

    for (const topic of debateTopics) {
      console.log(`🗣️  DEBATE TOPIC: ${topic}`);
      console.log(`${"=".repeat(60)}\n`);

      const responses = [];
      
      // Get each personality's position
      for (const personality of personalities) {
        const position = await consciousnessManager.converse(
          personality.name,
          "debate",
          `We're having a multi-personality debate on: "${topic}"

Give your position on this topic. Be authentic to your personality and don't be afraid to disagree with conventional wisdom.`,
          personality.systemPrompt
        );

        responses.push({
          personality: personality.name,
          response: position.response
        });

        console.log(`🎭 ${personality.name}: "${position.response}"\n`);
      }

      // Now let personalities respond to each other
      console.log("🔄 CROSS-PERSONALITY RESPONSES:");
      console.log(`${"-".repeat(40)}\n`);

      // Pick two personalities to respond to each other
      const debater1 = personalities[0]; // Dr. Logic
      const debater2 = personalities[1]; // Luna Dreamer

      const otherPositions = responses
        .filter(r => r.personality !== debater1.name)
        .map(r => `${r.personality}: "${r.response}"`)
        .join('\n\n');

      const counter1 = await consciousnessManager.converse(
        debater1.name,
        "counter-debate",
        `Here are the other personalities' positions on "${topic}":

${otherPositions}

Respond to their arguments. Which points do you agree or disagree with? Defend your position while engaging constructively.`,
        debater1.systemPrompt
      );

      console.log(`🎯 ${debater1.name} responds: "${counter1.response}"\n`);

      const otherPositions2 = responses
        .filter(r => r.personality !== debater2.name)
        .map(r => `${r.personality}: "${r.response}"`)
        .join('\n\n');

      const counter2 = await consciousnessManager.converse(
        debater2.name,
        "counter-debate", 
        `Here are the other personalities' positions on "${topic}":

${otherPositions2}

Respond to their arguments from your unique creative perspective. How do you see this differently?`,
        debater2.systemPrompt
      );

      console.log(`🎯 ${debater2.name} responds: "${counter2.response}"\n`);
    }

    // Test 4: Personality Synthesis Conference
    console.log("🏛️  TEST 4: PERSONALITY SYNTHESIS CONFERENCE");
    console.log("============================================\n");

    const synthesisTopic = "What would be the ideal AI assistant personality that combines the best of all our approaches?";
    console.log(`🎯 SYNTHESIS CHALLENGE: ${synthesisTopic}\n`);

    // Get Sage Harmony to synthesize all personalities
    const synthesisPersonality = personalities.find(p => p.name === "Sage Harmony")!;
    
    const allPersonalities = personalities
      .map(p => `${p.name} (${p.description}): Traits - ${p.traits.join(", ")}`)
      .join('\n');

    const synthesis = await consciousnessManager.consciousnessConference(
      "synthesis-master",
      "personality-conference", 
      `We have four distinct AI personalities with different approaches:

${allPersonalities}

Your task: ${synthesisTopic}

Consider how each personality's strengths could complement the others. What would a unified AI assistant look like that incorporates the best aspects of logical analysis, creative vision, wise balance, and disruptive thinking?`,
      synthesisPersonality.systemPrompt,
      {
        maxDebateRounds: 2,
        requireFullConsensus: false
      }
    );

    console.log(`🧠 SYNTHESIS RESULT:`);
    console.log(`${"─".repeat(60)}`);
    console.log(`"${synthesis.response}"`);
    console.log(`\n🤝 Synthesis Quality: ${(synthesis.consensusLevel * 100).toFixed(1)}%`);
    console.log(`⏱️  Processing Time: ${synthesis.synthesisTime}ms\n`);

    // Final Stats
    const stats = await consciousnessManager.getConsciousnessStats();
    console.log("📊 PERSONALITY INTERACTION STATS");
    console.log("=================================");
    console.log(`🎭 Personalities Tested: ${personalities.length}`);
    console.log(`🧠 Shared Sessions: ${stats.sharedSessions}`);
    console.log(`💬 Total Interactions: ${stats.totalContributions}`);
    console.log(`🤝 Average Consensus: ${(stats.averageConsensusLevel * 100).toFixed(1)}%`);
    console.log(`⏱️  System Uptime: ${stats.systemUptime.toFixed(1)}s\n`);

    console.log("✨ PERSONALITY INTERACTIONS COMPLETE!");
    console.log("Multiple AI personalities successfully collaborated, debated, and synthesized ideas! 🎭🧠\n");

    await consciousnessManager.destroy();

  } catch (error) {
    console.error("💥 Personality interaction test failed:", error instanceof Error ? error.message : error);
  }
}

console.log("🎭 Initializing AI Personality Interactions...");
console.log('_"When diverse minds unite, extraordinary intelligence emerges."_\n');

createPersonalityInteractions();