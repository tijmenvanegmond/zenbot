import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Client } from "discord.js";
import { ActionService } from "../../services/actionService";
import { ZenActionRegistry } from "../../actions/actionRegistry";
import { logger } from "../../utils/logger";

interface ActionExecuteBody {
  guildId: string;
  channelId?: string;
  userId?: string;
  parameters?: Record<string, any>;
}

interface ActionExecuteParams {
  actionName: string;
}

/**
 * Actions API Routes - Direct access to Zenbot's unified action system
 */
export default async function actionsRoutes(
  fastify: FastifyInstance,
  options: { discordClient: Client },
) {
  const { discordClient } = options;
  const actionService = ActionService.getInstance();
  const actionRegistry = ZenActionRegistry.getInstance();

  // ===== ACTION DISCOVERY =====

  /**
   * GET /actions - List all available actions with metadata
   */
  fastify.get(
    "/actions",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const stats = actionRegistry.getStats();
        const allActions = actionRegistry.getAll();

        const actions = allActions.map((action) => ({
          name: action.name,
          description: action.description,
          category: action.category,
          allowedSources: action.permissions?.allowedSources || [
            "command",
            "voice",
            "api",
            "ai",
          ],
          requiresVoiceChannel:
            action.permissions?.requiresVoiceChannel || false,
          schema: action.schema,
          aiEnabled:
            !action.permissions?.allowedSources ||
            action.permissions.allowedSources.includes("ai"),
        }));

        return {
          success: true,
          data: {
            actions,
            stats: {
              total: stats.total,
              byCategory: stats.byCategory,
              aiEnabled: stats.aiEnabled,
            },
          },
          wisdom: "Actions are the path to digital enlightenment",
        };
      } catch (error) {
        logger.error("Failed to fetch actions:", error);
        return reply.code(500).send({
          success: false,
          error: "Failed to fetch actions",
          wisdom: "Even the Iris experiences occasional turbulence",
        });
      }
    },
  );

  /**
   * GET /actions/categories - Get actions grouped by category
   */
  fastify.get(
    "/actions/categories",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const allActions = actionRegistry.getAll();
        const categories: Record<string, any[]> = {};

        allActions.forEach((action) => {
          if (!categories[action.category]) {
            categories[action.category] = [];
          }
          categories[action.category].push({
            name: action.name,
            description: action.description,
            allowedSources: action.permissions?.allowedSources || [
              "command",
              "voice",
              "api",
              "ai",
            ],
            schema: action.schema,
          });
        });

        return {
          success: true,
          data: { categories },
          wisdom: "Order brings clarity to chaos",
        };
      } catch (error) {
        logger.error("Failed to fetch action categories:", error);
        return reply.code(500).send({
          success: false,
          error: "Failed to fetch action categories",
        });
      }
    },
  );

  /**
   * GET /actions/:actionName - Get detailed information about a specific action
   */
  fastify.get<{ Params: { actionName: string } }>(
    "/actions/:actionName",
    async (request, reply) => {
      try {
        const { actionName } = request.params;
        const action = actionRegistry.get(actionName);

        if (!action) {
          return reply.code(404).send({
            success: false,
            error: `Action '${actionName}' not found`,
            wisdom: "Seek what exists, not what you wish existed",
          });
        }

        return {
          success: true,
          data: {
            name: action.name,
            description: action.description,
            category: action.category,
            permissions: action.permissions || {
              allowedSources: ["command", "voice", "api", "ai"],
              requiresVoiceChannel: false,
            },
            schema: action.schema,
          },
          wisdom: "Understanding precedes action",
        };
      } catch (error) {
        logger.error(
          `Failed to fetch action details for ${request.params.actionName}:`,
          error,
        );
        return reply.code(500).send({
          success: false,
          error: "Failed to fetch action details",
        });
      }
    },
  );

  /**
   * GET /actions/ai - Get actions available for AI function calling
   */
  fastify.get(
    "/actions/ai",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const aiActions = actionRegistry.getForAI();

        return {
          success: true,
          data: {
            schemas: aiActions,
            count: aiActions.length,
          },
          wisdom: "The digital mind expands through available actions",
        };
      } catch (error) {
        logger.error("Failed to fetch AI actions:", error);
        return reply.code(500).send({
          success: false,
          error: "Failed to fetch AI-enabled actions",
        });
      }
    },
  );

  // ===== ACTION EXECUTION =====

  /**
   * POST /actions/:actionName/execute - Execute a specific action
   */
  fastify.post<{
    Params: ActionExecuteParams;
    Body: ActionExecuteBody;
  }>(
    "/actions/:actionName/execute",
    {
      schema: {
        params: {
          type: "object",
          properties: {
            actionName: { type: "string" },
          },
          required: ["actionName"],
        },
        body: {
          type: "object",
          properties: {
            guildId: { type: "string" },
            channelId: { type: "string" },
            userId: { type: "string" },
            parameters: { type: "object" },
          },
          required: ["guildId"],
        },
      },
    },
    async (request, reply) => {
      try {
        const { actionName } = request.params;
        const { guildId, channelId, userId, parameters = {} } = request.body;

        logger.info(`🎭 API action execution request: ${actionName}`, {
          guildId,
          channelId,
          userId,
          parametersProvided: Object.keys(parameters),
        });

        // Validate action exists
        const action = actionRegistry.get(actionName);
        if (!action) {
          return reply.code(404).send({
            success: false,
            error: `Action '${actionName}' not found`,
            wisdom: "Cannot execute what does not exist",
          });
        }

        // Check if action allows API source
        if (
          action.permissions?.allowedSources &&
          !action.permissions.allowedSources.includes("api")
        ) {
          return reply.code(403).send({
            success: false,
            error: `Action '${actionName}' is not available via API`,
            wisdom: "Not all paths are open to all travelers",
          });
        }

        // Get guild
        const guild = discordClient.guilds.cache.get(guildId);
        if (!guild) {
          return reply.code(404).send({
            success: false,
            error: `Guild ${guildId} not found`,
            wisdom: "The bot must be present in the guild to act",
          });
        }

        // Get channel if specified
        let channel = null;
        if (channelId) {
          channel = guild.channels.cache.get(channelId);
          if (!channel) {
            return reply.code(404).send({
              success: false,
              error: `Channel ${channelId} not found in guild`,
              wisdom: "Seek channels that exist within the realm",
            });
          }
        }

        // Get user if specified
        let user = null;
        if (userId) {
          try {
            user = await discordClient.users.fetch(userId);
          } catch (error) {
            return reply.code(404).send({
              success: false,
              error: `User ${userId} not found`,
              wisdom: "The user must be known to Discord",
            });
          }
        }

        // Execute action using ActionService API execution method
        const result = await actionService.executeFromAPI(
          {
            guild,
            channel,
            user: user || {
              id: "api-user",
              username: "api",
              displayName: "API User",
            },
          },
          actionName,
          parameters,
        );

        logger.info(`🎭 API action ${actionName} completed`, {
          success: result.success,
          hasError: !!result.error,
          responseLength: result.responseText?.length || 0,
        });

        return {
          success: result.success,
          data: result.data,
          message: result.message,
          responseText: result.responseText,
          error: result.error,
          wisdom: result.success
            ? "Action flows like water, purposeful and clear"
            : "Even failure teaches wisdom",
        };
      } catch (error) {
        logger.error(
          `🎭 API action execution failed for ${request.params.actionName}:`,
          error,
        );

        return reply.code(500).send({
          success: false,
          error:
            error instanceof Error ? error.message : "Unknown error occurred",
          wisdom: "The path of action sometimes leads through obstacles",
        });
      }
    },
  );

  // ===== ACTION VALIDATION =====

  /**
   * POST /actions/:actionName/validate - Validate parameters for an action without executing
   */
  fastify.post<{
    Params: ActionExecuteParams;
    Body: { parameters: Record<string, any> };
  }>(
    "/actions/:actionName/validate",
    {
      schema: {
        params: {
          type: "object",
          properties: {
            actionName: { type: "string" },
          },
          required: ["actionName"],
        },
        body: {
          type: "object",
          properties: {
            parameters: { type: "object" },
          },
          required: ["parameters"],
        },
      },
    },
    async (request, reply) => {
      try {
        const { actionName } = request.params;
        const { parameters } = request.body;

        const action = actionRegistry.get(actionName);
        if (!action) {
          return reply.code(404).send({
            success: false,
            error: `Action '${actionName}' not found`,
          });
        }

        let isValid = true;
        let validationError = null;

        if (action.validate) {
          try {
            isValid = action.validate(parameters);
          } catch (error) {
            isValid = false;
            validationError =
              error instanceof Error ? error.message : "Validation failed";
          }
        }

        return {
          success: true,
          data: {
            actionName,
            parametersValid: isValid,
            validationError,
            schema: action.schema,
          },
          wisdom: isValid
            ? "Parameters align with expectations"
            : "Refinement brings clarity",
        };
      } catch (error) {
        logger.error(
          `Failed to validate parameters for ${request.params.actionName}:`,
          error,
        );
        return reply.code(500).send({
          success: false,
          error: "Parameter validation failed",
        });
      }
    },
  );

  // ===== CONFERENCE SHORTCUT =====

  /**
   * POST /conference - Convenience endpoint for conferences
   */
  fastify.post<{
    Body: {
      guildId: string;
      question: string;
      requireConsensus?: boolean;
      debateRounds?: number;
      maxProviders?: number;
      providerFilter?: "all" | "reasoning" | "creative" | "fast";
      userId?: string;
    };
  }>(
    "/conference",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            guildId: { type: "string" },
            question: { type: "string" },
            requireConsensus: { type: "boolean" },
            debateRounds: { type: "number", minimum: 1, maximum: 5 },
            maxProviders: { type: "number", minimum: 1, maximum: 3 },
            providerFilter: {
              type: "string",
              enum: ["all", "reasoning", "creative", "fast"],
            },
            userId: { type: "string" },
          },
          required: ["guildId", "question"],
        },
      },
    },
    async (request, reply) => {
      try {
        const {
          guildId,
          question,
          requireConsensus = false,
          debateRounds = 2,
          maxProviders = 3,
          providerFilter = "all",
          userId,
        } = request.body;

        logger.info(
          `🧠 Conference API request: "${question.substring(0, 100)}..."`,
        );

        // Execute via the generic action execution method
        const result = await actionService.executeFromAPI(
          {
            guild: discordClient.guilds.cache.get(guildId),
            channel: null,
            user: userId
              ? await discordClient.users.fetch(userId).catch(() => ({
                  id: "api-user",
                  username: "api",
                  displayName: "API User",
                }))
              : { id: "api-user", username: "api", displayName: "API User" },
          },
          "conference",
          {
            question,
            require_consensus: requireConsensus,
            debate_rounds: debateRounds,
            max_providers: maxProviders,
            provider_filter: providerFilter,
          },
        );

        if (!result.success) {
          return reply.code(400).send({
            success: false,
            error: result.error,
            wisdom: "The conference could not be convened",
          });
        }

        return {
          success: true,
          data: {
            question,
            response: result.data?.response || result.responseText,
            providers: result.data?.providers || [],
            consensusLevel: result.data?.consensusLevel || 0,
            conferenceLevel: result.data?.conferenceLevel || "individual",
            reasoning: result.data?.reasoning || "Single provider response",
            synthesisTime: result.data?.synthesisTime || 0,
            totalDuration: result.data?.totalDuration || 0,
            conference: {
              requireConsensus,
              debateRounds,
              maxProviders,
              providerFilter,
            },
          },
          wisdom:
            result.data?.providers?.length > 1
              ? "When digital minds unite, wisdom multiplies"
              : "Even individual consciousness carries profound insight",
        };
      } catch (error) {
        logger.error("🧠 Conference API failed:", error);
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          wisdom: "The digital minds are temporarily in discord",
        });
      }
    },
  );

  logger.info(
    "🎭 Actions API routes registered - the path to programmatic enlightenment is open",
  );
}
