/**
 * In-Memory Session Storage
 * Fast storage for development and small deployments
 */

import { AISession, SessionStorage } from '../types';
import { logger } from '../../../utils/logger';

export class MemorySessionStorage implements SessionStorage {
  private sessions = new Map<string, AISession>();
  private cleanupInterval?: NodeJS.Timeout;

  constructor(cleanupIntervalMinutes: number = 30) {
    // Start automatic cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch(error => 
        logger.error('Session cleanup failed:', error)
      );
    }, cleanupIntervalMinutes * 60 * 1000);
  }

  async save(session: AISession): Promise<void> {
    this.sessions.set(session.id, { ...session });
    logger.debug(`💾 Saved session ${session.id} to memory`);
  }

  async get(sessionId: string): Promise<AISession | null> {
    const session = this.sessions.get(sessionId);
    return session ? { ...session } : null;
  }

  async update(sessionId: string, updates: Partial<AISession>): Promise<AISession | null> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    const updated = { ...session, ...updates };
    this.sessions.set(sessionId, updated);
    logger.debug(`🔄 Updated session ${sessionId} in memory`);
    return { ...updated };
  }

  async delete(sessionId: string): Promise<void> {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      logger.debug(`🗑️ Deleted session ${sessionId} from memory`);
    }
  }

  async find(criteria: {
    userId?: string;
    contextId?: string;
    character?: string;
    createdAfter?: Date;
    expiredOnly?: boolean;
  }): Promise<AISession[]> {
    const sessions = Array.from(this.sessions.values());
    const now = new Date();

    return sessions.filter(session => {
      if (criteria.userId && session.userId !== criteria.userId) return false;
      if (criteria.contextId && session.contextId !== criteria.contextId) return false;
      if (criteria.character && session.metadata.character !== criteria.character) return false;
      if (criteria.createdAfter && session.createdAt < criteria.createdAfter) return false;
      if (criteria.expiredOnly) {
        const isExpired = session.expiresAt && session.expiresAt < now;
        if (!isExpired) return false;
      }
      return true;
    });
  }

  async cleanup(): Promise<number> {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt && session.expiresAt < now) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(`🧹 Memory storage cleaned up ${cleanedCount} expired sessions`);
    }

    return cleanedCount;
  }

  /**
   * Get storage statistics
   */
  getStats(): {
    totalSessions: number;
    expiredSessions: number;
    memoryUsage: string;
  } {
    const total = this.sessions.size;
    const now = new Date();
    const expired = Array.from(this.sessions.values())
      .filter(s => s.expiresAt && s.expiresAt < now)
      .length;

    // Rough memory usage estimate
    const avgSessionSize = 2000; // bytes per session (rough estimate)
    const memoryUsage = `${Math.round(total * avgSessionSize / 1024)} KB`;

    return { totalSessions: total, expiredSessions: expired, memoryUsage };
  }

  /**
   * Shutdown and cleanup
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.sessions.clear();
    logger.info('💾 Memory session storage destroyed');
  }
}