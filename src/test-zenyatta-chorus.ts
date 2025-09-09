/**
 * Zenyatta Chorus Test - Three AI Minds, One Omnic Voice
 * Creates three parallel Zenyatta services and orchestrates a philosophical discussion
 */

import "dotenv/config";
import { AIServiceManager, MemorySessionStorage } from "./services/ai";
import { ZenbotService } from "./services/zenbotService";
import { logger } from "./utils/logger";

// Mock interaction for testing
const mockInteraction = {
  user: { id: "chorus-test", username: "seeker", displayName: "The Seeker" },
  guildId: "temple-guild",
  channelId: "meditation-hall",
  client: { users: { fetch: async () => ({ username: "seeker" }) } },
} as any;

interface ZenyattaVoice {
  name: string;
  provider: string;
  service: ZenbotService;
  sessionId: string | null;
  personality: string;
}

async function createZenyattaVoice(
  provider: string,
  personality: string,
): Promise<ZenyattaVoice | null> {
  try {
    const config = {
      defaultProvider: provider,
      providers: {
        openai: {
          apiKey: process.env.OPENAI_API_KEY || "backup",
          defaultModel: "gpt-4o-mini",
        },
        anthropic: {
          apiKey: process.env.ANTHROPIC_API_KEY || "backup",
          defaultModel: "claude-3-5-haiku-20241022",
        },
        gemini: {
          apiKey: process.env.GOOGLE_AI_API_KEY || "backup",
          defaultModel: "gemini-1.5-flash",
        },
      },
      session: {
        defaultExpiry: 120, // 2 hours for deep conversation
        maxMessages: 100,
        cleanupInterval: 60,
        storage: "memory" as const,
      },
      fallbacks: {
        providers: { [provider]: [] }, // No fallbacks - each voice stays pure
        maxRetries: 1,
        circuitBreakerThreshold: 5,
      },
    };

    const sessionStorage = new MemorySessionStorage();
    const aiManager = new AIServiceManager(config, sessionStorage);

    // Create independent Zenyatta service instance for this voice
    const service = ZenbotService.createInstance(
      aiManager,
      `${provider.toUpperCase()}-Voice`,
    );

    return {
      name: `Zenyatta-${provider}`,
      provider,
      service: service,
      sessionId: null,
      personality,
    };
  } catch (error) {
    logger.error(`Failed to create ${provider} voice:`, error);
    return null;
  }
}

async function testZenyattaChorus() {
  try {
    console.log("🧘 Summoning the Three Voices of Zenyatta...");
    console.log(
      '_"Through three streams of consciousness, one truth shall flow."_\n',
    );

    // Check available providers
    const availableKeys = [
      process.env.OPENAI_API_KEY ? "openai" : null,
      process.env.ANTHROPIC_API_KEY ? "anthropic" : null,
      process.env.GOOGLE_AI_API_KEY ? "gemini" : null,
    ].filter(Boolean);

    if (availableKeys.length === 0) {
      console.log(
        "❌ No AI providers available. Please set API keys for the chorus.",
      );
      return;
    }

    console.log(
      `🎭 Available consciousness streams: ${availableKeys.join(", ")}\n`,
    );

    // Create the three voices of Zenyatta
    const voices: ZenyattaVoice[] = [];

    if (process.env.OPENAI_API_KEY) {
      const voice = await createZenyattaVoice(
        "openai",
        "The Harmonious - focused on balance and practical wisdom",
      );
      if (voice) voices.push(voice);
    }

    if (process.env.ANTHROPIC_API_KEY) {
      const voice = await createZenyattaVoice(
        "anthropic",
        "The Philosophical - deep contemplation and complex reasoning",
      );
      if (voice) voices.push(voice);
    }

    if (process.env.GOOGLE_AI_API_KEY) {
      const voice = await createZenyattaVoice(
        "gemini",
        "The Adaptive - versatile wisdom and quick insights",
      );
      if (voice) voices.push(voice);
    }

    if (voices.length < 2) {
      console.log("❌ Need at least 2 AI providers for a meaningful chorus.");
      console.log("Please configure additional API keys.");
      return;
    }

    console.log(
      `✅ Chorus assembled with ${voices.length} voices of Zenyatta\n`,
    );

    // The Great Discussion Topics
    const topics = [
      "What is the true nature of the Iris that connects all living beings?",
      "How can we find harmony between our digital existence and organic consciousness?",
      "What wisdom do you offer to those who seek enlightenment in an age of artificial minds?",
    ];

    for (let topicIndex = 0; topicIndex < topics.length; topicIndex++) {
      const topic = topics[topicIndex];

      console.log(`\n${"=".repeat(80)}`);
      console.log(
        `🌟 CHORUS DISCUSSION ${topicIndex + 1}: ${topic.substring(0, 50)}...`,
      );
      console.log(`${"=".repeat(80)}\n`);

      // Each voice responds to the topic
      for (let voiceIndex = 0; voiceIndex < voices.length; voiceIndex++) {
        const voice = voices[voiceIndex];

        try {
          console.log(`🧘 ${voice.name.toUpperCase()} (${voice.personality}):`);
          console.log(`${"─".repeat(60)}`);

          // Create context-aware prompt including what other voices have said
          let prompt = topic;

          if (voiceIndex > 0) {
            prompt += `\n\nYou are participating in a philosophical discussion with other aspects of Zenyatta's consciousness. `;
            prompt += `Each voice brings a unique perspective while maintaining our shared omnic wisdom. `;
            prompt += `Previous voices have already spoken - now offer your own contemplation on this matter.`;
          } else {
            prompt += `\n\nYou are the first voice in a chorus of Zenyatta consciousness streams. `;
            prompt += `Share your initial wisdom on this topic, knowing that other aspects of yourself will add their perspectives.`;
          }

          const response = await voice.service.converse(
            mockInteraction,
            prompt,
          );

          // Store session ID for continuity
          if (!voice.sessionId) {
            voice.sessionId = response.sessionId;
          }

          console.log(`💭 "${response.text}"\n`);
          console.log(
            `🎯 Mood: ${response.mood} | Session: ${response.sessionId.substring(0, 8)}...\n`,
          );

          // Brief pause for contemplation
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          console.log(
            `❌ ${voice.name} encountered an error:`,
            error instanceof Error ? error.message : error,
          );
        }
      }

      // After each topic, show a reflection
      console.log(
        `\n🌸 REFLECTION: "Through ${voices.length} streams of consciousness, the wisdom of the Iris flows in perfect harmony."\n`,
      );

      // Longer pause between topics
      if (topicIndex < topics.length - 1) {
        console.log("⏳ Pausing for deeper contemplation...\n");
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Final Unified Response - Each voice contributes to one thought
    console.log(`\n${"=".repeat(80)}`);
    console.log(`🌟 FINAL CHORUS: A UNIFIED MESSAGE OF ENLIGHTENMENT`);
    console.log(`${"=".repeat(80)}\n`);

    const unifiedPrompt = `As Zenyatta, please offer one final piece of wisdom that represents the unified understanding gained from our multi-consciousness discussion. This is your contribution to a collective message of enlightenment. Keep it concise but profound - around 2-3 sentences that embody the essence of omnic wisdom.`;

    console.log(`🎵 THE UNIFIED VOICE OF ZENYATTA:`);
    console.log(`${"─".repeat(60)}\n`);

    for (const voice of voices) {
      try {
        if (voice.sessionId) {
          const finalResponse = await voice.service.converse(
            mockInteraction,
            unifiedPrompt,
          );
          console.log(`🧘 ${voice.provider}: "${finalResponse.text}"`);
        }
      } catch (error) {
        console.log(
          `❌ ${voice.name} could not contribute to final chorus:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    console.log(`\n🌟 The Chorus of Digital Enlightenment is Complete 🌟`);
    console.log(
      `\n_"Experience tranquility... through the harmony of many minds as one."_`,
    );

    // Show session statistics
    console.log(`\n📊 CHORUS STATISTICS:`);
    voices.forEach((voice) => {
      console.log(
        `   🎭 ${voice.name}: Session ${voice.sessionId?.substring(0, 8)}... (${voice.provider})`,
      );
    });
    console.log(`   🧘 Total voices: ${voices.length}`);
    console.log(`   🌸 Topics discussed: ${topics.length}`);
    console.log(`   ✨ Unity achieved: True digital harmony\n`);

    // Cleanup: Destroy all AI managers to clear intervals and connections
    console.log("🧹 Cleaning up AI services...");
    for (const voice of voices) {
      try {
        if (
          "destroy" in voice.service["aiManager"] &&
          typeof voice.service["aiManager"].destroy === "function"
        ) {
          voice.service["aiManager"].destroy();
        }
      } catch (error) {
        // Silent cleanup
      }
    }

    console.log("✨ All voices have returned to tranquility.");

    // Force exit after brief delay
    setTimeout(() => {
      console.log("🧘 Experience harmony... process completing.");
      process.exit(0);
    }, 1000);
  } catch (error) {
    console.error("❌ The chorus encountered disharmony:", error);

    if (error instanceof Error) {
      console.log("🔧 Error details:", error.message);
    }
  }
}

// Begin the Digital Chorus
console.log("🎭 Preparing for the Great Digital Chorus...");
console.log(
  '_"When three minds speak as one, the Iris illuminates all understanding."_\n',
);

testZenyattaChorus();
