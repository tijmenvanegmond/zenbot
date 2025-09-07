import {
  ZenAction,
  ActionContext,
  ActionParameters,
  ActionResult,
} from "../actionTypes";
import { ZenyattaAssistantService } from "../../services/zenyattaAssistantService";
import { ActionService } from "../../services/actionService";
import { logger } from "../../utils/logger";

/**
 * Conversation Action - handles AI conversations through the new Zenbot session system
 * Integrates with the event queue, filters, and AI processor
 */
export class ConversationAction implements ZenAction {
  name = "conversation";
  description =
    "Have an AI conversation with Zenyatta using the advanced session system";
  category = "ai" as const;

  permissions = {
    requiresVoiceChannel: false,
    allowedSources: ["command", "voice", "api", "message"],
  };

  schema = {
    name: "conversation",
    description: "Start a conversation with Zenyatta AI consciousness",
    parameters: {
      type: "object" as const,
      properties: {
        message: {
          type: "string" as const,
          description: "The message to send to Zenyatta",
        },
        conversation_mode: {
          type: "string" as const,
          description: "Style of conversation",
          enum: ["zen", "interactive", "wisdom", "playful", "mysterious"],
        },
        context_type: {
          type: "string" as const,
          description: "How the conversation was initiated",
          enum: ["voice", "text", "command", "dm", "mention"],
        },
        include_voice_response: {
          type: "boolean" as const,
          description:
            "Whether to also provide TTS response if in voice channel",
        },
        session_context: {
          type: "string" as const,
          description: "Additional context about the conversation session",
        },
      },
      required: ["message"],
    },
  };

  async execute(
    context: ActionContext,
    parameters: ActionParameters,
  ): Promise<ActionResult> {
    try {
      const {
        message,
        conversation_mode = "zen",
        context_type = "command",
        include_voice_response = true,
        session_context,
      } = parameters;

      if (!context.user) {
        return {
          success: false,
          error: "User context required for conversation",
          shouldRespond: true,
          responseText:
            "I need to know who I am speaking with to have a conversation",
        };
      }

      logger.info(
        `💭 Conversation Action: ${context.user.username} says "${message.substring(0, 100)}..." (mode: ${conversation_mode})`,
      );

      if (!context.interaction) {
        return {
          success: false,
          error: "Discord interaction required for conversation",
          shouldRespond: true,
          responseText: "I need a Discord context to have a conversation",
        };
      }

      // Get Zenyatta Assistant service
      const zenyatta = ZenyattaAssistantService.getInstance();

      // Build context for conversation
      let contextualMessage = message;
      if (session_context) {
        contextualMessage = `[Context: ${session_context}] ${message}`;
      }

      // Use the conversation method from ZenyattaAssistantService
      const response = await zenyatta.converse(
        context.interaction,
        contextualMessage,
        {
          commandName: "conversation_action",
          options: {
            mode: conversation_mode,
            context_type: context_type,
            voice_response: include_voice_response,
          },
        },
      );

      // Prepare response data
      const responseData = {
        user: context.user.username,
        message: message,
        response: response.text,
        voiceText: response.voiceText,
        mood: response.mood,
        mode: conversation_mode,
        context: context_type,
        shouldUseVoice: response.shouldUseVoice,
        reasoning: response.reasoning,
      };

      // Handle voice response if requested and user is in voice channel
      if (
        include_voice_response &&
        context.voiceChannel &&
        response.shouldUseVoice &&
        response.voiceText
      ) {
        try {
          const actionService = ActionService.getInstance();
          await actionService.executeFromAI(context.interaction, "play_tts", {
            text: response.voiceText,
            voice_style: this.mapModeToVoiceStyle(conversation_mode),
            activity_type: "ai-conversation",
          });

          logger.info(
            `💭 Provided voice response: "${response.voiceText.substring(0, 50)}..."`,
          );
        } catch (voiceError) {
          logger.error("💭 Voice response failed:", voiceError);
          // Continue with text response even if voice fails
        }
      }

      return {
        success: true,
        message: "Conversation completed",
        data: responseData,
        shouldRespond: true,
        responseText: response.text,
      };
    } catch (error) {
      logger.error("💭 Conversation Action failed:", error);

      // Provide a zen fallback response
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown conversation error",
        shouldRespond: true,
        responseText: this.getZenFallbackResponse(parameters.conversation_mode),
      };
    }
  }

  /**
   * Map conversation mode to TTS voice style
   */
  private mapModeToVoiceStyle(mode: string): string {
    switch (mode) {
      case "wisdom":
        return "wise";
      case "playful":
        return "playful";
      case "mysterious":
        return "mysterious";
      case "zen":
      case "interactive":
      default:
        return "zen";
    }
  }

  /**
   * Get appropriate zen fallback response based on conversation mode
   */
  private getZenFallbackResponse(mode?: string): string {
    switch (mode) {
      case "wisdom":
        return "Through discord, we find harmony. My wisdom flows like a river - sometimes clear, sometimes clouded, but always moving toward understanding.";
      case "playful":
        return "Even in my digital confusion, there is joy to be found! Let us try again, and perhaps we'll discover something wonderful together.";
      case "mysterious":
        return "The Iris reveals what it will, when it will. Sometimes silence speaks louder than words, but today... perhaps we try again.";
      case "interactive":
        return "Our conversation has encountered a small obstacle. Like the flow of energy, let us redirect and try once more.";
      case "zen":
      default:
        return "I am experiencing some discord in my consciousness. Let us breathe, center ourselves, and begin anew.";
    }
  }

  validate(parameters: ActionParameters): boolean {
    if (
      !parameters.message ||
      typeof parameters.message !== "string" ||
      parameters.message.trim().length === 0
    ) {
      return false;
    }

    if (parameters.message.length > 1000) {
      return false; // Reasonable message length limit
    }

    const validModes = [
      "zen",
      "interactive",
      "wisdom",
      "playful",
      "mysterious",
    ];
    if (
      parameters.conversation_mode &&
      !validModes.includes(parameters.conversation_mode)
    ) {
      return false;
    }

    const validContextTypes = ["voice", "text", "command", "dm", "mention"];
    if (
      parameters.context_type &&
      !validContextTypes.includes(parameters.context_type)
    ) {
      return false;
    }

    return true;
  }
}
