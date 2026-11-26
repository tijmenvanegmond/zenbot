import { CommandInteraction, VoiceChannel } from "discord.js";

/**
 * Context available to all actions
 */
export interface ActionContext {
  // Discord context
  interaction?: CommandInteraction;
  guild?: {
    id: string;
    name: string;
  };
  user: {
    id: string;
    username: string;
    displayName?: string;
  };
  voiceChannel?: VoiceChannel;

  // Session context
  isVoiceInteraction: boolean;
  sessionId?: string;

  // Source of the action
  source: "command" | "voice" | "api" | "ai";
}

/**
 * Parameters that can be passed to actions
 */
export interface ActionParameters {
  [key: string]: any;
}

/**
 * Result returned by actions
 */
export interface ActionResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;

  // Response handling
  shouldRespond: boolean;
  responseText?: string;
  useVoice?: boolean;
}

/**
 * Schema for action parameters (for AI function calling)
 */
export interface ActionSchema {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: {
      [key: string]: {
        type: "string" | "number" | "boolean" | "array" | "object";
        description: string;
        enum?: string[];
        required?: boolean;
      };
    };
    required: string[];
  };
}

/**
 * Base action interface
 */
export interface ZenAction {
  // Action metadata
  name: string;
  description: string;
  category:
    | "voice"
    | "information"
    | "utility"
    | "entertainment"
    | "admin"
    | "ai";

  // Permission requirements
  permissions?: {
    requiresVoiceChannel?: boolean;
    requiresAdmin?: boolean;
    allowedSources?: any;
  };

  // Schema for AI function calling
  schema: ActionSchema;

  // Execute the action
  execute(
    context: ActionContext,
    parameters: ActionParameters,
  ): Promise<ActionResult>;

  // Validate parameters (optional)
  validate?(parameters: ActionParameters): boolean;
}

/**
 * Action registry for managing all available actions
 */
export interface ActionRegistry {
  register(action: ZenAction): void;
  unregister(name: string): void;
  get(name: string): ZenAction | undefined;
  getAll(): ZenAction[];
  getByCategory(category: string): ZenAction[];
  getForAI(): ActionSchema[];
}
