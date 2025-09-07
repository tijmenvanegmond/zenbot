import { VoiceConnection, VoiceConnectionStatus } from "@discordjs/voice";
import { VoiceChannel } from "discord.js";
import { logger } from "../utils/logger";

export interface VoiceSession {
  guildId: string;
  channelId: string;
  connection: VoiceConnection;
  activeActivities: Set<string>; // Track what's keeping the bot in the channel
  createdAt: Date;
  lastActivity: Date;
}

/**
 * Manages voice channel sessions with intelligent leave logic
 */
export class VoiceSessionManager {
  private static instance: VoiceSessionManager;
  private sessions = new Map<string, VoiceSession>(); // guildId -> session

  private constructor() {}

  static getInstance(): VoiceSessionManager {
    if (!this.instance) {
      this.instance = new VoiceSessionManager();
    }
    return this.instance;
  }

  /**
   * Register or get existing voice session for a guild
   */
  async registerSession(
    guildId: string,
    channelId: string,
    connection: VoiceConnection,
    activityType: string,
  ): Promise<VoiceSession> {
    const existing = this.sessions.get(guildId);

    if (existing) {
      // Update existing session
      existing.activeActivities.add(activityType);
      existing.lastActivity = new Date();
      existing.channelId = channelId; // Update channel if moved
      logger.info(
        `🎤 Updated voice session for guild ${guildId}: activities=[${Array.from(existing.activeActivities).join(", ")}]`,
      );
      return existing;
    }

    // Create new session
    const session: VoiceSession = {
      guildId,
      channelId,
      connection,
      activeActivities: new Set([activityType]),
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    this.sessions.set(guildId, session);

    // Setup connection cleanup on destroy
    connection.on("stateChange", (oldState, newState) => {
      if (newState.status === VoiceConnectionStatus.Destroyed) {
        this.cleanupSession(guildId);
      }
    });

    logger.info(
      `🎤 Created new voice session for guild ${guildId}, channel ${channelId}: activities=[${activityType}]`,
    );
    return session;
  }

  /**
   * End a specific activity - bot leaves if no activities remain
   */
  async endActivity(guildId: string, activityType: string): Promise<void> {
    const session = this.sessions.get(guildId);
    if (!session) return;

    session.activeActivities.delete(activityType);
    session.lastActivity = new Date();

    logger.info(
      `🎤 Ended activity '${activityType}' for guild ${guildId}: remaining=[${Array.from(session.activeActivities).join(", ")}]`,
    );

    // If no activities remain, consider leaving
    if (session.activeActivities.size === 0) {
      await this.leaveIfAppropriate(guildId);
    }
  }

  /**
   * Get existing session for guild
   */
  getSession(guildId: string): VoiceSession | undefined {
    return this.sessions.get(guildId);
  }

  /**
   * Check if bot should stay in voice channel based on active activities
   */
  shouldStayInChannel(guildId: string): boolean {
    const session = this.sessions.get(guildId);
    if (!session) return false;

    return session.activeActivities.size > 0;
  }

  /**
   * Force leave voice channel and cleanup session
   */
  async forceLeave(guildId: string): Promise<void> {
    const session = this.sessions.get(guildId);
    if (!session) return;

    logger.info(`🎤 Force leaving voice channel for guild ${guildId}`);
    session.connection.destroy();
    this.cleanupSession(guildId);
  }

  /**
   * Leave voice channel if no activities are keeping the bot there
   */
  private async leaveIfAppropriate(guildId: string): Promise<void> {
    const session = this.sessions.get(guildId);
    if (!session) return;

    // Double-check no activities remain
    if (session.activeActivities.size > 0) {
      logger.info(
        `🎤 Not leaving guild ${guildId} - still has activities: [${Array.from(session.activeActivities).join(", ")}]`,
      );
      return;
    }

    // Grace period - wait a moment to see if new activity starts
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check again after grace period
    const currentSession = this.sessions.get(guildId);
    if (!currentSession || currentSession.activeActivities.size > 0) {
      logger.info(
        `🎤 Not leaving guild ${guildId} - new activity started during grace period`,
      );
      return;
    }

    logger.info(
      `🎤 Leaving voice channel for guild ${guildId} - no active activities`,
    );
    currentSession.connection.destroy();
  }

  /**
   * Cleanup session data
   */
  private cleanupSession(guildId: string): void {
    this.sessions.delete(guildId);
    logger.info(`🎤 Cleaned up voice session for guild ${guildId}`);
  }

  /**
   * Get all active sessions (for debugging)
   */
  getActiveSessions(): Map<string, VoiceSession> {
    return new Map(this.sessions);
  }

  /**
   * Update activity timestamp for session
   */
  updateActivity(guildId: string): void {
    const session = this.sessions.get(guildId);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  /**
   * Check if session exists for guild
   */
  hasActiveSession(guildId: string): boolean {
    return this.sessions.has(guildId);
  }
}
