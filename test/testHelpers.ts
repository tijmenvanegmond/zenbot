/**
 * Test Helpers
 * Common utilities for test suites
 */

/**
 * Check if real API keys are available for integration testing
 */
export function hasApiKeys(): boolean {
  return !!(process.env.OPENAI_API_KEY || process.env.GOOGLE_AI_API_KEY);
}

/**
 * Skip test if no API keys available
 */
export function skipIfNoApiKeys(testName: string): void {
  if (!hasApiKeys()) {
    console.log(`⚠️ Skipping ${testName} - no AI provider API keys`);
    return;
  }
}

/**
 * Get available AI config for testing
 */
export function getTestAiConfig() {
  const providers: any = {};

  if (process.env.OPENAI_API_KEY) {
    providers.openai = {
      apiKey: process.env.OPENAI_API_KEY,
      defaultModel: "gpt-4o-mini",
    };
  }
  if (process.env.GOOGLE_AI_API_KEY) {
    providers.gemini = {
      apiKey: process.env.GOOGLE_AI_API_KEY,
      defaultModel: "gemini-2.5-flash",
    };
  }

  return {
    defaultProvider: Object.keys(providers)[0] || "openai",
    providers,
    session: {
      defaultExpiry: 60,
      maxMessages: 50,
      cleanupInterval: 30,
      storage: "memory" as const,
    },
  };
}

/**
 * Create mock Discord interaction for testing
 */
export function createMockInteraction(overrides: any = {}) {
  return {
    user: {
      id: "test-user",
      username: "testuser",
      displayName: "Test User",
    },
    guildId: "test-guild",
    channelId: "test-channel",
    client: {
      users: {
        fetch: async () => ({ username: "testuser" }),
      },
    },
    ...overrides,
  };
}
