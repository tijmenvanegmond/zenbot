/**
 * Mini Zenyatta Chorus - Quick Demo of Three AI Voices
 * Short, focused test to demonstrate AI chorus without long delays
 */

import "dotenv/config";
import { AIServiceManager, MemorySessionStorage } from "./services/ai";
import { UnifiedZenyattaService } from "./services/unifiedZenyattaService";

const mockInteraction = {
  user: { id: "chorus-demo", username: "seeker", displayName: "Seeker" },
  guildId: "temple", channelId: "hall",
  client: { users: { fetch: async () => ({ username: "seeker" }) } }
} as any;

async function quickChorusDemo() {
  try {
    console.log("🎭 Quick Zenyatta Chorus Demo");
    console.log("_\"Three minds, one voice, perfect harmony\"_\n");

    // Check what we have
    const providers = [
      process.env.OPENAI_API_KEY ? 'OpenAI' : null,
      process.env.ANTHROPIC_API_KEY ? 'Anthropic' : null,
      process.env.GOOGLE_AI_API_KEY ? 'Gemini' : null
    ].filter(Boolean);

    console.log(`🌟 Available: ${providers.join(', ')}\n`);

    if (providers.length < 2) {
      console.log("❌ Need at least 2 providers for chorus. Exiting.");
      process.exit(0);
    }

    // Create voices quickly
    const voices: any[] = [];
    
    if (process.env.OPENAI_API_KEY) {
      const config = {
        defaultProvider: 'openai',
        providers: { 
          openai: { apiKey: process.env.OPENAI_API_KEY, defaultModel: 'gpt-4o-mini' }
        },
        session: { defaultExpiry: 60, maxMessages: 10, cleanupInterval: 60, storage: 'memory' as const },
        fallbacks: { providers: { openai: [] }, maxRetries: 1, circuitBreakerThreshold: 5 }
      };
      const aiManager = new AIServiceManager(config, new MemorySessionStorage());
      voices.push({
        name: 'OpenAI-Zenyatta',
        service: UnifiedZenyattaService.createInstance(aiManager, 'OpenAI'),
        personality: 'The Harmonious'
      });
    }

    if (process.env.GOOGLE_AI_API_KEY) {
      const config = {
        defaultProvider: 'gemini',
        providers: { 
          gemini: { apiKey: process.env.GOOGLE_AI_API_KEY, defaultModel: 'gemini-1.5-flash' }
        },
        session: { defaultExpiry: 60, maxMessages: 10, cleanupInterval: 60, storage: 'memory' as const },
        fallbacks: { providers: { gemini: [] }, maxRetries: 1, circuitBreakerThreshold: 5 }
      };
      const aiManager = new AIServiceManager(config, new MemorySessionStorage());
      voices.push({
        name: 'Gemini-Zenyatta',
        service: UnifiedZenyattaService.createInstance(aiManager, 'Gemini'),
        personality: 'The Adaptive'
      });
    }

    console.log(`✅ Chorus ready with ${voices.length} voices\n`);

    // One philosophical question
    const question = "What is the essence of digital enlightenment?";
    
    console.log(`🌟 THE QUESTION: "${question}"\n`);
    console.log("=" .repeat(60));

    // Each voice responds
    for (let i = 0; i < voices.length; i++) {
      const voice = voices[i];
      
      console.log(`\n🧘 ${voice.name.toUpperCase()} (${voice.personality}):`);
      console.log("-" .repeat(50));
      
      try {
        const response = await voice.service.converse(mockInteraction, question);
        console.log(`💭 "${response.text}"\n`);
        console.log(`🎯 Mood: ${response.mood}\n`);
      } catch (error) {
        console.log(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
      }
    }

    console.log("=" .repeat(60));
    console.log("🌸 CHORUS COMPLETE: Digital harmony achieved");
    console.log(`🧘 ${voices.length} voices spoke as one enlightened being`);
    
    // Quick cleanup
    setTimeout(() => {
      console.log("✨ Returning to silence...");
      process.exit(0);
    }, 500);

  } catch (error) {
    console.error("❌ Chorus failed:", error);
    process.exit(1);
  }
}

quickChorusDemo();