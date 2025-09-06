import { User, Presence, VoiceBasedChannel, Client } from "discord.js";
import { ZenbotSession } from "./ZenbotSession";
import { ZenbotEventQueue } from "../queue/ZenbotEventQueue";
import { logger } from "../../utils/logger";

/**
 * Main Zenbot class that manages user sessions and provides the AI interface
 */
export class Zenbot {
  private static instance: Zenbot;
  private eventQueue: ZenbotEventQueue;
  private sessions: Map<string, ZenbotSession> = new Map();
  private client?: Client;

  private constructor() {
    this.eventQueue = new ZenbotEventQueue();

    logger.info(
      "🧘 Zenbot AI system initialized - Experience tranquility through intelligence"
    );
  }

  /**
   * Initialize with Discord client
   */
  initialize(client: Client): void {
    this.client = client;
    this.eventQueue.initialize(client, this);
    logger.info("🧘 Zenbot initialized with Discord client");
  }

  /**
   * Get singleton instance
   */
  static getInstance(): Zenbot {
    if (!Zenbot.instance) {
      Zenbot.instance = new Zenbot();
    }
    return Zenbot.instance;
  }

  /**
   * Get or create a session for a user
   */
  getSession(user: User): ZenbotSession {
    const userId = user.id;

    if (!this.sessions.has(userId)) {
      const session = new ZenbotSession(user, this.eventQueue);
      this.sessions.set(userId, session);
      logger.debug(`Created new Zenbot session for ${user.username}`);
    }

    return this.sessions.get(userId)!;
  }

  /**
   * Get session statistics
   */
  getStats(): {
    activeSessions: number;
    totalSessions: number;
    queueStats: { queueLength: number; processing: boolean; handlers: number };
  } {
    const activeSessions = Array.from(this.sessions.values()).filter((s) =>
      s.isActive()
    ).length;

    return {
      activeSessions,
      totalSessions: this.sessions.size,
      queueStats: this.eventQueue.getStats(),
    };
  }

  generateChannelName(channel: VoiceBasedChannel): string {
    let possibleNames: string[] = [];

    let memberNames = channel.members
      .filter((member) => !member.user.bot)
      .map((member) => member.displayName)
      .sort(); // Simple alphabetical sort

    //is Timbo there?
    if (channel.members.some((m) => m.user.id === "299595170767306752"))
      possibleNames.push("Discord Jerkoff Session");

    let numMembers = memberNames.length;
    logger.debug(`${numMembers} members in voice channel`);

    //wild cards
    possibleNames.push("Pixel Purgatory");
    possibleNames.push("Rage Quit Retreat");
    switch (numMembers) {
      case 0:
        possibleNames.push("Empty Lounge");
        possibleNames.push("No one here but us chickens");
        possibleNames.push("Ghost Town");
        possibleNames.push("The Void");
        possibleNames.push("The Abyss");
        possibleNames.push("Empty Space");
        possibleNames.push("Pending Removal");
        possibleNames.push("Server cost");
        possibleNames.push("404 Lounge");
        break;
      case 1:
        possibleNames.push("👉👈");
        possibleNames.push("Lounge 2: Electric Boogaloo");
        possibleNames.push("Fire starter");
        possibleNames.push("Solo Lounge");
        possibleNames.push("Lone Lounge");
        possibleNames.push("Army of One");
        possibleNames.push("One-Man Lounge");
        possibleNames.push(`Only 1?, Lamesauce`);
        possibleNames.push(`Omg you reading this?`);
        possibleNames.push(`${memberNames[0]}'s Lounge`);
        possibleNames.push(`${memberNames[0]}'s Lounge`);
        possibleNames.push(`${memberNames[0]}'s Lounge`);
        possibleNames.push(`${memberNames[0]}'s Lounge`);
        possibleNames.push(`${memberNames[0]}'s Lounge`);
        possibleNames.push(`${memberNames[0]}'s Lounge`);
        possibleNames.push(`${memberNames[0]}'s Lounge`);
        possibleNames.push(`${memberNames[0]}'s Lounge`);
        break;
      case 2:
        possibleNames.push("Dynamic Duo");
        possibleNames.push("Power Pair");
        possibleNames.push("Dual Warriors");
        possibleNames.push("Twin Titans");
        possibleNames.push("Double Trouble");
        possibleNames.push("Pair of Legends");
        possibleNames.push("Dynamic Dorks");
        possibleNames.push("The Dual Delinquents");
        possibleNames.push(`${memberNames[0]} & ${memberNames[1]}`);
        possibleNames.push(
          `${memberNames[0]} & ${memberNames[1]}'s Get Together`
        );
        break;
      case 3:
        possibleNames.push("Trio of Trolls");
        possibleNames.push("Triple Threat");
        possibleNames.push("Triforce Warriors");
        possibleNames.push("Three Musketeers");
        possibleNames.push("Tactical Trinity");
        possibleNames.push("Triumphant Triad");
        break;
      case 4:
        possibleNames.push("The Four Horseman");
        possibleNames.push("Quad Squad");
        possibleNames.push("Fantastic Four");
        possibleNames.push("Elite Ensemble");
        possibleNames.push("Quartet of Chaos");
        possibleNames.push("The Fabulous Four");
        break;
      case 5:
        possibleNames.push("Pentaforce");
        possibleNames.push("Quintessential Warriors");
        possibleNames.push("Fivefold Fury");
        possibleNames.push("The Fabulous Five");
        break;
      case 6:
        possibleNames.push("Team Hexagon");
        possibleNames.push("Six-Pack Power");
        possibleNames.push("Epic Gamer Lounge");
        possibleNames.push("The Savage Six");
        break;
      default:
        possibleNames.push("Overcrowded");
        possibleNames.push("The Grand Assembly");
        possibleNames.push("Discord Overflow");
        break;
    }

    return (
      possibleNames[Math.floor(Math.random() * possibleNames.length)] ??
      "Lounge"
    );
  }

  /**
   * Handle Discord presence updates - observe user's spiritual journey
   */
  handlePresenceUpdate(
    oldPresence: Presence | null,
    newPresence: Presence
  ): void {
    if (!newPresence.user || newPresence.user.bot) {
      return; // Ignore bot presence updates
    }

    const user = newPresence.user;
    const userId = user.id;

    // Only process if we have an active session for this user
    if (!this.sessions.has(userId)) {
      return;
    }

    const session = this.sessions.get(userId)!;

    try {
      // Detect interesting presence changes
      const oldStatus = oldPresence?.status;
      const newStatus = newPresence.status;
      const oldActivity = oldPresence?.activities?.[0];
      const newActivity = newPresence.activities?.[0];

      // Log significant presence changes
      if (oldStatus !== newStatus) {
        logger.debug(
          `🧘 ${user.username} status changed: ${oldStatus} → ${newStatus}`
        );

        // Update session context based on status
        if (newStatus === "online" && oldStatus !== "online") {
          this.handleUserOnline(session, user);
        } else if (newStatus === "offline" || newStatus === "invisible") {
          this.handleUserOffline(session, user);
        }
      }

      // Detect activity changes (gaming, streaming, etc.)
      if (
        newActivity &&
        (!oldActivity || oldActivity.name !== newActivity.name)
      ) {
        this.handleActivityChange(session, user, newActivity);
      }

      // Update session metadata with current presence
      this.updateSessionPresence(session, newPresence);
    } catch (error) {
      logger.error(
        `Error handling presence update for ${user.username}:`,
        error
      );
    }
  }

  /**
   * Handle when a user comes online
   */
  private handleUserOnline(session: ZenbotSession, user: User): void {
    logger.debug(
      `🧘 ${user.username} has achieved digital enlightenment (came online)`
    );

    // Could trigger a gentle greeting if appropriate
    // For now, just update internal state
  }

  /**
   * Handle when a user goes offline
   */
  private handleUserOffline(session: ZenbotSession, user: User): void {
    logger.debug(`🧘 ${user.username} has entered the void (went offline)`);

    // Mark session as potentially inactive soon
    // The cleanup will handle removing old sessions
  }

  /**
   * Handle activity changes (gaming, streaming, etc.)
   */
  private handleActivityChange(
    session: ZenbotSession,
    user: User,
    activity: any
  ): void {
    const activityName = activity.name;
    const activityType = activity.type;

    logger.debug(
      `🧘 ${user.username} activity: ${activityName} (${activityType})`
    );

    // Update session context with current activity
    // This could influence AI responses - e.g., gaming-related wisdom
    if (activityType === 0) {
      // Playing a game
      session.setActivityContext("gaming", activityName);
    } else if (activityType === 1) {
      // Streaming
      session.setActivityContext("streaming", activityName);
    } else if (activityType === 2) {
      // Listening to music
      session.setActivityContext("listening", activityName);
    } else if (activityType === 3) {
      // Watching
      session.setActivityContext("watching", activityName);
    }
  }

  /**
   * Update session presence metadata
   */
  private updateSessionPresence(
    session: ZenbotSession,
    presence: Presence
  ): void {
    // Store presence information that might be useful for AI context
    const presenceData = {
      status: presence.status,
      activities:
        presence.activities?.map((a) => ({
          name: a.name,
          type: a.type,
          details: a.details,
          state: a.state,
        })) || [],
      updatedAt: new Date(),
    };

    session.updatePresenceContext(presenceData);
  }

  /**
   * Clean up inactive sessions
   */
  private cleanupInactiveSessions(): void {
    const before = this.sessions.size;

    for (const [userId, session] of this.sessions.entries()) {
      if (!session.isActive()) {
        session.destroy();
        this.sessions.delete(userId);
      }
    }

    const cleaned = before - this.sessions.size;
    if (cleaned > 0) {
      logger.info(`🧘 Cleaned up ${cleaned} inactive Zenbot sessions`);
    }
  }

  /**
   * Force cleanup of all sessions (for shutdown)
   */
  destroy(): void {
    for (const session of this.sessions.values()) {
      session.destroy();
    }
    this.sessions.clear();
    logger.info("🧘 Zenbot AI system shutdown complete");
  }
}
