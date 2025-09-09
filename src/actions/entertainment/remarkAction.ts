import {
  ZenAction,
  ActionContext,
  ActionParameters,
  ActionResult,
} from "../actionTypes";
import { UnifiedZenyattaService } from "../../services/unifiedZenyattaService";
import { playTTSInChannel } from "../../utils/voiceHelpers";
import { logger } from "../../utils/logger";

export class RemarkAction implements ZenAction {
  name = "generate_remark";
  description = "Generate a positive or negative remark about someone";
  category = "entertainment" as const;

  permissions = {
    allowedSources: ["command", "api", "ai"],
  };

  schema = {
    name: "generate_remark",
    description:
      "Generate a positive or negative remark about someone, with optional TTS playback",
    parameters: {
      type: "object" as const,
      properties: {
        type: {
          type: "string" as const,
          description: "Type of remark to generate",
          enum: ["positive", "negative"],
        },
        subject_username: {
          type: "string" as const,
          description: "Username of the person the remark is about (optional)",
        },
        subject_user_id: {
          type: "string" as const,
          description: "User ID of the person the remark is about (optional)",
        },
        use_voice: {
          type: "boolean" as const,
          description:
            "Whether to play the remark as TTS if user is in voice channel",
        },
      },
      required: ["type"],
    },
  };

  async execute(
    context: ActionContext,
    parameters: ActionParameters,
  ): Promise<ActionResult> {
    try {
      const {
        type,
        subject_username,
        subject_user_id,
        use_voice = true,
      } = parameters;

      // Validate remark type
      if (!["positive", "negative"].includes(type)) {
        return {
          success: false,
          error: "Invalid remark type",
          shouldRespond: true,
          responseText: 'Remark type must be either "positive" or "negative".',
        };
      }

      // Determine subject name
      let subjectName = subject_username;

      // If user_id provided but no username, try to get username from context
      if (subject_user_id && !subjectName && context.interaction) {
        try {
          const user =
            await context.interaction.client.users.fetch(subject_user_id);
          subjectName = user.username;
        } catch (error) {
          logger.warn(
            `🎭 Could not fetch user ${subject_user_id} for remark:`,
            error,
          );
        }
      }

      // Generate remark using unified Zenyatta service
      let remarkText: string;
      try {
        if (!context.interaction) {
          throw new Error("Interaction context required for unified remark generation");
        }

        const zenyatta = UnifiedZenyattaService.getInstance();
        const isPositive = type === "positive";
        const result = await zenyatta.generateRemark(context.interaction, subjectName, isPositive);
        remarkText = result.text;
      } catch (remarkError) {
        logger.error(`🎭 Failed to generate ${type} remark:`, remarkError);
        return {
          success: false,
          error: "Failed to generate remark",
          shouldRespond: true,
          responseText:
            "I encountered difficulty generating that remark. Please try again.",
        };
      }

      // Determine if we should use voice
      const shouldUseVoice =
        use_voice && context.isVoiceInteraction && context.voiceChannel;

      // Play TTS if appropriate
      if (shouldUseVoice) {
        try {
          await playTTSInChannel(context.voiceChannel!, remarkText);
        } catch (voiceError) {
          logger.error("🎭 Failed to play remark TTS:", voiceError);
        }
      }

      // Create response
      const emoji = type === "positive" ? "😊" : "😈";
      const responseText = `${emoji} **Remark delivered:** ${remarkText}`;

      logger.info(
        `🎭 Remark action: Generated ${type} remark${subjectName ? ` about ${subjectName}` : ""}`,
      );

      return {
        success: true,
        message: `${type} remark generated`,
        data: {
          remarkText,
          type,
          subject: subjectName,
          emoji,
        },
        shouldRespond: true,
        responseText,
        useVoice: shouldUseVoice,
      };
    } catch (error) {
      logger.error("🎭 Remark action failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        shouldRespond: true,
        responseText: "An error occurred while generating the remark.",
      };
    }
  }

  validate(parameters: ActionParameters): boolean {
    // Validate remark type
    if (
      !parameters.type ||
      !["positive", "negative"].includes(parameters.type)
    ) {
      return false;
    }

    // Optional parameters should be strings if provided
    if (
      parameters.subject_username &&
      typeof parameters.subject_username !== "string"
    ) {
      return false;
    }

    if (
      parameters.subject_user_id &&
      typeof parameters.subject_user_id !== "string"
    ) {
      return false;
    }

    return true;
  }
}
