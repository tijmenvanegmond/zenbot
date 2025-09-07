import { CommandInteraction } from "discord.js";
import { ConversationService } from "../services/conversationService";
import { validateVoiceChannel } from "./commandHelpers";
import { playTTSInChannel } from "./voiceHelpers";

/**
 * Utility functions to easily add contextual awareness to existing commands
 */

/**
 * Simple wrapper to add conversation context to any existing command logic
 *
 * Usage in existing commands:
 * ```typescript
 * // Replace this:
 * await interaction.editReply({ content: response });
 *
 * // With this:
 * await respondWithContext(interaction, 'advice', userQuery, response);
 * ```
 */
export async function respondWithContext(
  interaction: CommandInteraction,
  commandName: string,
  userInput: string,
  baseResponse: string,
): Promise<void> {
  await ConversationService.respondContextually(
    interaction,
    commandName,
    userInput,
    baseResponse,
  );
}

/**
 * Check if user is in voice channel and has conversation context
 * Returns enhanced context info for command logic
 */
export function getEnhancedContext(interaction: CommandInteraction) {
  const voiceValidation = validateVoiceChannel(interaction);
  const conversationContext = ConversationService.getContext(interaction.user);

  return {
    isInVoiceChannel: voiceValidation.isValid,
    voiceChannel: voiceValidation.isValid
      ? voiceValidation.member!.voice.channel
      : null,
    voiceChannelMemberCount: voiceValidation.isValid
      ? voiceValidation.member!.voice.channel!.members.size
      : 0,
    hasConversationHistory: conversationContext.conversationHistory.length > 0,
    lastCommand: conversationContext.conversationHistory.slice(-1)[0]?.command,
    isReturningUser: conversationContext.conversationHistory.length > 1,
    timeOfDay: getTimeOfDay(),
    user: interaction.user,
  };
}

/**
 * Enhanced voice/text decision logic based on context
 */
export function shouldUseVoiceResponse(
  interaction: CommandInteraction,
  commandName: string,
): boolean {
  const context = getEnhancedContext(interaction);

  // No voice channel = definitely text only
  if (!context.isInVoiceChannel) return false;

  // Voice-friendly commands
  const voiceFriendlyCommands = ["advice", "quote", "remark", "listen"];
  if (voiceFriendlyCommands.includes(commandName)) return true;

  // Large voice channels might prefer text (less disruptive)
  if (context.voiceChannelMemberCount > 5) return false;

  // Late night hours - prefer voice (more intimate)
  if (context.timeOfDay === "late night" || context.timeOfDay === "night")
    return true;

  // Default: use voice for returning users, text for new users
  return context.isReturningUser;
}

/**
 * Smart response that adapts content based on voice vs text
 */
export async function createContextualResponse(
  interaction: CommandInteraction,
  commandName: string,
  baseContent: string,
  options?: {
    voiceVersion?: string;
    textVersion?: string;
    forceMode?: "voice" | "text" | "both";
  },
): Promise<void> {
  const context = getEnhancedContext(interaction);
  const useVoice =
    options?.forceMode === "voice" ||
    (options?.forceMode !== "text" &&
      shouldUseVoiceResponse(interaction, commandName));

  let textResponse = options?.textVersion || baseContent;
  let voiceResponse = options?.voiceVersion || baseContent;

  // Adapt content for the medium
  if (useVoice && context.isInVoiceChannel) {
    // Voice version - more conversational, remove Discord formatting
    voiceResponse = adaptForVoice(voiceResponse, context);

    if (context.hasConversationHistory) {
      voiceResponse = addConversationFlow(voiceResponse, context);
    }

    try {
      await playTTSInChannel(context.voiceChannel! as any, voiceResponse);
    } catch (error) {
      // Fallback to text if TTS fails
      useVoice && console.warn("TTS failed, falling back to text:", error);
    }
  }

  // Always send text response (even with voice for accessibility)
  await interaction.editReply({
    content: formatForDiscord(textResponse, context),
  });
}

/**
 * Adapt text for TTS voice delivery
 */
function adaptForVoice(
  text: string,
  context: ReturnType<typeof getEnhancedContext>,
): string {
  let adapted = text;

  // Remove Discord markdown
  adapted = adapted.replace(/\*\*(.*?)\*\*/g, "$1"); // Bold
  adapted = adapted.replace(/\*(.*?)\*/g, "$1"); // Italic
  adapted = adapted.replace(/`(.*?)`/g, "$1"); // Code
  adapted = adapted.replace(/#{1,6}\s/g, ""); // Headers

  // Add personal touch for voice
  if (context.timeOfDay === "morning") {
    adapted = `Good morning, ${context.user.username}. ${adapted}`;
  } else if (context.timeOfDay === "evening") {
    adapted = `Peace be upon you this evening. ${adapted}`;
  }

  return adapted;
}

/**
 * Add conversation flow references
 */
function addConversationFlow(
  text: string,
  context: ReturnType<typeof getEnhancedContext>,
): string {
  if (!context.hasConversationHistory) return text;

  const lastCommand = context.lastCommand;

  // Add gentle references to previous interactions
  if (lastCommand === "advice") {
    return `Continuing our path of wisdom... ${text}`;
  } else if (lastCommand === "quote") {
    return `As we discussed before... ${text}`;
  }

  return text;
}

/**
 * Format text for Discord with context awareness
 */
function formatForDiscord(
  text: string,
  context: ReturnType<typeof getEnhancedContext>,
): string {
  // Add context indicators
  let formatted = text;

  if (context.isInVoiceChannel) {
    formatted = `🎵 *Also delivered in voice* • ${formatted}`;
  }

  return formatted;
}

/**
 * Get current time of day
 */
function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "late night";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  if (hour < 22) return "evening";
  return "night";
}
