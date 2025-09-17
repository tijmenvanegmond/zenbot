import {
  CommandInteraction,
  CommandInteractionOptionResolver,
  GuildMember,
} from "discord.js";
import { logger } from "./logger";

/**
 * Validates if a user is in a voice channel and returns appropriate response
 */
export function validateVoiceChannel(interaction: CommandInteraction): {
  isValid: boolean;
  member: GuildMember | null;
  response?: any;
} {
  const member = interaction?.member as GuildMember;

  if (!member?.voice?.channelId) {
    logger.debug("User not in voice channel - replying with text");
    return {
      isValid: false,
      member: null,
      response: {
        content: "You have to be in voice to use this",
        ephemeral: true,
      },
    };
  }

  return {
    isValid: true,
    member,
  };
}

/**
 * Safely gets typed interaction options
 */
export function getInteractionOptions(
  interaction: CommandInteraction,
): CommandInteractionOptionResolver {
  return interaction.options as CommandInteractionOptionResolver;
}

/**
 * Common error response for command failures
 */
export function createErrorResponse(
  message: string = "An error occurred while executing this command.",
): any {
  return {
    ephemeral: true,
    content: message,
  };
}

/**
 * Common success response for commands
 */
export function createSuccessResponse(message: string): any {
  return {
    ephemeral: true,
    content: message,
  };
}
