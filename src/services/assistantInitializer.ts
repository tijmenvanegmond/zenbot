import { UnifiedZenyattaService } from "./unifiedZenyattaService";
import { AIServiceManager, MemorySessionStorage } from "./ai";
import { AI_CONFIG } from "../config/aiConfig";
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
      logger.info("🧘 Initializing Unified Zenyatta Service...");

      // Initialize AI service manager with multi-provider support
      const sessionStorage = new MemorySessionStorage();
      const aiManager = new AIServiceManager(AI_CONFIG, sessionStorage);

      // Initialize the unified Zenyatta service
      UnifiedZenyattaService.initialize(aiManager);
      const zenyatta = UnifiedZenyattaService.getInstance();

      logger.info("🧘 Unified Zenyatta Service ready for enlightened conversations");

      // Log AI system stats
      const stats = await aiManager.getStats();
      logger.info(
        `AI System stats: ${stats.providers.length} providers (${stats.providers.join(", ")}), ${stats.activeSessions} sessions, ${stats.totalMessages} messages`,
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
    logger.info("🧘 AI session cleanup is handled automatically by the service manager");
  }
}
