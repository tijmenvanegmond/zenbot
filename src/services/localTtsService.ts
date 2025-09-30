import say from 'say';
import { promises as fs } from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { createAudioResource, StreamType, AudioResource } from '@discordjs/voice';
import { spawn } from 'child_process';
import { logger } from '../utils/logger';
import { VOICE_CONFIG } from '../config';

export interface LocalTTSOptions {
  voice?: string;
  speed?: number;
}

export class LocalTTSService {
  private static readonly DEFAULT_VOICE = process.platform === 'darwin' ? 'Alex' : undefined;
  private static readonly DEFAULT_SPEED = 1.0;
  private static readonly TEMP_DIR = process.env.NODE_ENV === 'production' ? '/tmp/zenbot' : path.join(process.cwd(), 'temp');

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
    return path.join(this.TEMP_DIR, `tts_${timestamp}_${random}.wav`);
  }

  /**
   * Direct eSpeak-NG TTS for Linux with voice tweaking capabilities
   */
  private static async createESpeakTTS(text: string, voice?: string, speed?: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const tempFile = this.getTempFilename();

      // Parse voice for eSpeak parameters
      const { voiceVariant, pitch, amplitude } = this.parseESpeakVoice(voice);
      const speechSpeed = Math.round((speed || 1.0) * 150); // Convert to eSpeak speed

      // Build eSpeak command with tweaking parameters for better quality
      const args = [
        '-w', tempFile,  // Write to file
        '-s', speechSpeed.toString(),  // Speed (words per minute)
        '-p', pitch.toString(),        // Pitch (0-99)
        '-a', amplitude.toString(),    // Amplitude (0-200)
        '-g', '5',                     // Gap between words (milliseconds) for clarity
        '-k', '20',                    // Emphasis on capital letters for better pronunciation
        '-v', voiceVariant,           // Voice variant
        text
      ];

      logger.info(`eSpeak command: espeak-ng ${args.join(' ')}`);

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
            logger.info(`eSpeak-NG generated ${buffer.length} bytes`);
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
   * Parse voice string for eSpeak parameters (enables voice tweaking)
   */
  private static parseESpeakVoice(voice?: string): { voiceVariant: string; pitch: number; amplitude: number } {
    // Default Zenbot voice (clearer, less robotic)
    let voiceVariant = 'en+m2';  // Male variant 2 (clearer than m3)
    let pitch = 55;              // Moderate pitch for clarity
    let amplitude = 100;         // Higher amplitude for better clarity

    if (!voice) return { voiceVariant, pitch, amplitude };

    // Parse custom voice strings like "en+m1:pitch=30:amp=60"
    const parts = voice.split(':');
    voiceVariant = parts[0] || voiceVariant;

    parts.forEach(part => {
      if (part.startsWith('pitch=')) {
        pitch = Math.max(0, Math.min(99, parseInt(part.split('=')[1]) || pitch));
      } else if (part.startsWith('amp=')) {
        amplitude = Math.max(0, Math.min(200, parseInt(part.split('=')[1]) || amplitude));
      }
    });

    return { voiceVariant, pitch, amplitude };
  }

  /**
   * Create TTS audio stream using local say.js
   */
  static async createTTSStream(
    text: string,
    options: LocalTTSOptions = {}
  ): Promise<AudioResource> {
    const { voice = VOICE_CONFIG.LOCAL_TTS_VOICE, speed = VOICE_CONFIG.LOCAL_TTS_SPEED } = options;

    logger.info(`Creating local TTS for text: "${text.substring(0, 50)}..."`);

    try {
      await this.ensureTempDir();

      let buffer: Buffer;

      // Use eSpeak-NG directly on Linux, say.js on other platforms
      if (process.platform === 'linux') {
        logger.info('Using eSpeak-NG TTS for Linux with voice tweaking');
        buffer = await this.createESpeakTTS(text, voice, speed);
      } else {
        // Use say.js for Windows/macOS
        const tempFile = this.getTempFilename();

        // Export TTS to file with voice fallback
        await new Promise<void>((resolve, reject) => {
          // Try with specified voice first, then fallback to default
          const tryExport = (voiceToUse?: string) => {
            say.export(text, voiceToUse, speed, tempFile, (err: any) => {
              if (err) {
                if (voiceToUse && voiceToUse !== 'default') {
                  logger.warn(`Voice '${voiceToUse}' failed, trying default voice:`, err);
                  tryExport(undefined); // Try without voice parameter
                } else {
                  logger.error('Say.js export error:', err);
                  reject(err);
                }
              } else {
                if (voiceToUse) {
                  logger.info(`Successfully used voice: ${voiceToUse}`);
                } else {
                  logger.info('Successfully used system default voice');
                }
                resolve();
              }
            });
          };

          tryExport(voice);
        });

        // Read the file and create stream
        buffer = await fs.readFile(tempFile);

        // Clean up temp file
        fs.unlink(tempFile).catch(err =>
          logger.warn(`Failed to cleanup temp file ${tempFile}:`, err)
        );
      }
      logger.info(`Local TTS buffer size: ${buffer.length} bytes`);

      if (buffer.length === 0) {
        throw new Error('Local TTS response buffer is empty');
      }

      // Create readable stream from buffer
      const stream = new Readable();
      stream.push(buffer);
      stream.push(null);

      // Create audio resource
      const resource = createAudioResource(stream, {
        inputType: StreamType.Arbitrary,
      });

      logger.info('Created local TTS audio resource successfully');
      return resource;

    } catch (error) {
      logger.error('Error creating local TTS stream:', error);
      throw new Error(`Failed to generate local TTS: ${(error as Error).message}`);
    }
  }

  /**
   * Create TTS buffer without Discord audio resource (for API use)
   */
  static async createTTSBuffer(
    text: string,
    options: LocalTTSOptions = {}
  ): Promise<Buffer> {
    const { voice = VOICE_CONFIG.LOCAL_TTS_VOICE, speed = VOICE_CONFIG.LOCAL_TTS_SPEED } = options;

    logger.info(`Creating local TTS buffer for text: "${text.substring(0, 50)}..."`);

    try {
      await this.ensureTempDir();

      let buffer: Buffer;

      // Use eSpeak-NG directly on Linux, say.js on other platforms
      if (process.platform === 'linux') {
        logger.info('Using eSpeak-NG TTS for Linux with voice tweaking');
        buffer = await this.createESpeakTTS(text, voice, speed);
      } else {
        // Use say.js for Windows/macOS
        const tempFile = this.getTempFilename();

        // Export TTS to file with voice fallback
        await new Promise<void>((resolve, reject) => {
          // Try with specified voice first, then fallback to default
          const tryExport = (voiceToUse?: string) => {
            say.export(text, voiceToUse, speed, tempFile, (err: any) => {
              if (err) {
                if (voiceToUse && voiceToUse !== 'default') {
                  logger.warn(`Voice '${voiceToUse}' failed, trying default voice:`, err);
                  tryExport(undefined); // Try without voice parameter
                } else {
                  logger.error('Say.js export error:', err);
                  reject(err);
                }
              } else {
                if (voiceToUse) {
                  logger.info(`Successfully used voice: ${voiceToUse}`);
                } else {
                  logger.info('Successfully used system default voice');
                }
                resolve();
              }
            });
          };

          tryExport(voice);
        });

        // Read the file
        buffer = await fs.readFile(tempFile);

        // Clean up temp file
        fs.unlink(tempFile).catch(err =>
          logger.warn(`Failed to cleanup temp file ${tempFile}:`, err)
        );
      }

      logger.info(`Local TTS buffer created: ${buffer.length} bytes`);
      return buffer;

    } catch (error) {
      logger.error('Error creating local TTS buffer:', error);
      throw new Error(`Failed to generate local TTS buffer: ${(error as Error).message}`);
    }
  }

  /**
   * Speak text directly through system speakers (for testing)
   */
  static async speakText(
    text: string,
    options: LocalTTSOptions = {}
  ): Promise<void> {
    const { voice = VOICE_CONFIG.LOCAL_TTS_VOICE, speed = VOICE_CONFIG.LOCAL_TTS_SPEED } = options;

    logger.info(`Speaking text locally: "${text.substring(0, 50)}..."`);

    return new Promise((resolve, reject) => {
      say.speak(text, voice, speed, (err: any) => {
        if (err) {
          logger.error('Say.js speak error:', err);
          reject(err);
        } else {
          logger.info('Local TTS speech completed');
          resolve();
        }
      });
    });
  }

  /**
   * Stop any current TTS playback
   */
  static async stopTTS(): Promise<void> {
    return new Promise((resolve) => {
      say.stop();
      logger.info('Local TTS stopped');
      resolve();
    });
  }

  /**
   * Get available voices for current platform
   */
  static getAvailableVoices(): string[] {
    switch (process.platform) {
      case 'darwin': // macOS
        return [
          'Alex', 'Alice', 'Allison', 'Ava', 'Bahh', 'Bells', 'Boing',
          'Bruce', 'Bubbles', 'Cellos', 'Deranged', 'Fred', 'Good News',
          'Hysterical', 'Junior', 'Kathy', 'Kyoko', 'Moira', 'Novelty',
          'Paulina', 'Pipe Organ', 'Princess', 'Ralph', 'Samantha',
          'Susan', 'Trinoids', 'Veena', 'Vicki', 'Victoria', 'Whisper',
          'Yuri', 'Zosia', 'Zuzana'
        ];
      case 'win32': // Windows
        return [
          // Classic SAPI 4 voices (older Windows)
          'Microsoft Sam', 'Microsoft Mike', 'Microsoft Mary',
          // Modern SAPI 5 voices (Windows 7+)
          'Microsoft David', 'Microsoft Zira', 'Microsoft Mark',
          'Microsoft David Desktop', 'Microsoft Zira Desktop', 'Microsoft Mark Desktop',
          // Additional modern voices that might be available
          'Microsoft Hazel Desktop', 'Microsoft Eva Desktop'
        ];
      case 'linux':
        return [
          // eSpeak-NG voice variants with tweaking examples
          'en+m3',            // Male variant 3 (default Zenbot)
          'en+m1',            // Male variant 1 (deeper)
          'en+m2',            // Male variant 2 (medium)
          'en+m4',            // Male variant 4 (higher)
          'en+f1',            // Female variant 1
          'en+f2',            // Female variant 2
          'en+f3',            // Female variant 3
          'en+f4',            // Female variant 4
          'en+m3:pitch=30:amp=60',   // Sardonic (low pitch, quiet)
          'en+m2:pitch=70:amp=120',  // Excited (high pitch, loud)
          'en+m1:pitch=20:amp=80',   // Wise (very low pitch)
          'en+m4:pitch=60:amp=100',  // Annoyed (higher pitch)
          // Fallback
          'default'
        ];
      default:
        return ['default'];
    }
  }

  /**
   * Check if local TTS is available on current platform
   */
  static isAvailable(): boolean {
    try {
      // say.js should work on all major platforms
      return ['darwin', 'win32', 'linux'].includes(process.platform);
    } catch {
      return false;
    }
  }
}