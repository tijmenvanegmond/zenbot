import {
  ZenAction,
  ActionContext,
  ActionParameters,
  ActionResult,
} from "../actionTypes";
import { VoiceChannel } from "discord.js";
import { VoiceSessionManager } from "../../services/voiceSessionManager";
import { logger } from "../../utils/logger";

export class VoiceChannelAction implements ZenAction {
  name = "voice_channel_control";
  description = "Control voice channel operations (join, leave, status)";
  category = "voice" as const;

  permissions = {
    allowedSources: ["command", "voice", "api", "ai"],
  };

  schema = {
    name: "voice_channel_control",
    description:
      "Control voice channel operations like joining, leaving, or checking status",
    parameters: {
      type: "object" as const,
      properties: {
        action: {
          type: "string" as const,
          description: "The voice channel action to perform",
          enum: ["join", "leave", "status", "force_leave"],
        },
        reason: {
          type: "string" as const,
          description: "Optional reason for the action",
        },
      },
      required: ["action"],
    },
  };

  async execute(
    context: ActionContext,
    parameters: ActionParameters,
  ): Promise<ActionResult> {
    try {
      const { action, reason } = parameters;
      const sessionManager = VoiceSessionManager.getInstance();

      if (!context.guild) {
        return {
          success: false,
          error: "Guild context is required",
          shouldRespond: true,
          responseText: "I need to know which server you're referring to",
        };
      }

      switch (action) {
        case "status": {
          const session = sessionManager.getSession(context.guild.id);
          if (session) {
            const activities = Array.from(session.activeActivities);
            return {
              success: true,
              message: `Voice session active`,
              data: {
                channelId: session.channelId,
                activities,
                activeTime: Date.now() - session.createdAt.getTime(),
              },
              shouldRespond: true,
              responseText: `I am currently in a voice channel with activities: ${activities.join(", ")}`,
            };
          } else {
            return {
              success: true,
              message: "No active voice session",
              shouldRespond: true,
              responseText: "I am not currently in any voice channel",
            };
          }
        }

        case "leave":
        case "force_leave": {
          const session = sessionManager.getSession(context.guild.id);
          if (session) {
            logger.info(
              `🎭 ${action} requested by ${context.source}: ${reason || "no reason"}`,
            );
            await sessionManager.forceLeave(context.guild.id);
            return {
              success: true,
              message: "Left voice channel",
              shouldRespond: true,
              responseText: reason
                ? `I have left the voice channel. ${reason}`
                : "I have left the voice channel as requested",
            };
          } else {
            return {
              success: false,
              message: "Not in voice channel",
              shouldRespond: true,
              responseText: "I am not currently in a voice channel",
            };
          }
        }

        case "join": {
          // If user is already in voice channel context, we're good
          if (context.voiceChannel) {
            return {
              success: true,
              message: "Already have voice channel access",
              shouldRespond: true,
              responseText: `I can access ${context.voiceChannel.name}.`,
            };
          }

          // Try to find user's current voice channel
          const member = context.interaction?.guild?.members.cache.get(
            context.user.id,
          );
          if (
            !member?.voice.channel ||
            !member.voice.channel.isVoiceBased() ||
            !("speakable" in member.voice.channel)
          ) {
            return {
              success: false,
              error: "User not in voice channel",
              shouldRespond: true,
              responseText:
                "You need to join a voice channel first, then I can join you.",
            };
          }

          // Update context with found voice channel for subsequent actions
          const userVoiceChannel = member.voice.channel as VoiceChannel;
          logger.info(
            `🎭 Found user ${context.user.username} in voice channel: ${userVoiceChannel.name}`,
          );

          return {
            success: true,
            message: `Found voice channel: ${userVoiceChannel.name}`,
            data: {
              channelId: userVoiceChannel.id,
              channelName: userVoiceChannel.name,
              memberCount: userVoiceChannel.members.size,
            },
            shouldRespond: true,
            responseText: `Found you in ${userVoiceChannel.name}. Ready to speak!`,
          };
        }

        default:
          return {
            success: false,
            error: `Unknown action: ${action}`,
            shouldRespond: true,
            responseText: `I don't understand the action "${action}". Available actions are: join, leave, status.`,
          };
      }
    } catch (error) {
      logger.error("🎭 Voice channel action failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        shouldRespond: true,
        responseText:
          "I encountered an issue with voice channel control. Please try again.",
      };
    }
  }

  validate(parameters: ActionParameters): boolean {
    const validActions = ["join", "leave", "status", "force_leave"];
    return (
      typeof parameters.action === "string" &&
      validActions.includes(parameters.action)
    );
  }
}
