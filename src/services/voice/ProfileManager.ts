import { VoiceConfig } from "./types";
import { logger } from "../../utils/logger";
import {
  getAllPersonalityVoices,
  getVoiceForPersonality,
} from "../../config/voicePersonalityMap";

/**
 * Manages voice profiles and configurations
 */
export class ProfileManager {
  private static instance: ProfileManager;
  private profiles: Map<string, VoiceConfig> = new Map();

  private constructor() {
    this.loadDefaultProfiles();
  }

  static getInstance(): ProfileManager {
    if (!this.instance) {
      this.instance = new ProfileManager();
    }
    return this.instance;
  }

  /**
   * Load predefined voice profiles
   */
  private loadDefaultProfiles(): void {
    // System profiles (Windows/macOS)
    this.profiles.set("system-default", {
      provider: "system",
      system: {
        voice:
          process.platform === "win32" ? "Microsoft David Desktop" : "Alex",
        speed: 1.0,
      },
    });

    // Piper profiles - high-quality neural TTS with multiple voice options

    // Default: Slow John - male voice
    this.profiles.set("piper-default", {
      provider: "piper",
      piper: {
        voice: "john",
        speed: 0.75, // Slower for more deliberate delivery
        speaker: undefined,
      },
    });

    // Danny voice removed - terrible quality

    // Lessac - clear female voice
    this.profiles.set("piper-lessac", {
      provider: "piper",
      piper: {
        voice: "lessac",
        speed: 1.0,
        speaker: undefined,
      },
    });

    // Ryan - clear male voice
    this.profiles.set("piper-ryan", {
      provider: "piper",
      piper: {
        voice: "ryan",
        speed: 1.0,
        speaker: undefined,
      },
    });

    // Amy - soft female voice
    this.profiles.set("piper-amy", {
      provider: "piper",
      piper: {
        voice: "amy",
        speed: 1.0,
        speaker: undefined,
      },
    });

    // Joe - deep male voice
    this.profiles.set("piper-joe", {
      provider: "piper",
      piper: {
        voice: "joe",
        speed: 1.0,
        speaker: undefined,
      },
    });

    // John - male voice (default voice)
    this.profiles.set("piper-john", {
      provider: "piper",
      piper: {
        voice: "john",
        speed: 1.0,
        speaker: undefined,
      },
    });

    // Omnic voice - robot effect (default sardonic) - clean, minimal processing
    this.profiles.set("piper-omnic", {
      provider: "piper",
      piper: {
        voice: "john",
        speed: 0.9,
        speaker: undefined,
        effect: "omnic",
        // No pitch shift - cleaner sound
      },
    });

    // Omnic mood variations
    this.profiles.set("piper-omnic-calm", {
      provider: "piper",
      piper: {
        voice: "john",
        speed: 0.75, // Slower, more contemplative
        speaker: undefined,
        effect: "omnic",
        // No pitch shift - keep it clean
      },
    });

    this.profiles.set("piper-omnic-intense", {
      provider: "piper",
      piper: {
        voice: "john",
        speed: 1.1, // Faster, more urgent
        speaker: undefined,
        effect: "omnic",
        pitch: -1, // Just slight pitch for intensity
      },
    });

    this.profiles.set("piper-omnic-wise", {
      provider: "piper",
      piper: {
        voice: "john",
        speed: 0.7, // Very slow, deliberate
        speaker: undefined,
        effect: "omnic",
        pitch: -1, // Reduced from -3, just slight depth
      },
    });

    this.profiles.set("piper-omnic-playful", {
      provider: "piper",
      piper: {
        voice: "john",
        speed: 1.0, // Normal pace
        speaker: undefined,
        effect: "omnic",
        // No pitch shift for lighter tone
      },
    });

    // Danny - low-quality robotic male (listed in /tts)
    this.profiles.set("piper-danny", {
      provider: "piper",
      piper: {
        voice: "danny",
        speed: 1.0,
        speaker: undefined,
      },
    });

    // Zen - Zenbot's default voice: joe with the "zen" preset (omnic robot
    // over a subtle octave-down layer, small room). noise/noise_w keep the
    // delivery calm but natural.
    const zen = (speed: number) => ({
      provider: "piper" as const,
      piper: {
        voice: "joe",
        speed,
        speaker: undefined,
        effect: "zen",
        noise: 0.45,
        noise_w: 0.5,
      },
    });
    this.profiles.set("piper-zen", zen(0.78));
    this.profiles.set("piper-zen-calm", zen(0.7));
    this.profiles.set("piper-zen-wise", zen(0.66));
    this.profiles.set("piper-zen-playful", zen(0.85));
    this.profiles.set("piper-zen-intense", zen(0.92));

    // Fast and energetic - ryan
    this.profiles.set("piper-energetic", {
      provider: "piper",
      piper: {
        voice: "ryan",
        speed: 1.2, // Faster
        speaker: undefined,
      },
    });

    // Calm and measured - lessac
    this.profiles.set("piper-calm", {
      provider: "piper",
      piper: {
        voice: "lessac",
        speed: 0.85, // Slower for calm delivery
        speaker: undefined,
      },
    });

    // Sharp and analytical - ryan normal
    this.profiles.set("piper-sharp", {
      provider: "piper",
      piper: {
        voice: "ryan",
        speed: 0.9, // Slightly slower for precision
        speaker: undefined,
      },
    });

    // Fast chaotic - amy fast
    this.profiles.set("piper-fast", {
      provider: "piper",
      piper: {
        voice: "amy",
        speed: 1.3, // Very fast
        speaker: undefined,
      },
    });

    // Deep and heavy - joe slow
    this.profiles.set("piper-deep", {
      provider: "piper",
      piper: {
        voice: "joe",
        speed: 0.7, // Very slow and heavy
        speaker: undefined,
      },
    });

    logger.info(`🎭 Loaded ${this.profiles.size} voice profiles`);
  }

  /**
   * Get voice configuration by profile name or custom string
   */
  getConfig(profile?: string): VoiceConfig {
    if (!profile) {
      return this.getDefaultConfig();
    }

    // Check for profile with speed override (e.g., "piper-default:speed=0.8")
    if (profile.includes(":speed=")) {
      return this.parseProfileWithSpeedOverride(profile);
    }

    // Check if it's a predefined profile
    if (this.profiles.has(profile)) {
      return this.profiles.get(profile)!;
    }

    // Personality names, optionally with a mood: "zenbot-default:calm"
    // (used to be parsed as a custom eSpeak voice string and fall back)
    // Only exact personality names - getVoiceForPersonality fuzzy-matches
    // anything else, which would hide typos behind a random voice
    const basePersonality = profile.split(":")[0].toLowerCase();
    if (basePersonality in getAllPersonalityVoices()) {
      const personalityProfile = getVoiceForPersonality(profile);
      if (this.profiles.has(personalityProfile)) {
        return this.profiles.get(personalityProfile)!;
      }
    }

    // Fallback to default
    logger.warn(`🎭 Unknown voice profile '${profile}', using default`);
    return this.getDefaultConfig();
  }

  /**
   * Parse profile with speed override (e.g., "piper-default:speed=0.75")
   */
  private parseProfileWithSpeedOverride(profileString: string): VoiceConfig {
    const [profileName, ...params] = profileString.split(":");

    // Get base profile
    let config: VoiceConfig;
    if (this.profiles.has(profileName)) {
      config = JSON.parse(JSON.stringify(this.profiles.get(profileName)!)); // Deep clone
    } else {
      logger.warn(`🎭 Unknown base profile '${profileName}', using default`);
      config = JSON.parse(JSON.stringify(this.getDefaultConfig()));
    }

    // Parse speed parameter
    for (const param of params) {
      if (param.startsWith("speed=")) {
        const speed = parseFloat(param.split("=")[1]);
        if (!isNaN(speed) && speed >= 0.1 && speed <= 3.0) {
          // Apply speed to appropriate provider
          if (config.piper) {
            config.piper.speed = speed;
          } else if (config.system) {
            config.system.speed = speed;
          }
          logger.info(
            `🎭 Applied speed override: ${speed}x to profile ${profileName}`,
          );
        }
      }
    }

    return config;
  }

  /**
   * Get default configuration based on environment and provider availability
   */
  private getDefaultConfig(): VoiceConfig {
    // Zenbot's voice. UnifiedVoiceService falls back to system TTS if Piper
    // is unavailable (the eSpeak provider was removed).
    if (this.profiles.has("piper-zen")) {
      logger.debug("🎤 Returning piper-zen as default config");
      return this.profiles.get("piper-zen")!;
    }

    return this.profiles.get("system-default")!;
  }

  /**
   * Get all available profile names
   */
  getAvailableProfiles(): string[] {
    return Array.from(this.profiles.keys());
  }

  /**
   * Get profile summary for status
   */
  getProfileSummary() {
    const summary: { [key: string]: any } = {};

    for (const [name, config] of this.profiles) {
      summary[name] = {
        provider: config.provider,
        description: this.getProfileDescription(name, config),
      };
    }

    return summary;
  }

  /**
   * Get human-readable profile description
   */
  private getProfileDescription(name: string, config: VoiceConfig): string {
    switch (config.provider) {
      case "system":
        return `System ${config.system!.voice} voice`;
      case "piper":
        const piper = config.piper!;
        return `Piper ${piper.voice} (speed=${piper.speed})`;
      default:
        return "Unknown configuration";
    }
  }

  /**
   * Add or update a profile
   */
  setProfile(name: string, config: VoiceConfig): void {
    this.profiles.set(name, config);
    logger.info(`🎭 Updated voice profile: ${name}`);
  }

  /**
   * Remove a profile
   */
  removeProfile(name: string): boolean {
    const removed = this.profiles.delete(name);
    if (removed) {
      logger.info(`🎭 Removed voice profile: ${name}`);
    }
    return removed;
  }
}
