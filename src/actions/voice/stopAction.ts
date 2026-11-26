import {
  ZenAction,
  ActionContext,
  ActionParameters,
  ActionResult,
} from "../actionTypes";
import { VoiceSessionManager } from "../../services/voiceSessionManager";
import { logger } from "../../utils/logger";

export class StopAction implements ZenAction {
  name = "stop_all";
  description = "Stop all bot activities and leave voice channel immediately";
  category = "voice" as const;

  permissions = {
    allowedSources: ["command", "voice", "api", "ai"],
  };

  schema = {
    name: "stop_all",
    description:
      "Stop all bot activities (TTS, listening, etc.) and leave voice channel immediately with no response",
    parameters: {
      type: "object" as const,
      properties: {
        reason: {
          type: "string" as const,
          description: "Optional reason for stopping",
        },
        silent: {
          type: "boolean" as const,
          description:
            "If true, leave silently without any response (default: true)",
        },
      },
      required: [],
    },
  };

  async execute(
    context: ActionContext,
    parameters: ActionParameters,
  ): Promise<ActionResult> {
    try {
      const { reason, silent = true } = parameters;

      if (!context.guild) {
        return {
          success: false,
          error: "Guild context is required",
          shouldRespond: false,
        };
      }

      const sessionManager = VoiceSessionManager.getInstance();
      const session = sessionManager.getSession(context.guild.id);

      if (session) {
        logger.info(
          `🎭 STOP ALL requested: Ending all activities and leaving voice channel${reason ? ` (${reason})` : ""}`,
        );

        // Force leave - this will stop all activities and clean up everything
        await sessionManager.forceLeave(context.guild.id);

        if (silent) {
          return {
            success: true,
            message: "All activities stopped and left voice channel",
            shouldRespond: false, // No response to prevent rejoin
            data: {
              stopped: true,
              reason,
              activities_ended: Array.from(session.activeActivities),
            },
          };
        } else {
          return {
            success: true,
            message: "All activities stopped and left voice channel",
            shouldRespond: true,
            responseText: reason
              ? `I have stopped all activities and left the voice channel. ${reason}`
              : "I have stopped all activities and left the voice channel.",
            data: {
              stopped: true,
              reason,
              activities_ended: Array.from(session.activeActivities),
            },
          };
        }
      } else {
        return {
          success: true,
          message: "No active voice session to stop",
          shouldRespond: false,
          data: { stopped: false, reason: "No active session" },
        };
      }
    } catch (error) {
      logger.error("🎭 Stop action failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        shouldRespond: false, // Don't respond on error to avoid rejoining
      };
    }
  }

  validate(parameters: ActionParameters): boolean {
    // No required parameters, all are optional
    return true;
  }
}
