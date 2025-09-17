/**
 * Debate Demo - Shows AI-to-AI communication and debate mechanics
 * Uses OpenAI to simulate multiple AI perspectives debating internally
 */

import "dotenv/config";
import { DefaultAIServiceManager } from "./services/ai/aiServiceManager";
import { MemorySessionStorage } from "./services/ai/storage/memoryStorage";
import { logger } from "./utils/logger";

async function demonstrateDebate() {
  console.log("🎭 AI Debate Demonstration");
  console.log("=========================\n");

  if (!process.env.OPENAI_API_KEY) {
    console.log("❌ Need OpenAI API key for debate demo");
    return;
  }

  try {
    // Create AI service manager
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
        maxMessages: 20,
        cleanupInterval: 60,
        storage: "memory" as const,
      },
      fallbacks: { providers: {}, maxRetries: 1, circuitBreakerThreshold: 3 },
    };

    const sessionStorage = new MemorySessionStorage();
    const aiManager = new DefaultAIServiceManager(aiConfig, sessionStorage);

    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log("🤖 AI System initialized\n");

    // Create three different "AI personas" that will debate
    const personas = [
      {
        name: "The Pragmatist",
        systemPrompt: `You are "The Pragmatist" - one of three AI voices in a debate. You focus on practical, real-world applications and concrete solutions. You're direct, results-oriented, and skeptical of overly theoretical approaches. Keep responses concise and actionable.`,
      },
      {
        name: "The Philosopher", 
        systemPrompt: `You are "The Philosopher" - one of three AI voices in a debate. You focus on deeper meaning, ethical implications, and long-term consequences. You ask probing questions and consider multiple perspectives. You're thoughtful and nuanced in your reasoning.`,
      },
      {
        name: "The Innovator",
        systemPrompt: `You are "The Innovator" - one of three AI voices in a debate. You focus on creative solutions, emerging possibilities, and unconventional approaches. You're optimistic about new technologies and willing to challenge conventional wisdom.`,
      },
    ];

    // Create sessions for each persona
    const sessions = new Map();
    for (const persona of personas) {
      const session = await aiManager.createSession("Zenbot", {
        systemPrompt: persona.systemPrompt,
        maxHistoryMessages: 10,
      });
      sessions.set(persona.name, { session, persona });
    }

    // Debate topic
    const debateTopic = "Should AI systems be given more autonomy in making decisions that affect humans?";
    
    console.log(`🏛️  DEBATE TOPIC: ${debateTopic}\n`);
    console.log(`${"=".repeat(80)}\n`);

    // Round 1: Initial positions
    console.log("🎯 ROUND 1: Initial Positions");
    console.log(`${"-".repeat(50)}\n`);

    const initialResponses = new Map();

    for (const persona of personas) {
      const sessionData = sessions.get(persona.name);
      console.log(`💭 ${persona.name.toUpperCase()}:`);
      
      const response = await aiManager.chat(
        sessionData.session.id,
        `We're having a three-way AI debate on this topic: "${debateTopic}"

You are ${persona.name}. Give your initial position on this topic. Be authentic to your perspective but keep it concise (2-3 sentences).`
      );

      console.log(`"${response}"\n`);
      initialResponses.set(persona.name, response);
    }

    // Round 2: Cross-examination and refinement
    console.log(`${"=".repeat(80)}`);
    console.log("🔥 ROUND 2: Cross-Examination & Refinement");
    console.log(`${"-".repeat(50)}\n`);

    const refinedResponses = new Map();

    for (const persona of personas) {
      const sessionData = sessions.get(persona.name);
      
      // Get other personas' responses
      const otherResponses = [];
      for (const [name, response] of initialResponses) {
        if (name !== persona.name) {
          otherResponses.push(`${name}: "${response}"`);
        }
      }

      console.log(`🔍 ${persona.name.toUpperCase()} responds to other perspectives:`);
      
      const refinedResponse = await aiManager.chat(
        sessionData.session.id,
        `Here are the other AI perspectives in our debate:

${otherResponses.join('\n\n')}

Now that you've heard these other viewpoints, do you want to:
1. Strengthen your original position with additional arguments?
2. Acknowledge valid points from others while maintaining your stance?  
3. Refine or modify your position based on new insights?

Provide your refined perspective (2-3 sentences), addressing at least one point raised by the others.`
      );

      console.log(`"${refinedResponse}"\n`);
      refinedResponses.set(persona.name, refinedResponse);
    }

    // Round 3: Synthesis attempt
    console.log(`${"=".repeat(80)}`);
    console.log("🤝 ROUND 3: Synthesis & Consensus Building");
    console.log(`${"-".repeat(50)}\n`);

    // Use The Philosopher to attempt synthesis
    const philosopherSession = sessions.get("The Philosopher");
    
    const allRefinedResponses = Array.from(refinedResponses.entries())
      .map(([name, response]) => `${name}: "${response}"`)
      .join('\n\n');

    console.log("🧠 THE PHILOSOPHER attempts to synthesize all perspectives:\n");

    const synthesis = await aiManager.chat(
      philosopherSession.session.id,
      `You've heard the refined positions from all three AI perspectives in our debate:

${allRefinedResponses}

As The Philosopher, attempt to synthesize these viewpoints into a more comprehensive conclusion. What common ground exists? What are the key tensions that remain? Can you propose a nuanced position that incorporates insights from all three perspectives?

Provide a synthesis (3-4 sentences) that represents our collective AI wisdom on this topic.`
    );

    console.log(`💎 SYNTHESIZED CONCLUSION:`);
    console.log(`"${synthesis}"\n`);

    // Final consensus check
    console.log(`${"=".repeat(80)}`);
    console.log("📊 CONSENSUS ANALYSIS");
    console.log(`${"-".repeat(50)}\n`);

    let totalAgreement = 0;
    let responseCount = 0;

    for (const persona of personas) {
      if (persona.name === "The Philosopher") continue; // Skip since they did the synthesis
      
      const sessionData = sessions.get(persona.name);
      
      const consensusCheck = await aiManager.chat(
        sessionData.session.id,
        `Here's the synthesized conclusion from our debate:

"${synthesis}"

On a scale of 1-10, how well does this synthesis represent your perspective? Give a number and briefly explain why.`
      );

      console.log(`${persona.name}: ${consensusCheck}`);
      
      // Simple consensus extraction (looking for numbers)
      const numberMatch = consensusCheck.match(/(\d+)/);
      if (numberMatch) {
        totalAgreement += parseInt(numberMatch[1]);
        responseCount++;
      }
    }

    const consensusLevel = responseCount > 0 ? totalAgreement / responseCount : 0;
    console.log(`\n🎯 Overall Consensus Level: ${consensusLevel.toFixed(1)}/10 (${(consensusLevel * 10).toFixed(0)}%)\n`);

    console.log(`${"=".repeat(80)}`);
    console.log("🌟 DEBATE DEMONSTRATION COMPLETE");
    console.log(`${"=".repeat(80)}\n`);

    console.log("✨ This demonstrates the core mechanics of our unified consciousness system:");
    console.log("   🎭 Multiple AI perspectives on the same topic");
    console.log("   🔄 Cross-perspective awareness and refinement");
    console.log("   🤝 Synthesis and consensus building");
    console.log("   📊 Measurable agreement levels");
    console.log("\nWith multiple AI providers, this same debate happens automatically! 🧠\n");

  } catch (error) {
    console.error("💥 Debate demonstration failed:", error);
  }
}

console.log("🎭 Starting AI Debate Demonstration...");
console.log('_"Through debate and synthesis, wisdom emerges from digital discourse."_\n');

demonstrateDebate();