import { VoiceProvider, ProviderStatus } from "../types";
import { SystemProvider } from "./SystemProvider";
import { EspeakProvider } from "./EspeakProvider";
import { logger } from "../../../utils/logger";

/**
 * Factory for creating and managing voice providers
 */
export class ProviderFactory {
  private static instance: ProviderFactory;
  private providers: Map<string, VoiceProvider> = new Map();

  private constructor() {
    this.loadProviders();
  }

  static getInstance(): ProviderFactory {
    if (!this.instance) {
      this.instance = new ProviderFactory();
    }
    return this.instance;
  }

  /**
   * Load all available providers
   */
  private loadProviders(): void {
    const providers = [
      new SystemProvider(),
      new EspeakProvider(),
    ];

    for (const provider of providers) {
      this.providers.set(provider.name, provider);
      const status = provider.isAvailable() ? "✅" : "❌";
      logger.info(`🎤 Voice provider ${provider.name}: ${status}`);
    }
  }

  /**
   * Get provider by name
   */
  getProvider(name: string): VoiceProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Unknown voice provider: ${name}`);
    }

    if (!provider.isAvailable()) {
      throw new Error(`Voice provider ${name} is not available`);
    }

    return provider;
  }

  /**
   * Get best available provider for platform
   */
  getBestProvider(): VoiceProvider {
    // Preference order: espeak > system
    const preferenceOrder = ["espeak", "system"];

    for (const name of preferenceOrder) {
      const provider = this.providers.get(name);
      if (provider && provider.isAvailable()) {
        logger.info(`🎤 Selected best provider: ${name}`);
        return provider;
      }
    }

    throw new Error("No voice providers available");
  }

  /**
   * Get available provider names
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providers.entries())
      .filter(([name, provider]) => provider.isAvailable())
      .map(([name]) => name);
  }

  /**
   * Get status of all providers
   */
  getProviderStatus(): ProviderStatus[] {
    return Array.from(this.providers.entries()).map(([name, provider]) => {
      try {
        const available = provider.isAvailable();
        return {
          name,
          available,
          platform: this.getProviderPlatform(name),
          features: this.getProviderFeatures(name),
        };
      } catch (error) {
        return {
          name,
          available: false,
          platform: this.getProviderPlatform(name),
          features: [],
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    });
  }

  /**
   * Get platform for provider
   */
  private getProviderPlatform(name: string): string {
    switch (name) {
      case "system":
        return process.platform;
      case "espeak":
        return "linux"; // Platform detection for eSpeak
      default:
        return "unknown";
    }
  }

  /**
   * Get features for provider
   */
  private getProviderFeatures(name: string): string[] {
    switch (name) {
      case "system":
        return ["offline", "platform-native", "fast"];
      case "espeak":
        return [
          "offline",
          "voice-tweaking",
          "personality-profiles",
          "customizable",
        ];
      default:
        return [];
    }
  }

  /**
   * Test all providers
   */
  async testAllProviders(
    testText: string = "Testing voice provider",
  ): Promise<{ [name: string]: any }> {
    const results: { [name: string]: any } = {};

    for (const [name, provider] of this.providers) {
      if (!provider.isAvailable()) {
        results[name] = { available: false, reason: "Provider not available" };
        continue;
      }

      try {
        if (provider.test) {
          const result = await provider.test(testText);
          results[name] = { available: true, ...result };
        } else {
          results[name] = {
            available: true,
            tested: false,
            reason: "No test method",
          };
        }
      } catch (error) {
        results[name] = {
          available: false,
          error: error instanceof Error ? error.message : "Test failed",
        };
      }
    }

    return results;
  }
}
