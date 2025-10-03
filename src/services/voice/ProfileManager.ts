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

    // Normal speed Danny
    this.profiles.set("piper-danny", {
      provider: "piper",
      piper: {
        voice: "danny",
        speed: 1.0,
        speaker: undefined,
      },
    });

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

    // Sardonic Piper voice - danny slowed down
    this.profiles.set("piper-sardonic", {
      provider: "piper",
      piper: {
        voice: "danny",
        speed: 0.85, // Slower for robotic deliberate delivery
        speaker: undefined,
      },
    });

    // Fast and energetic
    this.profiles.set("piper-energetic", {
      provider: "piper",
      piper: {
        voice: "ryan",
        speed: 1.2, // Faster
        speaker: undefined,
      },
    });

    // Calm and measured
    this.profiles.set("piper-calm", {
      provider: "piper",
      piper: {
        voice: "lessac",
        speed: 0.85, // Slower for calm delivery
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

    // Try to parse as custom Linux voice string (e.g., "en+m2:pitch=55:amp=100")
    if (profile.includes(":") || profile.startsWith("en+")) {
      return this.parseCustomLinuxConfig(profile);
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
          } else if (config.espeak) {
            // For espeak, speed is WPM, so adjust proportionally
            const baseSpeed = config.espeak.speed || 160;
            config.espeak.speed = Math.round(baseSpeed * speed);
          } else if (config.system) {
            config.system.speed = speed;
          }
          logger.info(`🎭 Applied speed override: ${speed}x to profile ${profileName}`);
        }
      }
    }

    return config;
  }

  /**
   * Get default configuration based on environment and provider availability
   */
  private getDefaultConfig(): VoiceConfig {
    // Always prefer Piper John voice (high-quality neural TTS)
    // UnifiedVoiceService will handle fallback if Piper is unavailable
    if (this.profiles.has("piper-default")) {
      logger.debug("🎤 Returning piper-default as default config");
      return this.profiles.get("piper-default")!;
    }

    // Fallback to sardonic Linux voice (free, no API costs)
    if (this.profiles.has("zenbot-sardonic")) {
      logger.debug("🎤 Returning zenbot-sardonic as fallback default");
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
