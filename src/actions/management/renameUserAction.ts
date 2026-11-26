import {
  ZenAction,
  ActionContext,
  ActionParameters,
  ActionResult,
} from "../actionTypes";
import { GuildMember } from "discord.js";
import { logger } from "../../utils/logger";
import { findMemberByName } from "../../services/people";

/**
 * The AI knows people by name, not ID: "me", an ID, or any name they go by
 * (display name, nickname, username, or an alias like "nem"), checking the
 * requester's voice channel first.
 */
const resolveMember = async (
  context: ActionContext,
  who: string,
): Promise<GuildMember | null> => {
  const guild = context.interaction?.guild;
  if (!guild) return null;
  const target = who.trim().replace(/^@/, "");

  if (/^(me|myself)$/i.test(target)) {
    return guild.members.fetch(context.user.id).catch(() => null);
  }
  if (/^\d{15,20}$/.test(target)) {
    return guild.members.fetch(target).catch(() => null);
  }

  return findMemberByName(
    guild,
    target,
    context.voiceChannel?.members.values(),
  );
};

export class RenameUserAction implements ZenAction {
  name = "rename_user";
  description = "Change the nickname of a user in the server";
  category = "admin" as const;

  permissions = {
    requiresAdmin: true,
    allowedSources: ["command", "api", "ai"],
  };

  schema = {
    name: "rename_user",
    description: "Change the nickname of a user in the server",
    parameters: {
      type: "object" as const,
      properties: {
        user_id: {
          type: "string" as const,
          description:
            'Who to rename: their user ID, or their name as you see it (e.g. "Osha"). Use "me" for the person talking to you',
        },
        new_nickname: {
          type: "string" as const,
          description: "The new nickname for the user (max 32 characters)",
        },
      },
      required: ["user_id", "new_nickname"],
    },
  };

  async execute(
    context: ActionContext,
    parameters: ActionParameters,
  ): Promise<ActionResult> {
    try {
      const { user_id, new_nickname } = parameters;

      if (!context.guild || !context.interaction) {
        return {
          success: false,
          error: "This action requires a guild and interaction context",
          shouldRespond: true,
          responseText: "This command must be used within a server.",
        };
      }

      // Validate nickname length
      if (new_nickname && new_nickname.length > 32) {
        return {
          success: false,
          error: "Nickname too long",
          shouldRespond: true,
          responseText: "Nicknames must be 32 characters or less.",
        };
      }

      const member = await resolveMember(context, user_id);
      if (!member) {
        return {
          success: false,
          error: `User not found: ${user_id} - nobody was renamed`,
          shouldRespond: true,
          responseText: "Could not find that user in this server.",
        };
      }

      // Chat and /listen: one sentence shouldn't rename anyone in the server.
      // Only the person asking, or someone in the voice channel with them.
      if (context.source === "ai") {
        const inTheirVoice =
          !!context.voiceChannel &&
          member.voice?.channelId === context.voiceChannel.id;
        if (member.id !== context.user.id && !inTheirVoice) {
          return {
            success: false,
            error: `${member.displayName} is not the requester or in their voice channel - not renamed. Only they or people in voice with them can be renamed from chat`,
            shouldRespond: true,
            responseText: `I only rename you or people in voice with you, not ${member.displayName}.`,
          };
        }
      }

      const oldNickname = member.nickname || member.user.username;

      logger.info(
        `🎭 Rename action: Changing user ${oldNickname}'s nickname to "${new_nickname}"`,
      );

      try {
        await member.setNickname(new_nickname);

        const responseText = `Changed ${oldNickname}'s nickname to "${new_nickname}"`;

        logger.info(
          `🎭 Rename action: Successfully changed nickname for user ${user_id}`,
        );

        return {
          success: true,
          message: `Nickname changed successfully`,
          data: {
            userId: user_id,
            oldNickname,
            newNickname: new_nickname,
            username: member.user.username,
          },
          shouldRespond: true,
          responseText,
        };
      } catch (nicknameError) {
        logger.error(
          `🎭 Rename action: Failed to change nickname for user ${user_id}:`,
          nicknameError,
        );

        let errorMessage = "Failed to change nickname";
        if (nicknameError instanceof Error) {
          // Common Discord API errors
          if (nicknameError.message.includes("Missing Permissions")) {
            errorMessage =
              "I don't have permission to change that user's nickname.";
          } else if (nicknameError.message.includes("Hierarchy")) {
            errorMessage =
              "I cannot change the nickname of someone with a higher role than me.";
          } else {
            errorMessage = nicknameError.message;
          }
        }

        return {
          success: false,
          error: errorMessage,
          shouldRespond: true,
          responseText: `Failed to change ${oldNickname}'s nickname: ${errorMessage}`,
        };
      }
    } catch (error) {
      logger.error("🎭 Rename user action failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        shouldRespond: true,
        responseText: "An error occurred while trying to change the nickname.",
      };
    }
  }

  validate(parameters: ActionParameters): boolean {
    // Validate required parameters
    if (!parameters.user_id || typeof parameters.user_id !== "string") {
      return false;
    }

    if (
      !parameters.new_nickname ||
      typeof parameters.new_nickname !== "string"
    ) {
      return false;
    }

    // Validate nickname length
    if (parameters.new_nickname.length > 32) {
      return false;
    }

    return true;
  }
}
