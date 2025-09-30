import {
  AudioResource,
  createAudioResource,
  StreamType,
} from "@discordjs/voice";
import { promises as fs } from "fs";
import path from "path";
import { Readable } from "stream";
import say from "say";
import { VoiceProvider, VoiceConfig } from "../types";
import { logger } from "../../../utils/logger";

/**
 * System TTS provider for Windows and macOS
 * Uses say.js for platform-native text-to-speech
 */
export class SystemProvider implements VoiceProvider {
  name = "system";
  private readonly tempDir =
    process.env.NODE_ENV === "production"
      ? "/tmp/zenbot"
      : path.join(process.cwd(), "temp");

  /**
   * Check if system TTS is available
   */
  isAvailable(): boolean {
    return ["darwin", "win32"].includes(process.platform);
  }

  /**
   * Create audio using system TTS
   */
  async createAudio(text: string, config: VoiceConfig): Promise<AudioResource> {
    if (!config.system) {
      throw new Error("System configuration required for SystemProvider");
    }

    logger.info(
      `🏠 Creating System TTS: "${text.substring(0, 50)}..." (${config.system.voice})`,
    );

    try {
      await this.ensureTempDir();
      const buffer = await this.generateTTS(text, config.system);

      if (buffer.length === 0) {
        throw new Error("System TTS generated empty audio buffer");
      }

      // Create audio resource
      const stream = new Readable();
      stream.push(buffer);
      stream.push(null);

      const resource = createAudioResource(stream, {
        inputType: StreamType.Arbitrary,
      });

      logger.info(`🏠 System TTS created: ${buffer.length} bytes`);
      return resource;
    } catch (error) {
      logger.error("🏠 System TTS error:", error);
      throw new Error(`System TTS failed: ${(error as Error).message}`);
    }
  }

  /**
   * Generate TTS buffer using say.js
   */
  private async generateTTS(
    text: string,
    config: VoiceConfig["system"],
  ): Promise<Buffer> {
    const tempFile = this.getTempFilename();

    return new Promise<Buffer>((resolve, reject) => {
      // Try with specified voice first, then fallback to default
      const tryExport = (voiceToUse?: string) => {
        say.export(
          text,
          voiceToUse,
          config!.speed,
          tempFile,
          async (err: any) => {
            if (err) {
              if (voiceToUse && voiceToUse !== "default") {
                logger.warn(
                  `Voice '${voiceToUse}' failed, trying default voice:`,
                  err,
                );
                tryExport(undefined); // Try without voice parameter
              } else {
                logger.error("Say.js export error:", err);
                reject(err);
              }
            } else {
              try {
                if (voiceToUse) {
                  logger.info(`Successfully used voice: ${voiceToUse}`);
                } else {
                  logger.info("Successfully used system default voice");
                }

                // Read the file
                const buffer = await fs.readFile(tempFile);

                // Clean up temp file
                fs.unlink(tempFile).catch((err) =>
                  logger.warn(`Failed to cleanup temp file ${tempFile}:`, err),
                );

                resolve(buffer);
              } catch (readError) {
                reject(new Error(`Failed to read TTS output: ${readError}`));
              }
            }
          },
        );
      };

      tryExport(config!.voice);
    });
  }

  /**
   * Ensure temp directory exists
   */
  private async ensureTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      logger.error("Error creating temp directory:", error);
    }
  }

  /**
   * Generate unique temp filename
   */
  private getTempFilename(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return path.join(this.tempDir, `system_tts_${timestamp}_${random}.wav`);
  }

  /**
   * Test system provider
   */
  async test(text: string): Promise<{ success: boolean; audioSize: number }> {
    try {
      const config: VoiceConfig = {
        provider: "system",
        system: {
          voice:
            process.platform === "win32" ? "Microsoft David Desktop" : "Alex",
          speed: 1.0,
        },
      };

      const resource = await this.createAudio(text, config);
      return { success: true, audioSize: 1000 }; // Placeholder size
    } catch (error) {
      logger.error("System provider test failed:", error);
      return { success: false, audioSize: 0 };
    }
  }

  /**
   * Get available voices for current platform
   */
  getAvailableVoices(): string[] {
    switch (process.platform) {
      case "darwin": // macOS
        return [
          "Alex",
          "Alice",
          "Allison",
          "Ava",
          "Bruce",
          "Fred",
          "Kathy",
          "Moira",
          "Samantha",
          "Susan",
          "Victoria",
          "Whisper",
        ];
      case "win32": // Windows
        return [
          "Microsoft David Desktop",
          "Microsoft Zira Desktop",
          "Microsoft Mark Desktop",
          "Microsoft Hazel Desktop",
          "Microsoft Eva Desktop",
        ];
      default:
        return ["default"];
    }
  }
}
