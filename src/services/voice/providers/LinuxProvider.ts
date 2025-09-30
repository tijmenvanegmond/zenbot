import {
  AudioResource,
  createAudioResource,
  StreamType,
} from "@discordjs/voice";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { Readable } from "stream";
import { VoiceProvider, VoiceConfig } from "../types";
import { logger } from "../../../utils/logger";

/**
 * Linux eSpeak-NG voice provider
 * Provides advanced voice tweaking and personality profiles
 */
export class LinuxProvider implements VoiceProvider {
  name = "linux";
  private readonly tempDir = "/tmp/zenbot";

  /**
   * Check if Linux eSpeak-NG is available
   */
  isAvailable(): boolean {
    return process.platform === "linux";
  }

  /**
   * Create audio using eSpeak-NG
   */
  async createAudio(text: string, config: VoiceConfig): Promise<AudioResource> {
    if (!config.linux) {
      throw new Error("Linux configuration required for LinuxProvider");
    }

    logger.info(
      `🐧 Creating Linux TTS: "${text.substring(0, 50)}..." (${config.linux.variant})`,
    );

    try {
      await this.ensureTempDir();
      const buffer = await this.generateTTS(text, config.linux);

      if (buffer.length === 0) {
        throw new Error("eSpeak-NG generated empty audio buffer");
      }

      // Create audio resource
      const stream = new Readable();
      stream.push(buffer);
      stream.push(null);

      const resource = createAudioResource(stream, {
        inputType: StreamType.Arbitrary,
      });

      logger.info(`🐧 Linux TTS created: ${buffer.length} bytes`);
      return resource;
    } catch (error) {
      logger.error("🐧 Linux TTS error:", error);
      throw new Error(`Linux TTS failed: ${(error as Error).message}`);
    }
  }

  /**
   * Generate TTS buffer using eSpeak-NG
   */
  private async generateTTS(
    text: string,
    config: VoiceConfig["linux"],
  ): Promise<Buffer> {
    const tempFile = this.getTempFilename();
    const args = this.buildESpeakArgs(config!, tempFile, text);

    logger.info(`🐧 eSpeak command: espeak-ng ${args.join(" ")}`);

    return new Promise((resolve, reject) => {
      const espeakCmd = spawn("espeak-ng", args, {
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stderr = "";

      espeakCmd.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      espeakCmd.on("close", async (code) => {
        if (code === 0) {
          try {
            const buffer = await fs.readFile(tempFile);

            // Clean up temp file
            fs.unlink(tempFile).catch((err) =>
              logger.warn(`Failed to cleanup temp file ${tempFile}:`, err),
            );

            resolve(buffer);
          } catch (error) {
            reject(new Error(`Failed to read eSpeak output: ${error}`));
          }
        } else {
          logger.error(`🐧 eSpeak-NG failed with code ${code}, stderr: ${stderr}`);
          reject(new Error(`eSpeak-NG failed with code ${code}: ${stderr}`));
        }
      });

      espeakCmd.on("error", (error) => {
        reject(new Error(`eSpeak-NG process error: ${error.message}`));
      });
    });
  }

  /**
   * Build eSpeak-NG command arguments
   */
  private buildESpeakArgs(
    config: VoiceConfig["linux"],
    outputFile: string,
    text: string,
  ): string[] {
    const args = [
      "-w",
      outputFile, // Write to file
      "-v",
      config!.variant, // Voice variant
      "-p",
      config!.pitch.toString(), // Pitch
      "-a",
      config!.amplitude.toString(), // Amplitude
      "-s",
      config!.speed.toString(), // Speed (WPM)
      "-g",
      config!.wordGap.toString(), // Word gap
      "-k",
      config!.capitalEmphasis.toString(), // Capital emphasis
    ];

    // Add punctuation mode
    if (config!.punctuation) {
      args.push("--punct");
    }

    // Add SSML support
    if (config!.ssml) {
      args.push("-m");
    }

    // Add text as final argument
    args.push(text);

    return args;
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
    return path.join(this.tempDir, `linux_tts_${timestamp}_${random}.wav`);
  }

  /**
   * Test Linux provider
   */
  async test(text: string): Promise<{ success: boolean; audioSize: number }> {
    try {
      const config: VoiceConfig = {
        provider: "linux",
        linux: {
          variant: "en+m2",
          pitch: 55,
          amplitude: 100,
          speed: 160,
          wordGap: 5,
          capitalEmphasis: 20,
          punctuation: false,
          ssml: false,
        },
      };

      const resource = await this.createAudio(text, config);
      return { success: true, audioSize: 1000 }; // Placeholder size
    } catch (error) {
      logger.error("Linux provider test failed:", error);
      return { success: false, audioSize: 0 };
    }
  }
}
