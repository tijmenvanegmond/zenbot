import {
  ZenAction,
  ActionContext,
  ActionParameters,
  ActionResult,
} from "../actionTypes";
import { GuildMember } from "discord.js";
import { logger } from "../../utils/logger";

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
          description: "The ID of the user whose nickname to change",
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

      // Get the guild member
      const guild = context.interaction.guild!;
      let member: GuildMember;

      try {
        member = await guild.members.fetch(user_id);
      } catch (fetchError) {
        return {
          success: false,
          error: `User not found: ${user_id}`,
          shouldRespond: true,
          responseText: "Could not find that user in this server.",
        };
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
