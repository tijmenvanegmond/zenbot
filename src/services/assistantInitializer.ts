import { ZenbotService } from "./zenbotService";
import { logger } from "../utils/logger";

/**
 * Service to initialize unified AI system on bot startup
 */
export class AssistantInitializer {
  /**
   * Initialize all AI assistants with the unified system
   */
  static async initializeAssistants(): Promise<void> {
    try {
      // ZenbotService is initialized in app.ts (with or without AI)
      const zenyatta = ZenbotService.getInstance();

      if (!zenyatta.isAIEnabled()) {
        logger.info("🧘 Zenbot running without AI - curated responses only");
        return;
      }

      const stats = await zenyatta.getStats();
      logger.info(
        `🧘 Zenbot AI ready: provider ${stats.aiProvider}, ${stats.activeSessions} sessions, ${stats.totalMessages} messages`,
      );
    } catch (error) {
      logger.error("Failed to initialize AI system:", error);
      logger.warn("Bot will continue without AI assistant functionality");
    }
  }

  /**
   * Setup periodic cleanup for AI sessions
   */
  static setupCleanup(): void {
    // AI service manager handles its own cleanup automatically
    // No additional cleanup needed for the unified system
    logger.info(
      "🧘 AI session cleanup is handled automatically by the service manager",
    );
  }
}
