import { VoiceConfig } from "./types";
import { VOICE_CONFIG } from "../../config";
import { logger } from "../../utils/logger";

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

    // Linux eSpeak-NG profiles - enhanced for better clarity and character

    // Default balanced voice - improved clarity
    this.profiles.set("zenbot-default", {
      provider: "espeak",
      espeak: {
        variant: "en-gb",
        pitch: 48,
        amplitude: 105,
        speed: 145,
        wordGap: 8,
        capitalEmphasis: 12,
        punctuation: false,
        ssml: false,
      },
    });

    // Sardonic personality - enhanced for better quality and character
    this.profiles.set("zenbot-sardonic", {
      provider: "espeak",
      espeak: {
        variant: "en-gb-x-rp", // Received Pronunciation for more sophisticated sound
        pitch: 38, // Lower pitch for gravitas
        amplitude: 110, // Slightly louder for clarity
        speed: 120, // Slower for deliberate delivery
        wordGap: 15, // More pauses for dramatic effect
        capitalEmphasis: 25, // Strong emphasis for sarcasm
        punctuation: true, // Better handling of punctuation for dramatic pauses
        ssml: false,
      },
    });

    // Wise personality - deeper, more thoughtful
    this.profiles.set("zenbot-wise", {
      provider: "espeak",
      espeak: {
        variant: "en-gb-x-rp", // Received Pronunciation for distinguished sound
        pitch: 38,
        amplitude: 110,
        speed: 120,
        wordGap: 15,
        capitalEmphasis: 8,
        punctuation: false,
        ssml: false,
      },
    });

    // Excited personality - higher energy
    this.profiles.set("zenbot-excited", {
      provider: "espeak",
      espeak: {
        variant: "en-us",
        pitch: 52,
        amplitude: 115,
        speed: 165,
        wordGap: 5,
        capitalEmphasis: 15,
        punctuation: false,
        ssml: false,
      },
    });

    // Calm personality - very smooth and relaxed
    this.profiles.set("zenbot-calm", {
      provider: "espeak",
      espeak: {
        variant: "en-gb-scotland", // Scottish English for softer tones
        pitch: 40,
        amplitude: 95,
        speed: 110,
        wordGap: 18,
        capitalEmphasis: 5,
        punctuation: false,
        ssml: false,
      },
    });

    // NEW: Deep philosopher voice - enhanced for wisdom
    this.profiles.set("zenbot-deep", {
      provider: "espeak",
      espeak: {
        variant: "en-gb-x-rp",
        pitch: 32, // Slightly higher for better clarity
        amplitude: 115, // Reduced for more intimate feel
        speed: 110, // Slightly faster for better flow
        wordGap: 18, // Balanced pauses
        capitalEmphasis: 8, // Gentle emphasis
        punctuation: true, // Better for philosophical statements
        ssml: false,
      },
    });

    // NEW: Crisp and clear for important announcements - optimized
    this.profiles.set("zenbot-crisp", {
      provider: "espeak",
      espeak: {
        variant: "en-us",
        pitch: 48, // Slightly lower for authority
        amplitude: 120, // Balanced volume
        speed: 135, // Slightly slower for clarity
        wordGap: 8, // Moderate pauses
        capitalEmphasis: 18, // Strong but not harsh
        punctuation: true,
        ssml: false,
      },
    });

    // NEW: Smooth radio-like voice - enhanced for warmth
    this.profiles.set("zenbot-smooth", {
      provider: "espeak",
      espeak: {
        variant: "en-gb-x-rp",
        pitch: 42, // Lower for warmth
        amplitude: 105, // Gentle volume
        speed: 125, // Smooth pacing
        wordGap: 12, // Natural flow
        capitalEmphasis: 10, // Subtle emphasis
        punctuation: false,
        ssml: false,
      },
    });

    // NEW: Mysterious/dramatic voice - enhanced atmosphere
    this.profiles.set("zenbot-mysterious", {
      provider: "espeak",
      espeak: {
        variant: "en-gb",
        pitch: 33, // Slightly higher for intrigue
        amplitude: 95, // Whisper-like but audible
        speed: 105, // Deliberate but not too slow
        wordGap: 22, // Dramatic pauses
        capitalEmphasis: 22, // Strong emphasis for mystery
        punctuation: true,
        ssml: false,
      },
    });

    // NEW: Energetic and upbeat voice
    this.profiles.set("zenbot-energetic", {
      provider: "espeak",
      espeak: {
        variant: "en-us",
        pitch: 55, // Higher for energy
        amplitude: 118, // Lively volume
        speed: 155, // Quick but clear
        wordGap: 4, // Minimal pauses for energy
        capitalEmphasis: 16, // Enthusiastic emphasis
        punctuation: false,
        ssml: false,
      },
    });

    // NEW: Professional and authoritative
    this.profiles.set("zenbot-professional", {
      provider: "espeak",
      espeak: {
        variant: "en-gb-x-rp",
        pitch: 40, // Professional tone
        amplitude: 112, // Clear and present
        speed: 128, // Measured pace
        wordGap: 10, // Professional spacing
        capitalEmphasis: 14, // Confident emphasis
        punctuation: true, // Proper enunciation
        ssml: false,
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

    // Check if it's a predefined profile
    if (this.profiles.has(profile)) {
      return this.profiles.get(profile)!;
    }

    // Try to parse as custom Linux voice string (e.g., "en+m2:pitch=55:amp=100")
    if (profile.includes(":") || profile.startsWith("en+")) {
      return this.parseCustomLinuxConfig(profile);
    }

    // Fallback to default
    logger.warn(`🎭 Unknown voice profile '${profile}', using default`);
    return this.getDefaultConfig();
  }

  /**
   * Get default configuration based on environment
   */
  private getDefaultConfig(): VoiceConfig {
    // Default to sardonic Linux voice (free, no API costs)
    if (this.profiles.has("zenbot-sardonic")) {
      return this.profiles.get("zenbot-sardonic")!;
    }

    const provider = VOICE_CONFIG.TTS_PROVIDER;

    switch (provider) {
      case "espeak":
        return this.profiles.get("zenbot-default")!;
      case "local":
      case "system":
      default:
        return this.profiles.get("system-default")!;
    }
  }

  /**
   * Parse custom Linux voice configuration string
   */
  private parseCustomLinuxConfig(configString: string): VoiceConfig {
    const baseConfig = this.profiles.get("zenbot-default")!;
    const config: VoiceConfig = JSON.parse(JSON.stringify(baseConfig)); // Deep clone

    const parts = configString.split(":");

    // First part is voice variant
    if (parts[0]) {
      config.espeak!.variant = parts[0];
    }

    // Parse parameters
    parts.slice(1).forEach((part) => {
      if (part.includes("=")) {
        const [key, value] = part.split("=");
        const numValue = parseFloat(value);

        switch (key.toLowerCase()) {
          case "pitch":
          case "p":
            config.espeak!.pitch = Math.max(0, Math.min(99, numValue));
            break;
          case "amp":
          case "amplitude":
          case "a":
            config.espeak!.amplitude = Math.max(0, Math.min(200, numValue));
            break;
          case "speed":
          case "s":
            config.espeak!.speed = Math.max(80, Math.min(400, numValue));
            break;
          case "gap":
          case "g":
            config.espeak!.wordGap = Math.max(0, Math.min(100, numValue));
            break;
          case "capital":
          case "k":
            config.espeak!.capitalEmphasis = Math.max(0, Math.min(40, numValue));
            break;
        }
      }
    });

    return config;
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
      case "espeak":
        const espeak = config.espeak!;
        return `eSpeak ${espeak.variant} (pitch=${espeak.pitch}, speed=${espeak.speed})`;
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
