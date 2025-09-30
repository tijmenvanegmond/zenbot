import { VoiceChannel } from "discord.js";
import {
  AudioResource,
  AudioPlayer,
  VoiceConnection,
  createAudioPlayer,
  joinVoiceChannel,
  AudioPlayerStatus,
} from "@discordjs/voice";
import { PlaybackOptions } from "./types";
import { logger } from "../../utils/logger";

// Auto-leave after 1 minute of inactivity
const IDLE_TIMEOUT_MS = 1 * 60 * 1000;

interface ActiveSession {
  guildId: string;
  channelId: string;
  connection: VoiceConnection;
  player: AudioPlayer;
  currentActivity?: string;
  lastActivity: Date;
  idleTimer?: NodeJS.Timeout;
}

/**
 * Manages audio playback and voice channel sessions
 */
export class AudioManager {
  private static instance: AudioManager;
  private sessions: Map<string, ActiveSession> = new Map();

  private constructor() {}

  static getInstance(): AudioManager {
    if (!this.instance) {
      this.instance = new AudioManager();
    }
    return this.instance;
  }

  /**
   * Play audio in voice channel
   */
  async playAudio(
    voiceChannel: VoiceChannel,
    audioResource: AudioResource,
    options: PlaybackOptions,
  ): Promise<void> {
    const guildId = voiceChannel.guildId;

    logger.info(
      `🔊 Playing audio in ${voiceChannel.name} (activity: ${options.activityType})`,
    );

    try {
      // Get or create session
      let session = this.sessions.get(guildId);

      if (!session || session.channelId !== voiceChannel.id) {
        // Join voice channel
        session = await this.createSession(voiceChannel);
      }

      // Handle interruption
      if (
        options.interruptExisting &&
        session.player.state.status === AudioPlayerStatus.Playing
      ) {
        logger.info(
          `🔊 Interrupting current audio for new activity: ${options.activityType}`,
        );
        session.player.stop();
      }

      // Set current activity and reset idle timer
      session.currentActivity = options.activityType;
      session.lastActivity = new Date();
      this.resetIdleTimer(session);

      // Play audio
      session.player.play(audioResource);

      // Set up completion handler
      this.setupAudioCompletionHandler(session, options.activityType);
    } catch (error) {
      logger.error(`🔊 Error playing audio in ${voiceChannel.name}:`, error);
      throw error;
    }
  }

  /**
   * Create new voice session
   */
  private async createSession(
    voiceChannel: VoiceChannel,
  ): Promise<ActiveSession> {
    const guildId = voiceChannel.guildId;

    logger.info(`🔊 Creating voice session in ${voiceChannel.name}`);

    // Clean up existing session if any
    await this.cleanupSession(guildId);

    // Create connection
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guildId,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });

    // Create player
    const player = createAudioPlayer();

    // Subscribe player to connection
    connection.subscribe(player);

    // Create session
    const session: ActiveSession = {
      guildId,
      channelId: voiceChannel.id,
      connection,
      player,
      lastActivity: new Date(),
    };

    // Store session
    this.sessions.set(guildId, session);

    // Set up connection error handling
    this.setupSessionErrorHandling(session);

    // Set up initial idle timer
    this.resetIdleTimer(session);

    logger.info(`🔊 Voice session created for guild ${guildId}`);
    return session;
  }

  /**
   * Set up audio completion handler
   */
  private setupAudioCompletionHandler(
    session: ActiveSession,
    activityType: string,
  ): void {
    const onComplete = () => {
      logger.info(`🔊 Audio completed for activity: ${activityType}`);
      session.currentActivity = undefined;
      session.lastActivity = new Date();

      // Start idle timer after audio completion
      this.resetIdleTimer(session);

      // Clean up listeners
      session.player.off(AudioPlayerStatus.Idle, onComplete);
      session.player.off("error", onError);
    };

    const onError = (error: Error) => {
      logger.error(
        `🔊 Audio player error for activity ${activityType}:`,
        error,
      );
      session.currentActivity = undefined;

      // Clean up listeners
      session.player.off(AudioPlayerStatus.Idle, onComplete);
      session.player.off("error", onError);
    };

    // Set up one-time listeners
    session.player.once(AudioPlayerStatus.Idle, onComplete);
    session.player.once("error", onError);
  }

  /**
   * Set up session error handling
   */
  private setupSessionErrorHandling(session: ActiveSession): void {
    session.connection.on("error", (error) => {
      logger.error(
        `🔊 Voice connection error in guild ${session.guildId}:`,
        error,
      );
      this.cleanupSession(session.guildId);
    });

    session.connection.on("stateChange", (oldState, newState) => {
      if (newState.status === "destroyed") {
        logger.info(
          `🔊 Voice connection disconnected in guild ${session.guildId}`,
        );
        this.cleanupSession(session.guildId);
      }
    });
  }

  /**
   * Join voice channel (without playing audio)
   */
  async joinChannel(voiceChannel: VoiceChannel): Promise<void> {
    await this.createSession(voiceChannel);
  }

  /**
   * Leave voice channel
   */
  async leaveChannel(guildId: string): Promise<void> {
    await this.cleanupSession(guildId);
  }

  /**
   * Stop all audio in guild
   */
  async stopAudio(guildId: string): Promise<void> {
    const session = this.sessions.get(guildId);
    if (session) {
      session.player.stop();
      session.currentActivity = undefined;
      logger.info(`🔊 Stopped audio in guild ${guildId}`);
    }
  }

  /**
   * Clean up session
   */
  private async cleanupSession(guildId: string): Promise<void> {
    const session = this.sessions.get(guildId);
    if (!session) return;

    logger.info(`🔊 Cleaning up voice session for guild ${guildId}`);

    try {
      // Clear idle timer
      if (session.idleTimer) {
        clearTimeout(session.idleTimer);
      }

      // Stop player
      session.player.stop();

      // Destroy connection
      session.connection.destroy();

      // Remove from sessions
      this.sessions.delete(guildId);

      logger.info(`🔊 Voice session cleaned up for guild ${guildId}`);
    } catch (error) {
      logger.error(`🔊 Error cleaning up session for guild ${guildId}:`, error);
    }
  }

  /**
   * Reset idle timer for session
   */
  private resetIdleTimer(session: ActiveSession): void {
    // Clear existing timer
    if (session.idleTimer) {
      clearTimeout(session.idleTimer);
    }

    // Set new timer
    session.idleTimer = setTimeout(() => {
      logger.info(
        `🔊 Voice session idle timeout reached for guild ${session.guildId}, leaving channel`,
      );
      this.cleanupSession(session.guildId).catch((error) => {
        logger.error(
          `🔊 Error during idle cleanup for guild ${session.guildId}:`,
          error,
        );
      });
    }, IDLE_TIMEOUT_MS);

    logger.debug(
      `🔊 Idle timer reset for guild ${session.guildId} (${IDLE_TIMEOUT_MS / 1000}s)`,
    );
  }

  /**
   * Get current session info
   */
  getSession(guildId: string): ActiveSession | undefined {
    return this.sessions.get(guildId);
  }

  /**
   * Get status of all sessions
   */
  getStatus() {
    const status: { [guildId: string]: any } = {};

    for (const [guildId, session] of this.sessions) {
      status[guildId] = {
        channelId: session.channelId,
        playerStatus: session.player.state.status,
        currentActivity: session.currentActivity,
        connectionState: session.connection.state.status,
      };
    }

    return {
      activeSessions: this.sessions.size,
      sessions: status,
    };
  }

  /**
   * Clean up all sessions (for shutdown)
   */
  async cleanup(): Promise<void> {
    logger.info(
      `🔊 Cleaning up all voice sessions (${this.sessions.size} active)`,
    );

    const cleanupPromises = Array.from(this.sessions.keys()).map((guildId) =>
      this.cleanupSession(guildId),
    );

    await Promise.all(cleanupPromises);
  }
}
