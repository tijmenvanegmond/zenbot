import { ZenAction, ActionRegistry, ActionSchema } from "./actionTypes";
import { logger } from "../utils/logger";

/**
 * Central registry for all Zenbot actions
 */
export class ZenActionRegistry implements ActionRegistry {
  private static instance: ZenActionRegistry;
  private actions = new Map<string, ZenAction>();

  private constructor() {}

  static getInstance(): ZenActionRegistry {
    if (!this.instance) {
      this.instance = new ZenActionRegistry();
    }
    return this.instance;
  }

  /**
   * Register a new action
   */
  register(action: ZenAction): void {
    if (this.actions.has(action.name)) {
      logger.warn(`🎭 Action '${action.name}' is being overwritten`);
    }

    this.actions.set(action.name, action);
    logger.info(`🎭 Registered action: ${action.name} (${action.category})`);
  }

  /**
   * Unregister an action
   */
  unregister(name: string): void {
    if (this.actions.delete(name)) {
      logger.info(`🎭 Unregistered action: ${name}`);
    }
  }

  /**
   * Get a specific action
   */
  get(name: string): ZenAction | undefined {
    return this.actions.get(name);
  }

  /**
   * Get all registered actions
   */
  getAll(): ZenAction[] {
    return Array.from(this.actions.values());
  }

  /**
   * Get actions by category
   */
  getByCategory(category: string): ZenAction[] {
    return this.getAll().filter((action) => action.category === category);
  }

  /**
   * Get action schemas for AI function calling
   */
  getForAI(): ActionSchema[] {
    return this.getAll()
      .filter(
        (action) =>
          !action.permissions?.allowedSources ||
          action.permissions.allowedSources.includes("ai"),
      )
      .map((action) => action.schema);
  }

  /**
   * Get actions available for a specific source
   */
  getForSource(source: "command" | "voice" | "api" | "ai"): ZenAction[] {
    return this.getAll().filter(
      (action) =>
        !action.permissions?.allowedSources ||
        action.permissions.allowedSources.includes(source),
    );
  }

  /**
   * Execute an action by name
   */
  async execute(
    actionName: string,
    context: any,
    parameters: any,
  ): Promise<any> {
    logger.debug(
      `🎭 ActionRegistry.execute: Looking up action '${actionName}'`,
    );

    const action = this.get(actionName);
    if (!action) {
      logger.error(`🎭 Action '${actionName}' not found in registry`);
      throw new Error(`Action '${actionName}' not found`);
    }

    logger.debug(`🎭 Found action '${actionName}' (${action.category})`, {
      hasPermissions: !!action.permissions,
      hasValidation: !!action.validate,
      allowedSources: action.permissions?.allowedSources || "any",
      requiresVoice: !!action.permissions?.requiresVoiceChannel,
    });

    // Validate permissions
    if (action.permissions) {
      logger.debug(`🎭 Validating permissions for '${actionName}'`, {
        contextSource: context.source,
        hasVoiceChannel: !!context.voiceChannel,
        requiresVoice: !!action.permissions.requiresVoiceChannel,
      });

      if (action.permissions.requiresVoiceChannel && !context.voiceChannel) {
        logger.error(
          `🎭 Permission denied: ${actionName} requires voice channel`,
        );
        throw new Error(`Action '${actionName}' requires a voice channel`);
      }

      if (
        action.permissions.allowedSources &&
        !action.permissions.allowedSources.includes(context.source)
      ) {
        logger.error(
          `🎭 Permission denied: ${actionName} not allowed from ${context.source}`,
        );
        throw new Error(
          `Action '${actionName}' not allowed from source '${context.source}'`,
        );
      }
    }

    // Validate parameters
    if (action.validate) {
      logger.debug(`🎭 Validating parameters for '${actionName}'`, {
        parametersProvided: Object.keys(parameters),
      });

      if (!action.validate(parameters)) {
        logger.error(`🎭 Parameter validation failed for '${actionName}'`);
        throw new Error(`Invalid parameters for action '${actionName}'`);
      }
    }

    logger.debug(
      `🎭 All validations passed, executing action: ${actionName} from ${context.source}`,
    );

    const startTime = Date.now();
    try {
      const result = await action.execute(context, parameters);
      const executionTime = Date.now() - startTime;

      logger.debug(`🎭 Action '${actionName}' completed successfully`, {
        executionTimeMs: executionTime,
        resultSuccess: result?.success,
        hasError: !!result?.error,
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error(
        `🎭 Action '${actionName}' failed after ${executionTime}ms:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get action statistics
   */
  getStats(): {
    total: number;
    byCategory: Record<string, number>;
    aiEnabled: number;
  } {
    const all = this.getAll();
    const byCategory: Record<string, number> = {};

    all.forEach((action) => {
      byCategory[action.category] = (byCategory[action.category] || 0) + 1;
    });

    return {
      total: all.length,
      byCategory,
      aiEnabled: this.getForAI().length,
    };
  }
}
