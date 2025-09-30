import { CommandInteraction, VoiceChannel } from "discord.js";
import { ZenActionRegistry } from "../actions/actionRegistry";
import { ActionContext, ActionResult } from "../actions/actionTypes";
import { logger } from "../utils/logger";
import { validateVoiceChannel } from "../utils/commandHelpers";

// Import core actions
import { PlayTtsAction } from "../actions/voice/playTtsAction";
import { VoiceChannelAction } from "../actions/voice/voiceChannelAction";
import { ListenControlAction } from "../actions/voice/listenControlAction";
import { EnhancedTtsAction } from "../actions/voice/enhancedTtsAction";
import { AdviceAction } from "../actions/information/adviceAction";
import { StopAction } from "../actions/voice/stopAction";
import { ChannelManagementAction } from "../actions/management/channelManagementAction";
import { ChannelQuoteAction } from "../actions/information/channelQuoteAction";
import { RenameUserAction } from "../actions/management/renameUserAction";
import { RemarkAction } from "../actions/entertainment/remarkAction";
import { ConferenceAction } from "../actions/ai/conferenceAction";

/**
 * Service for executing actions from various sources
 */
export class ActionService {
  private static instance: ActionService;
  private registry: ZenActionRegistry;

  private constructor() {
    this.registry = ZenActionRegistry.getInstance();
    this.registerCoreActions();
  }

  static getInstance(): ActionService {
    if (!this.instance) {
      this.instance = new ActionService();
    }
    return this.instance;
  }

  /**
   * Register all core actions
   */
  private registerCoreActions(): void {
    // Voice actions
    this.registry.register(new PlayTtsAction());
    this.registry.register(new VoiceChannelAction());
    this.registry.register(new ListenControlAction());
    this.registry.register(new EnhancedTtsAction());
    this.registry.register(new StopAction());

    // Information actions
    this.registry.register(new AdviceAction());
    this.registry.register(new ChannelQuoteAction());

    // Management actions
    this.registry.register(new ChannelManagementAction());
    this.registry.register(new RenameUserAction());

    // Entertainment actions
    this.registry.register(new RemarkAction());

    // AI actions
    this.registry.register(new ConferenceAction());

    logger.info(`🎭 Registered ${this.registry.getStats().total} core actions`);
  }

  /**
   * Execute action from Discord command interaction
   */
  async executeFromCommand(
    interaction: CommandInteraction,
    actionName: string,
    parameters: any = {},
  ): Promise<ActionResult> {
    logger.debug(`🎭 ActionService.executeFromCommand: ${actionName}`, {
      user: interaction.user.username,
      guild: interaction.guild?.name || "DM",
      parameters: Object.keys(parameters),
      source: "command",
    });

    const context = this.createContextFromInteraction(interaction, "command");

    logger.debug(`🎭 Created command context:`, {
      hasGuild: !!context.guild,
      hasVoiceChannel: !!context.voiceChannel,
      userId: context.user.id,
      source: context.source,
    });

    const result = await this.registry.execute(actionName, context, parameters);

    logger.debug(`🎭 Action execution result:`, {
      action: actionName,
      success: result.success,
      hasResponseText: !!result.responseText,
      shouldRespond: result.shouldRespond,
      useVoice: result.useVoice,
    });

    return result;
  }

  /**
   * Execute action from voice interaction
   */
  async executeFromVoice(
    userId: string,
    guildId: string,
    voiceChannel: VoiceChannel,
    actionName: string,
    parameters: any = {},
  ): Promise<ActionResult> {
    const context: ActionContext = {
      guild: {
        id: guildId,
        name: voiceChannel.guild.name,
      },
      user: {
        id: userId,
        username: `VoiceUser_${userId.slice(-4)}`,
      },
      voiceChannel,
      isVoiceInteraction: true,
      source: "voice",
    };

    return await this.registry.execute(actionName, context, parameters);
  }

  /**
   * Execute action from AI assistant
   */
  async executeFromAI(
    interaction: CommandInteraction,
    actionName: string,
    parameters: any = {},
  ): Promise<ActionResult> {
    logger.debug(`🎭 ActionService.executeFromAI: ${actionName}`, {
      user: interaction.user.username,
      parameters: Object.keys(parameters),
      source: "ai",
    });

    const context = this.createContextFromInteraction(interaction, "ai");
    return await this.registry.execute(actionName, context, parameters);
  }

  /**
   * Execute action from API request
   */
  async executeFromAPI(
    apiContext: {
      guild: any;
      channel?: any;
      user: {
        id: string;
        username: string;
        displayName?: string;
      };
    },
    actionName: string,
    parameters: any = {},
  ): Promise<ActionResult> {
    logger.debug(`🎭 ActionService.executeFromAPI: ${actionName}`, {
      guild: apiContext.guild?.name,
      user: apiContext.user.username,
      parameters: Object.keys(parameters),
      source: "api",
    });

    // Create a mock interaction for API calls that need guild access
    const mockInteraction = apiContext.guild
      ? {
          guild: apiContext.guild,
          user: apiContext.user,
          client: apiContext.guild.client,
        }
      : undefined;

    const context: ActionContext = {
      interaction: mockInteraction as any,
      guild: apiContext.guild
        ? {
            id: apiContext.guild.id,
            name: apiContext.guild.name,
          }
        : undefined,
      user: {
        id: apiContext.user.id,
        username: apiContext.user.username,
        displayName: apiContext.user.displayName,
      },
      voiceChannel: apiContext.channel?.isVoiceBased?.()
        ? apiContext.channel
        : undefined,
      isVoiceInteraction: apiContext.channel?.isVoiceBased?.() || false,
      source: "api",
    };

    return await this.registry.execute(actionName, context, parameters);
  }

  /**
   * Get function schemas for OpenAI function calling
   */
  getFunctionSchemas(excludeFunctions: string[] = []): any[] {
    return this.registry
      .getForAI()
      .filter((schema) => !excludeFunctions.includes(schema.name))
      .map((schema) => ({
        type: "function",
        function: {
          name: schema.name,
          description: schema.description,
          parameters: schema.parameters,
        },
      }));
  }

  /**
   * Get raw function definitions compatible with AI provider function calling
   */
  getFunctionDefinitions(excludeFunctions: string[] = []) {
    return this.registry
      .getForAI()
      .filter((schema) => !excludeFunctions.includes(schema.name))
      .map((schema) => ({
        name: schema.name,
        description: schema.description,
        parameters: schema.parameters,
      }));
  }

  /**
   * Create action context from Discord interaction
   */
  private createContextFromInteraction(
    interaction: CommandInteraction,
    source: "command" | "ai",
  ): ActionContext {
    const voiceValidation = validateVoiceChannel(interaction);

    const context: ActionContext = {
      interaction,
      guild: interaction.guild
        ? {
            id: interaction.guild.id,
            name: interaction.guild.name,
          }
        : undefined,
      user: {
        id: interaction.user.id,
        username: interaction.user.username,
        displayName:
          (interaction.member as any)?.displayName ||
          interaction.user.displayName,
      },
      voiceChannel: voiceValidation.isValid
        ? (voiceValidation.member!.voice.channel as VoiceChannel)
        : undefined,
      isVoiceInteraction: voiceValidation.isValid,
      source,
    };

    // Enhanced logging for voice context debugging
    logger.debug(`🎭 Created context from interaction:`, {
      source,
      hasVoiceChannel: !!context.voiceChannel,
      voiceChannelId: context.voiceChannel?.id,
      voiceChannelName: context.voiceChannel?.name,
      userId: context.user.id,
      username: context.user.username,
    });

    return context;
  }

  /**
   * Get action registry for direct access
   */
  getRegistry(): ZenActionRegistry {
    return this.registry;
  }

  /**
   * Process AI function call results
   */
  async processAIFunctionCall(
    interaction: CommandInteraction,
    functionName: string,
    functionArgs: any,
  ): Promise<ActionResult> {
    try {
      logger.info(
        `🎭 AI function call: ${functionName} with args:`,
        functionArgs,
      );

      // Enhanced logging for voice context debugging
      const voiceValidation = validateVoiceChannel(interaction);
      logger.debug(`🎭 AI function call context:`, {
        functionName,
        hasVoiceChannel: voiceValidation.isValid,
        voiceChannelId: voiceValidation.member?.voice?.channelId,
        voiceChannelName: voiceValidation.member?.voice?.channel?.name,
        userId: interaction.user.id,
        guildId: interaction.guild?.id,
      });

      const result = await this.executeFromAI(
        interaction,
        functionName,
        functionArgs,
      );

      // Handle TTS responses for AI actions
      if (result.success && result.useVoice && result.responseText) {
        const context = this.createContextFromInteraction(interaction, "ai");
        if (context.voiceChannel) {
          await this.registry.execute("play_tts", context, {
            text: result.responseText,
            activity_type: "ai-response",
          });
        }
      }

      return result;
    } catch (error) {
      logger.error(`🎭 AI function call failed: ${functionName}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        shouldRespond: true,
        responseText:
          "I encountered an issue executing that action. Please try again.",
      };
    }
  }

  /**
   * Get action statistics
   */
  getStats() {
    return this.registry.getStats();
  }
}
