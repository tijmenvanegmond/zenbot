import { promises as fs } from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { createAudioResource, StreamType, AudioResource } from '@discordjs/voice';
import { spawn } from 'child_process';
import { logger } from '../utils/logger';

/**
 * Linux Voice Configuration
 * Dedicated configuration for eSpeak-NG voice synthesis
 */
export interface LinuxVoiceConfig {
  // Voice selection
  voiceVariant: string;     // e.g., 'en+m2', 'en+f1', 'en-gb+m3'

  // Voice parameters
  pitch: number;            // 0-99, default 50
  amplitude: number;        // 0-200, default 100
  speed: number;            // Words per minute, default 175

  // Quality settings
  wordGap: number;          // Milliseconds between words, default 5
  capitalEmphasis: number;  // Emphasis on capitals 0-40, default 20

  // Audio settings
  sampleRate: number;       // Sample rate in Hz, default 22050

  // Advanced settings
  enablePunctuation: boolean;    // Speak punctuation marks
  enableSSML: boolean;           // Enable SSML markup support
  voiceStretch: number;          // Voice stretch factor 0.1-4.0, default 1.0
}

/**
 * Predefined voice profiles for different personalities
 */
export const LINUX_VOICE_PROFILES: Record<string, LinuxVoiceConfig> = {
  // Zenbot personalities
  'zenbot-default': {
    voiceVariant: 'en+m2',
    pitch: 55,
    amplitude: 100,
    speed: 160,
    wordGap: 5,
    capitalEmphasis: 20,
    sampleRate: 22050,
    enablePunctuation: false,
    enableSSML: false,
    voiceStretch: 1.0,
  },
  'zenbot-sardonic': {
    voiceVariant: 'en+m3',
    pitch: 45,
    amplitude: 85,
    speed: 140,
    wordGap: 8,
    capitalEmphasis: 25,
    sampleRate: 22050,
    enablePunctuation: true,
    enableSSML: false,
    voiceStretch: 0.9,
  },
  'zenbot-wise': {
    voiceVariant: 'en+m1',
    pitch: 40,
    amplitude: 90,
    speed: 130,
    wordGap: 10,
    capitalEmphasis: 15,
    sampleRate: 22050,
    enablePunctuation: false,
    enableSSML: false,
    voiceStretch: 0.8,
  },
  'zenbot-excited': {
    voiceVariant: 'en+m4',
    pitch: 70,
    amplitude: 120,
    speed: 200,
    wordGap: 3,
    capitalEmphasis: 30,
    sampleRate: 22050,
    enablePunctuation: false,
    enableSSML: false,
    voiceStretch: 1.2,
  },
  'zenbot-calm': {
    voiceVariant: 'en+m2',
    pitch: 50,
    amplitude: 80,
    speed: 120,
    wordGap: 12,
    capitalEmphasis: 10,
    sampleRate: 22050,
    enablePunctuation: false,
    enableSSML: false,
    voiceStretch: 0.7,
  },
  // Female variants
  'zenbot-female': {
    voiceVariant: 'en+f2',
    pitch: 60,
    amplitude: 95,
    speed: 165,
    wordGap: 5,
    capitalEmphasis: 18,
    sampleRate: 22050,
    enablePunctuation: false,
    enableSSML: false,
    voiceStretch: 1.0,
  },
};

export type LinuxVoiceProfile = keyof typeof LINUX_VOICE_PROFILES;

/**
 * Linux Voice Service
 * Dedicated service for eSpeak-NG voice synthesis on Linux systems
 */
export class LinuxVoiceService {
  private static readonly TEMP_DIR = process.env.NODE_ENV === 'production' ? '/tmp/zenbot' : path.join(process.cwd(), 'temp');
  private static readonly DEFAULT_PROFILE: LinuxVoiceProfile = 'zenbot-default';

  /**
   * Ensure temp directory exists
   */
  private static async ensureTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.TEMP_DIR, { recursive: true });
    } catch (error) {
      logger.error('Error creating temp directory:', error);
    }
  }

  /**
   * Generate unique temp filename
   */
  private static getTempFilename(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return path.join(this.TEMP_DIR, `linux_tts_${timestamp}_${random}.wav`);
  }

  /**
   * Get voice configuration by profile name or custom config
   */
  static getVoiceConfig(profile?: LinuxVoiceProfile | string): LinuxVoiceConfig {
    // If it's a known profile, return it
    if (profile && profile in LINUX_VOICE_PROFILES) {
      return LINUX_VOICE_PROFILES[profile as LinuxVoiceProfile];
    }

    // Try to parse custom config string like "en+m2:pitch=55:amp=100:speed=160"
    if (profile && typeof profile === 'string' && profile.includes(':')) {
      return this.parseCustomVoiceConfig(profile);
    }

    // Default to zenbot-default profile
    return LINUX_VOICE_PROFILES[this.DEFAULT_PROFILE];
  }

  /**
   * Parse custom voice configuration string
   */
  private static parseCustomVoiceConfig(configString: string): LinuxVoiceConfig {
    const config: LinuxVoiceConfig = { ...LINUX_VOICE_PROFILES[this.DEFAULT_PROFILE] };
    const parts = configString.split(':');

    // First part is always voice variant
    if (parts[0]) {
      config.voiceVariant = parts[0];
    }

    // Parse other parameters
    parts.slice(1).forEach(part => {
      if (part.includes('=')) {
        const [key, value] = part.split('=');
        const numValue = parseFloat(value);

        switch (key.toLowerCase()) {
          case 'pitch':
          case 'p':
            config.pitch = Math.max(0, Math.min(99, numValue));
            break;
          case 'amp':
          case 'amplitude':
          case 'a':
            config.amplitude = Math.max(0, Math.min(200, numValue));
            break;
          case 'speed':
          case 's':
            config.speed = Math.max(80, Math.min(400, numValue));
            break;
          case 'gap':
          case 'g':
            config.wordGap = Math.max(0, Math.min(100, numValue));
            break;
          case 'capital':
          case 'k':
            config.capitalEmphasis = Math.max(0, Math.min(40, numValue));
            break;
          case 'stretch':
            config.voiceStretch = Math.max(0.1, Math.min(4.0, numValue));
            break;
          case 'rate':
          case 'sr':
            config.sampleRate = numValue;
            break;
        }
      }
    });

    return config;
  }

  /**
   * Build eSpeak-NG command arguments from configuration
   */
  private static buildESpeakArgs(config: LinuxVoiceConfig, outputFile: string, text: string): string[] {
    const args = [
      '-w', outputFile,                           // Write to file
      '-v', config.voiceVariant,                  // Voice variant
      '-p', config.pitch.toString(),              // Pitch
      '-a', config.amplitude.toString(),          // Amplitude
      '-s', config.speed.toString(),              // Speed (WPM)
      '-g', config.wordGap.toString(),            // Word gap
      '-k', config.capitalEmphasis.toString(),    // Capital emphasis
    ];

    // Add sample rate if not default
    if (config.sampleRate !== 22050) {
      args.push('-z');  // Enable additional options
    }

    // Add punctuation mode
    if (config.enablePunctuation) {
      args.push('--punct');
    }

    // Add SSML support
    if (config.enableSSML) {
      args.push('-m');
    }

    // Add text
    args.push(text);

    return args;
  }

  /**
   * Generate TTS audio using eSpeak-NG
   */
  private static async generateTTS(text: string, config: LinuxVoiceConfig): Promise<Buffer> {
    const tempFile = this.getTempFilename();
    const args = this.buildESpeakArgs(config, tempFile, text);

    logger.info(`🐧 Linux TTS: espeak-ng ${args.join(' ')}`);

    return new Promise((resolve, reject) => {
      const espeakCmd = spawn('espeak-ng', args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stderr = '';

      espeakCmd.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      espeakCmd.on('close', async (code) => {
        if (code === 0) {
          try {
            const buffer = await fs.readFile(tempFile);
            // Clean up temp file
            fs.unlink(tempFile).catch(err =>
              logger.warn(`Failed to cleanup temp file ${tempFile}:`, err)
            );
            logger.info(`🐧 Linux TTS generated ${buffer.length} bytes (profile: ${config.voiceVariant})`);
            resolve(buffer);
          } catch (error) {
            reject(new Error(`Failed to read eSpeak output file: ${error}`));
          }
        } else {
          reject(new Error(`eSpeak-NG failed with code ${code}: ${stderr}`));
        }
      });

      espeakCmd.on('error', (error) => {
        reject(new Error(`eSpeak-NG process error: ${error.message}`));
      });
    });
  }

  /**
   * Create TTS audio stream for Discord playback
   */
  static async createTTSStream(
    text: string,
    profile?: LinuxVoiceProfile | string
  ): Promise<AudioResource> {
    if (process.platform !== 'linux') {
      throw new Error('LinuxVoiceService is only available on Linux systems');
    }

    const config = this.getVoiceConfig(profile);
    logger.info(`🐧 Creating Linux TTS stream: "${text.substring(0, 50)}..." (profile: ${profile || 'default'})`);

    try {
      await this.ensureTempDir();
      const buffer = await this.generateTTS(text, config);

      if (buffer.length === 0) {
        throw new Error('Linux TTS response buffer is empty');
      }

      // Create readable stream from buffer
      const stream = new Readable();
      stream.push(buffer);
      stream.push(null);

      // Create audio resource
      const resource = createAudioResource(stream, {
        inputType: StreamType.Arbitrary,
      });

      logger.info('🐧 Created Linux TTS audio resource successfully');
      return resource;

    } catch (error) {
      logger.error('🐧 Error creating Linux TTS stream:', error);
      throw new Error(`Failed to generate Linux TTS: ${(error as Error).message}`);
    }
  }

  /**
   * Create TTS buffer without Discord audio resource
   */
  static async createTTSBuffer(
    text: string,
    profile?: LinuxVoiceProfile | string
  ): Promise<Buffer> {
    if (process.platform !== 'linux') {
      throw new Error('LinuxVoiceService is only available on Linux systems');
    }

    const config = this.getVoiceConfig(profile);
    logger.info(`🐧 Creating Linux TTS buffer: "${text.substring(0, 50)}..." (profile: ${profile || 'default'})`);

    try {
      await this.ensureTempDir();
      const buffer = await this.generateTTS(text, config);
      logger.info(`🐧 Linux TTS buffer created: ${buffer.length} bytes`);
      return buffer;

    } catch (error) {
      logger.error('🐧 Error creating Linux TTS buffer:', error);
      throw new Error(`Failed to generate Linux TTS buffer: ${(error as Error).message}`);
    }
  }

  /**
   * Test voice configuration and return audio info
   */
  static async testVoiceConfig(
    profile?: LinuxVoiceProfile | string,
    testText: string = "Testing Linux voice configuration"
  ): Promise<{ config: LinuxVoiceConfig; audioSize: number; profile: string }> {
    const config = this.getVoiceConfig(profile);
    const buffer = await this.createTTSBuffer(testText, profile);

    return {
      config,
      audioSize: buffer.length,
      profile: profile || 'default'
    };
  }

  /**
   * Get all available voice profiles
   */
  static getAvailableProfiles(): LinuxVoiceProfile[] {
    return Object.keys(LINUX_VOICE_PROFILES) as LinuxVoiceProfile[];
  }

  /**
   * Get voice configuration details for a profile
   */
  static getProfileInfo(profile: LinuxVoiceProfile): LinuxVoiceConfig {
    return { ...LINUX_VOICE_PROFILES[profile] };
  }

  /**
   * Check if Linux voice service is available
   */
  static isAvailable(): boolean {
    return process.platform === 'linux';
  }

  /**
   * Get voice service info
   */
  static getServiceInfo() {
    return {
      platform: process.platform,
      available: this.isAvailable(),
      profiles: this.getAvailableProfiles(),
      defaultProfile: this.DEFAULT_PROFILE,
      tempDir: this.TEMP_DIR,
    };
  }
}