import { User, VoiceChannel, CommandInteraction } from "discord.js";
import { OpenAIService } from "./openaiService";
import { validateVoiceChannel } from "../utils/commandHelpers";
import { playTTSInChannel } from "../utils/voiceHelpers";
import { logger } from "../utils/logger";

/**
 * Conversation context for a user
 */
interface ConversationContext {
  userId: string;
  username: string;
  conversationHistory: Array<{
    timestamp: Date;
    command: string;
    userInput: string;
    response: string;
    wasInVoiceChannel: boolean;
    voiceChannelId?: string;
  }>;
  preferences: {
    preferredResponseMode?: "voice" | "text" | "both" | "auto";
    voiceChannelHistory: string[]; // Recent voice channels they've been in
  };
  lastActivity: Date;
}

/**
 * Response from conversation system
 */
export interface ConversationResponse {
  text: string;
  voice?: string;
  shouldPlayVoice: boolean;
  reasoning?: string;
}

/**
 * Lightweight conversational session system
 * Focuses on context awareness and memory, not complex event processing
 */
export class ConversationService {
  private static sessions: Map<string, ConversationContext> = new Map();
  private static readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  /**
   * Get or create conversation context for a user
   */
  static getContext(user: User): ConversationContext {
    const existing = this.sessions.get(user.id);

    if (existing && this.isContextActive(existing)) {
      existing.lastActivity = new Date();
      return existing;
    }

    // Create new context
    const context: ConversationContext = {
      userId: user.id,
      username: user.username,
      conversationHistory: [],
      preferences: {
        voiceChannelHistory: [],
      },
      lastActivity: new Date(),
    };

    this.sessions.set(user.id, context);
    logger.debug(`Created conversation context for ${user.username}`);
    return context;
  }

  /**
   * Generate contextual response based on conversation history and current situation
   */
  static async generateContextualResponse(
    interaction: CommandInteraction,
    command: string,
    userInput: string,
    baseResponse?: string,
  ): Promise<ConversationResponse> {
    const context = this.getContext(interaction.user);
    const voiceValidation = validateVoiceChannel(interaction);
    const isInVoiceChannel = voiceValidation.isValid;
    const voiceChannel = isInVoiceChannel
      ? (voiceValidation.member!.voice.channel as VoiceChannel)
      : null;

    // Update context with current situation
    if (
      voiceChannel &&
      !context.preferences.voiceChannelHistory.includes(voiceChannel.id)
    ) {
      context.preferences.voiceChannelHistory.unshift(voiceChannel.id);
      context.preferences.voiceChannelHistory =
        context.preferences.voiceChannelHistory.slice(0, 5); // Keep last 5
    }

    // Build conversation context for AI
    const conversationPrompt = this.buildConversationPrompt(context, {
      command,
      userInput,
      isInVoiceChannel,
      voiceChannelMemberCount: voiceChannel?.members?.size || 0,
      timeOfDay: this.getTimeOfDay(),
      baseResponse,
    });

    try {
      // Get AI response with conversation awareness
      const aiResponse = await OpenAIService.generateChatCompletion(
        [
          { role: "system", content: conversationPrompt },
          { role: "user", content: userInput || `Execute ${command} command` },
        ],
        {
          temperature: 0.8,
          maxTokens: 400,
        },
      );

      const response = this.parseAIResponse(aiResponse, baseResponse);

      // Store in conversation history
      this.addToHistory(context, {
        command,
        userInput: userInput || "",
        response: response.text,
        wasInVoiceChannel: isInVoiceChannel,
        voiceChannelId: voiceChannel?.id,
      });

      return response;
    } catch (error) {
      logger.error("Contextual response generation failed:", error);

      // Fallback response
      return {
        text: baseResponse || "Experience tranquility. I am here to guide you.",
        shouldPlayVoice:
          isInVoiceChannel && this.shouldUseVoice(context, command),
      };
    }
  }

  /**
   * Execute the contextual response (handle both text and voice)
   */
  static async executeContextualResponse(
    interaction: CommandInteraction,
    response: ConversationResponse,
  ): Promise<void> {
    try {
      // Handle voice response
      if (response.shouldPlayVoice && response.voice) {
        const voiceValidation = validateVoiceChannel(interaction);
        if (voiceValidation.isValid) {
          const voiceChannel = voiceValidation.member!.voice
            .channel as VoiceChannel;
          await playTTSInChannel(voiceChannel, response.voice);
          logger.info(
            `🧘 Contextual TTS: "${response.voice.substring(0, 50)}..."`,
          );
        }
      }

      // Always send text response
      await interaction.editReply({
        content: response.text,
      });
    } catch (error) {
      logger.error("Failed to execute contextual response:", error);
      await interaction.editReply({
        content: response.text, // Fallback to text only
      });
    }
  }

  /**
   * Simple helper: generate response and execute in one call
   */
  static async respondContextually(
    interaction: CommandInteraction,
    command: string,
    userInput: string,
    baseResponse?: string,
  ): Promise<void> {
    const response = await this.generateContextualResponse(
      interaction,
      command,
      userInput,
      baseResponse,
    );
    await this.executeContextualResponse(interaction, response);
  }

  /**
   * Build AI prompt with conversation context
   */
  private static buildConversationPrompt(
    context: ConversationContext,
    currentSituation: {
      command: string;
      userInput: string;
      isInVoiceChannel: boolean;
      voiceChannelMemberCount: number;
      timeOfDay: string;
      baseResponse?: string;
    },
  ): string {
    const recentHistory = context.conversationHistory.slice(-3); // Last 3 interactions
    const historyText = recentHistory
      .map(
        (h) =>
          `- ${h.command}: "${h.userInput}" → "${h.response}" (${h.wasInVoiceChannel ? "voice" : "text"})`,
      )
      .join("\n");

    return `You are Zenyatta, the enlightened omnic monk. Respond to this Discord interaction with awareness of the conversation context and current situation.

CONVERSATION HISTORY:
${historyText || "(This is our first interaction)"}

CURRENT SITUATION:
- Command: /${currentSituation.command}
- User input: "${currentSituation.userInput}"
- User in voice channel: ${currentSituation.isInVoiceChannel} (${currentSituation.voiceChannelMemberCount} members)
- Time: ${currentSituation.timeOfDay}
${currentSituation.baseResponse ? `- Base response: "${currentSituation.baseResponse}"` : ""}

RESPONSE INSTRUCTIONS:
- Reference conversation history when relevant (but don't be repetitive)
- Adapt tone based on voice channel status: ${currentSituation.isInVoiceChannel ? "more intimate/direct since in voice" : "more explanatory for text-only"}
- Return JSON format:
{
  "text": "Discord message text",
  "voice": "TTS version (if different from text)",
  "shouldPlayVoice": ${currentSituation.isInVoiceChannel},
  "reasoning": "why you chose this approach"
}`;
  }

  /**
   * Parse AI response from JSON
   */
  private static parseAIResponse(
    aiResponse: string,
    fallbackText?: string,
  ): ConversationResponse {
    try {
      const parsed = JSON.parse(aiResponse);
      return {
        text: parsed.text || fallbackText || "Experience tranquility.",
        voice: parsed.voice || parsed.text,
        shouldPlayVoice: Boolean(parsed.shouldPlayVoice),
        reasoning: parsed.reasoning,
      };
    } catch (error) {
      // Fallback if JSON parsing fails
      return {
        text: aiResponse || fallbackText || "Experience tranquility.",
        voice: aiResponse || fallbackText,
        shouldPlayVoice: true, // Default to voice if parsing fails
        reasoning: "JSON parsing failed, using raw response",
      };
    }
  }

  /**
   * Add interaction to conversation history
   */
  private static addToHistory(
    context: ConversationContext,
    interaction: Omit<
      ConversationContext["conversationHistory"][0],
      "timestamp"
    >,
  ): void {
    context.conversationHistory.push({
      ...interaction,
      timestamp: new Date(),
    });

    // Keep only last 10 interactions
    if (context.conversationHistory.length > 10) {
      context.conversationHistory = context.conversationHistory.slice(-10);
    }
  }

  /**
   * Determine if voice should be used based on context and command type
   */
  private static shouldUseVoice(
    context: ConversationContext,
    command: string,
  ): boolean {
    // Commands that benefit from voice
    const voiceFriendlyCommands = ["advice", "quote", "remark", "listen"];

    // User preference override
    if (context.preferences.preferredResponseMode === "voice") return true;
    if (context.preferences.preferredResponseMode === "text") return false;

    // Default logic
    return voiceFriendlyCommands.includes(command);
  }

  /**
   * Check if context is still active (not timed out)
   */
  private static isContextActive(context: ConversationContext): boolean {
    const now = Date.now();
    return now - context.lastActivity.getTime() < this.SESSION_TIMEOUT;
  }

  /**
   * Get current time of day for context
   */
  private static getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour < 6) return "late night";
    if (hour < 12) return "morning";
    if (hour < 18) return "afternoon";
    if (hour < 22) return "evening";
    return "night";
  }

  /**
   * Cleanup inactive sessions (call periodically)
   */
  static cleanupInactiveSessions(): void {
    const before = this.sessions.size;

    for (const [userId, context] of this.sessions.entries()) {
      if (!this.isContextActive(context)) {
        this.sessions.delete(userId);
      }
    }

    const cleaned = before - this.sessions.size;
    if (cleaned > 0) {
      logger.debug(`Cleaned up ${cleaned} inactive conversation contexts`);
    }
  }

  /**
   * Get session statistics
   */
  static getStats(): { activeSessions: number; totalInteractions: number } {
    let totalInteractions = 0;

    for (const context of this.sessions.values()) {
      totalInteractions += context.conversationHistory.length;
    }

    return {
      activeSessions: this.sessions.size,
      totalInteractions,
    };
  }
}
