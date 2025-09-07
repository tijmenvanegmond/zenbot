import { ZenyattaAssistantService } from "./zenyattaAssistantService";
import { logger } from "../utils/logger";

/**
 * Service to initialize OpenAI Assistant on bot startup
 */
export class AssistantInitializer {
  /**
   * Initialize all AI assistants
   */
  static async initializeAssistants(): Promise<void> {
    try {
      logger.info("🧘 Initializing Zenyatta Assistant...");

      const zenyatta = ZenyattaAssistantService.getInstance();
      await zenyatta.initialize();

      logger.info("🧘 Zenyatta Assistant ready for enlightened conversations");

      // Log assistant stats
      const stats = zenyatta.getStats();
      logger.info(
        `Assistant stats: ${stats.activeThreads} active threads, ID: ${stats.assistantId}`,
      );
    } catch (error) {
      logger.error("Failed to initialize AI assistants:", error);
      logger.warn("Bot will continue without AI assistant functionality");
    }
  }

  /**
   * Setup periodic cleanup (optional)
   */
  static setupCleanup(): void {
    // Clean up every 30 minutes
    setInterval(
      async () => {
        try {
          const zenyatta = ZenyattaAssistantService.getInstance();
          await zenyatta.cleanupOldThreads();
        } catch (error) {
          logger.error("Assistant cleanup failed:", error);
        }
      },
      30 * 60 * 1000,
    );
  }
}
