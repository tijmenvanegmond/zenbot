import { VoiceChannel } from "discord.js";
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  StreamType,
  AudioPlayerStatus,
} from "@discordjs/voice";
import { OpenAIService } from "./openaiService";
import { VoiceSessionManager } from "./voiceSessionManager";
import { logger } from "../utils/logger";
import { Readable } from "stream";

/**
 * Smart TTS service that integrates with voice session management
 */
export class SmartTtsService {
  private static instance: SmartTtsService;
  private sessionManager: VoiceSessionManager;

  private constructor() {
    this.sessionManager = VoiceSessionManager.getInstance();
  }

  static getInstance(): SmartTtsService {
    if (!this.instance) {
      this.instance = new SmartTtsService();
    }
    return this.instance;
  }

  /**
   * Play TTS in voice channel with smart session management
   */
  async playTTS(
    voiceChannel: VoiceChannel,
    text: string,
    activityType: string = "tts",
  ): Promise<void> {
    try {
      logger.info(
        `🎤 Smart TTS request for channel ${voiceChannel.name}: "${text.substring(0, 50)}..."`,
      );

      // Get or create voice session
      let session = this.sessionManager.getSession(voiceChannel.guildId);

      if (!session) {
        // Create new voice connection
        const connection = joinVoiceChannel({
          selfDeaf: false,
          channelId: voiceChannel.id,
          guildId: voiceChannel.guildId,
          adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        });

        session = await this.sessionManager.registerSession(
          voiceChannel.guildId,
          voiceChannel.id,
          connection,
          activityType,
        );
      } else {
        // Add this activity to existing session
        session.activeActivities.add(activityType);
        this.sessionManager.updateActivity(voiceChannel.guildId);
        logger.info(
          `🎤 Using existing session for TTS: activities=[${Array.from(session.activeActivities).join(", ")}]`,
        );
      }

      // Generate TTS audio
      const audioBuffer = await OpenAIService.createTTSStream(text);
      const audioStream = Readable.from(audioBuffer);

      // Create audio player and resource
      const player = createAudioPlayer();
      const resource = createAudioResource(audioStream, {
        inputType: StreamType.Arbitrary,
      });

      // Subscribe connection to player
      session.connection.subscribe(player);

      // Play audio and wait for completion
      player.play(resource);

      await new Promise<void>((resolve, reject) => {
        player.on(AudioPlayerStatus.Idle, () => {
          logger.info(
            `🎤 TTS playback completed for activity '${activityType}'`,
          );
          resolve();
        });

        player.on("error", (error) => {
          logger.error(`🎤 TTS playback error:`, error);
          reject(error);
        });

        // Timeout after 2 minutes
        const timeout = setTimeout(() => {
          logger.warn(`🎤 TTS playback timeout for activity '${activityType}'`);
          resolve();
        }, 120000);

        player.on(AudioPlayerStatus.Idle, () => clearTimeout(timeout));
      });

      // End this specific TTS activity (session manager will decide if bot should leave)
      await this.sessionManager.endActivity(voiceChannel.guildId, activityType);
    } catch (error) {
      logger.error(`🎤 Smart TTS error:`, error);
      // Clean up activity on error
      await this.sessionManager.endActivity(voiceChannel.guildId, activityType);
      throw error;
    }
  }

  /**
   * Play TTS without ending the activity (for ongoing sessions like listen)
   */
  async playTTSInSession(
    voiceChannel: VoiceChannel,
    text: string,
    sessionActivityType: string,
  ): Promise<void> {
    const session = this.sessionManager.getSession(voiceChannel.guildId);

    if (!session) {
      // No active session - create temporary TTS session
      return this.playTTS(voiceChannel, text, "temp-tts");
    }

    try {
      logger.info(
        `🎤 TTS in existing session '${sessionActivityType}': "${text.substring(0, 50)}..."`,
      );

      // Generate TTS audio
      const audioBuffer = await OpenAIService.createTTSStream(text);
      const audioStream = Readable.from(audioBuffer);

      // Create audio player and resource
      const player = createAudioPlayer();
      const resource = createAudioResource(audioStream, {
        inputType: StreamType.Arbitrary,
      });

      // Subscribe connection to player
      session.connection.subscribe(player);

      // Play audio and wait for completion
      player.play(resource);

      await new Promise<void>((resolve, reject) => {
        player.on(AudioPlayerStatus.Idle, () => {
          logger.info(`🎤 Session TTS completed`);
          resolve();
        });

        player.on("error", (error) => {
          logger.error(`🎤 Session TTS error:`, error);
          reject(error);
        });

        // Timeout after 2 minutes
        const timeout = setTimeout(() => {
          logger.warn(`🎤 Session TTS timeout`);
          resolve();
        }, 120000);

        player.on(AudioPlayerStatus.Idle, () => clearTimeout(timeout));
      });

      // Update activity but don't end it (session continues)
      this.sessionManager.updateActivity(voiceChannel.guildId);
    } catch (error) {
      logger.error(`🎤 Session TTS error:`, error);
      throw error;
    }
  }

  /**
   * Get session manager instance
   */
  getSessionManager(): VoiceSessionManager {
    return this.sessionManager;
  }
}
