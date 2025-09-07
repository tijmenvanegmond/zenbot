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
    const action = this.get(actionName);
    if (!action) {
      throw new Error(`Action '${actionName}' not found`);
    }

    // Validate permissions
    if (action.permissions) {
      if (action.permissions.requiresVoiceChannel && !context.voiceChannel) {
        throw new Error(`Action '${actionName}' requires a voice channel`);
      }

      if (
        action.permissions.allowedSources &&
        !action.permissions.allowedSources.includes(context.source)
      ) {
        throw new Error(
          `Action '${actionName}' not allowed from source '${context.source}'`,
        );
      }
    }

    // Validate parameters
    if (action.validate && !action.validate(parameters)) {
      throw new Error(`Invalid parameters for action '${actionName}'`);
    }

    logger.info(`🎭 Executing action: ${actionName} from ${context.source}`);
    return await action.execute(context, parameters);
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
