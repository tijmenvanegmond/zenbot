import {
  AudioResource,
  createAudioResource,
  StreamType,
} from "@discordjs/voice";
import { Readable } from "stream";
import { VoiceProvider, VoiceConfig } from "../types";
import { logger } from "../../../utils/logger";

/**
 * Piper TTS voice provider
 * Connects to Piper HTTP server for high-quality neural TTS
 * Falls back gracefully if Piper service is unavailable
 */
export class PiperProvider implements VoiceProvider {
  name = "piper";
  private piperUrl: string;
  private isServiceAvailable: boolean | null = null;
  private lastCheckTime: number = 0;
  private readonly checkInterval = 60000; // Re-check availability every 60 seconds

  constructor() {
    this.piperUrl = process.env.PIPER_URL || "http://localhost:8080";
    // Start checking availability asynchronously
    // Don't block constructor, but initiate check immediately
    this.performAsyncCheck();
  }

  /**
   * Check if Piper service is available
   * Caches result to avoid excessive health checks
   * Returns true if available, false if not or unknown
   */
  isAvailable(): boolean {
    // If we have a cached result, use it
    if (this.isServiceAvailable !== null) {
      // Refresh check if cache is stale
      const now = Date.now();
      if (now - this.lastCheckTime >= this.checkInterval) {
        this.performAsyncCheck();
      }
      return this.isServiceAvailable;
    }

    // No cached result yet - trigger async check and assume available
    // This optimistic approach allows first requests to try Piper
    // rather than immediately falling back to eSpeak
    this.performAsyncCheck();
    return true; // Optimistically assume available until proven otherwise
  }

  /**
   * Perform async availability check
   */
  private async performAsyncCheck(): Promise<void> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000); // 2s timeout

      // Test with health endpoint instead of full TTS request
      const response = await fetch(`${this.piperUrl}/health`, {
        signal: controller.signal,
      });

      clearTimeout(timeout);
      this.lastCheckTime = Date.now();
      this.isServiceAvailable = response.ok;

      if (this.isServiceAvailable) {
        logger.info(`🎤 Piper service available at ${this.piperUrl}`);
      } else {
        logger.warn(
          `🎤 Piper service unhealthy at ${this.piperUrl}: ${response.status}`,
        );
      }
    } catch (error) {
      this.lastCheckTime = Date.now();
      this.isServiceAvailable = false;
      logger.debug(
        `🎤 Piper service unavailable at ${this.piperUrl}:`,
        error instanceof Error ? error.message : "Connection failed",
      );
    }
  }

  /**
   * Create audio using Piper TTS
   */
  async createAudio(text: string, config: VoiceConfig): Promise<AudioResource> {
    if (!config.piper) {
      throw new Error("Piper configuration required for PiperProvider");
    }

    logger.info(
      `🎙️ Creating Piper TTS: "${text.substring(0, 50)}..." (voice: ${config.piper.voice}, speed: ${config.piper.speed})`,
    );

    try {
      // Ensure service is available
      await this.performAsyncCheck();
      if (!this.isServiceAvailable) {
        throw new Error("Piper service is not available");
      }

      const buffer = await this.generateTTS(text, config.piper);

      if (buffer.length === 0) {
        throw new Error("Piper generated empty audio buffer");
      }

      // Create audio resource
      const stream = new Readable();
      stream.push(buffer);
      stream.push(null);

      const resource = createAudioResource(stream, {
        inputType: StreamType.Arbitrary,
      });

      logger.info(`🎙️ Piper TTS created: ${buffer.length} bytes`);
      return resource;
    } catch (error) {
      logger.error("🎙️ Piper TTS error:", error);
      throw new Error(`Piper TTS failed: ${(error as Error).message}`);
    }
  }

  /**
   * Generate TTS buffer using Piper HTTP API
   * API format: GET /api/tts?text=<text>&voice=<voice>&speed=<speed>
   */
  private async generateTTS(
    text: string,
    config: VoiceConfig["piper"],
  ): Promise<Buffer> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      // Encode text for URL
      const encodedText = encodeURIComponent(text);

      // Build URL with voice, speed, and effects parameters
      const params = new URLSearchParams({
        text: text,
        voice: config!.voice || "john", // Default to john
        speed: (config!.speed || 1.0).toString(),
      });

      // Add audio effects if specified
      if (config!.effect) params.append("effect", config!.effect);
      if (config!.reverb !== undefined) params.append("reverb", config!.reverb.toString());
      if (config!.pitch !== undefined) params.append("pitch", config!.pitch.toString());
      if (config!.distortion !== undefined) params.append("distortion", config!.distortion.toString());
      if (config!.echo !== undefined) params.append("echo", config!.echo.toString());
      if (config!.bitcrush !== undefined) params.append("bitcrush", config!.bitcrush.toString());

      const response = await fetch(
        `${this.piperUrl}/api/tts?${params.toString()}`,
        {
          method: "GET",
          signal: controller.signal,
        },
      );

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Piper API returned ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      clearTimeout(timeout);

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error("Piper TTS request timed out");
        }
        throw error;
      }
      throw new Error("Unknown error during Piper TTS generation");
    }
  }

  /**
   * Test Piper provider
   */
  async test(text: string): Promise<{ success: boolean; audioSize: number }> {
    try {
      const config: VoiceConfig = {
        provider: "piper",
        piper: {
          voice: "en_US-lessac-medium",
          speed: 1.0,
          speaker: undefined,
        },
      };

      const resource = await this.createAudio(text, config);
      return { success: true, audioSize: 1000 }; // Placeholder size
    } catch (error) {
      logger.error("Piper provider test failed:", error);
      return { success: false, audioSize: 0 };
    }
  }
}