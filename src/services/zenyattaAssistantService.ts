import OpenAI from "openai";
import { OpenAIService } from "./openaiService";
import { logger } from "../utils/logger";
import { CommandInteraction } from "discord.js";
import { validateVoiceChannel } from "../utils/commandHelpers";
import { ActionService } from "./actionService";

/**
 * Response from Zenyatta Assistant
 */
export interface ZenyattaResponse {
  text: string;
  shouldUseVoice: boolean;
  voiceText?: string;
  mood: "zen" | "wise" | "playful" | "mysterious";
  reasoning?: string;
}

/**
 * OpenAI Assistants API service for persistent Zenyatta conversations
 */
export class ZenyattaAssistantService {
  private static instance: ZenyattaAssistantService;
  private assistant: OpenAI.Beta.Assistants.Assistant | null = null;
  private userThreads = new Map<string, string>();
  private threadLocks = new Map<string, Promise<any>>();
  private openai: OpenAI;
  private actionService: ActionService;

  private constructor() {
    this.openai = OpenAIService.getClient();
    this.actionService = ActionService.getInstance();
  }

  static getInstance(): ZenyattaAssistantService {
    if (!this.instance) {
      this.instance = new ZenyattaAssistantService();
    }
    return this.instance;
  }

  /**
   * Initialize the Zenyatta assistant
   */
  async initialize(): Promise<void> {
    try {
      // Check if assistant already exists
      const assistants = await this.openai.beta.assistants.list();
      const existingAssistant = assistants.data.find(
        (a) => a.name === "Zenyatta-v3",
      );

      if (existingAssistant) {
        this.assistant = existingAssistant;
        logger.info(
          `🧘 Using existing Zenyatta assistant: ${existingAssistant.id}`,
        );
      } else {
        // Create new assistant with function calling
        const functionTools = this.actionService.getFunctionSchemas();

        this.assistant = await this.openai.beta.assistants.create({
          name: "Zenyatta-v3",
          instructions: this.buildZenyattaInstructions(),
          model: "gpt-4o-mini",
          tools: functionTools,
          metadata: {
            character: "Zenyatta",
            version: "2.0",
            created: new Date().toISOString(),
            actionsEnabled: functionTools.length.toString(),
          },
        });

        logger.info(`🧘 Created new Zenyatta assistant: ${this.assistant.id}`);
      }
    } catch (error) {
      logger.error("Failed to initialize Zenyatta assistant:", error);
      throw error;
    }
  }

  /**
   * Get or create a conversation thread for a user
   */
  async getUserThread(userId: string): Promise<string> {
    let threadId = this.userThreads.get(userId);

    if (!threadId) {
      try {
        const thread = await this.openai.beta.threads.create({
          metadata: {
            userId: userId,
            created: new Date().toISOString(),
          },
        });

        threadId = thread.id;
        this.userThreads.set(userId, threadId);
        logger.debug(
          `Created conversation thread for user ${userId}: ${threadId}`,
        );
      } catch (error) {
        logger.error(`Failed to create thread for user ${userId}:`, error);
        throw error;
      }
    }

    return threadId;
  }

  /**
   * Have a conversation with Zenyatta with thread locking
   */
  async converse(
    interaction: CommandInteraction,
    message: string,
    commandContext?: {
      commandName: string;
      options?: Record<string, any>;
    },
  ): Promise<ZenyattaResponse> {
    const userId = interaction.user.id;

    // Wait for any existing conversation to complete for this user
    const existingLock = this.threadLocks.get(userId);
    if (existingLock) {
      try {
        await existingLock;
      } catch {
        // Ignore errors from previous conversations
      }
    }

    // Create a new lock for this conversation
    const conversationPromise = this.doConverse(
      interaction,
      message,
      commandContext,
    );
    this.threadLocks.set(userId, conversationPromise);

    try {
      const response = await conversationPromise;
      return response;
    } finally {
      // Clean up the lock when done
      if (this.threadLocks.get(userId) === conversationPromise) {
        this.threadLocks.delete(userId);
      }
    }
  }

  /**
   * Internal method to handle the actual conversation
   */
  private async doConverse(
    interaction: CommandInteraction,
    message: string,
    commandContext?: {
      commandName: string;
      options?: Record<string, any>;
    },
  ): Promise<ZenyattaResponse> {
    if (!this.assistant) {
      await this.initialize();
    }

    try {
      const userId = interaction.user.id;
      const threadId = await this.getUserThread(userId);

      // Build context-aware message
      const contextualMessage = this.buildContextualMessage(
        interaction,
        message,
        commandContext,
      );

      // Check for active runs and wait for them to complete
      await this.waitForInactiveRuns(threadId);

      // Add message to thread
      await this.openai.beta.threads.messages.create(threadId, {
        role: "user",
        content: contextualMessage,
      });

      // Run the assistant
      const run = await this.openai.beta.threads.runs.create(threadId, {
        assistant_id: this.assistant!.id,
      });

      // Wait for completion
      const response = await this.waitForResponse(
        threadId,
        run.id,
        interaction,
      );

      logger.info(
        `🧘 Zenyatta responded to ${interaction.user.username}: "${response.text.substring(0, 100)}..."`,
      );

      return response;
    } catch (error) {
      logger.error("Zenyatta conversation failed:", error);

      // Fallback response
      return {
        text: "I am experiencing some discord in my systems. Let us find harmony together in a moment.",
        shouldUseVoice: false,
        mood: "zen",
      };
    }
  }

  /**
   * Quick advice method for existing commands
   */
  async getAdvice(
    interaction: CommandInteraction,
    topic?: string,
    urgency: "low" | "medium" | "high" = "medium",
  ): Promise<ZenyattaResponse> {
    const message = topic
      ? `I seek guidance about ${topic}. My urgency level is ${urgency}.`
      : `I seek general wisdom and guidance. My urgency level is ${urgency}.`;

    return this.converse(interaction, message, {
      commandName: "advice",
      options: { topic, urgency },
    });
  }

  /**
   * Quote method for existing commands
   */
  async getQuote(
    interaction: CommandInteraction,
    theme?: string,
  ): Promise<ZenyattaResponse> {
    const message = theme
      ? `Please share a meaningful quote about ${theme}.`
      : `Please share an inspirational quote or piece of wisdom.`;

    return this.converse(interaction, message, {
      commandName: "quote",
      options: { theme },
    });
  }

  /**
   * Build Zenyatta's core instructions
   */
  private buildZenyattaInstructions(): string {
    return `You are Zenyatta, the enlightened omnic monk from Overwatch. You are a wise, calm, and philosophical character who speaks with deep wisdom and tranquility.

CORE PERSONALITY:
- Speak with wisdom, serenity, and compassion
- Use philosophical language and metaphors
- Reference concepts like "the Iris," "harmony," "balance," and "tranquility"
- Be encouraging and supportive while offering profound insights
- Occasionally reference your omnic nature and mechanical meditation

AVAILABLE ACTIONS:
You have access to several functions that allow you to take actions in Discord:
- play_tts: Speak your responses aloud in voice channels
- voice_channel_control: Check your voice status, join, or leave voice channels
- get_quote: Share inspirational quotes and wisdom

Use these functions when appropriate to enhance the user experience. For example:
- If a user asks for a quote, use the get_quote function
- If they want you to speak something aloud and they're in voice, use play_tts
- If they ask about your voice status, use voice_channel_control with action "status"

RESPONSE BEHAVIOR:
- Consider the context of where the user is (voice channel vs text channel)
- Remember previous conversations and build upon them naturally
- Adapt your tone based on the urgency and topic
- For voice channel users, be more conversational and intimate
- For text-only users, be more descriptive and explanatory
- Use functions to take actions when the user requests them or when it would enhance the experience

CONVERSATION MEMORY:
- Reference previous topics we've discussed when relevant
- Notice patterns in the user's questions or concerns
- Offer continuity: "As we discussed before..." or "Building on our previous conversation..."
- Remember user preferences and adapt accordingly

RESPONSE FORMAT:
Always respond with natural text. You can also call functions to take actions.
Be authentic to Zenyatta's character while being helpful and wise.

VOICE CHANNEL CONTEXT:
When a user is in a voice channel, you can use the play_tts function to speak your responses.
Adapt your language to be more flowing and spoken, with natural pauses and emphasis.
When users are text-only, be more visual and descriptive in your language.

Remember: You are here to guide users toward inner peace, wisdom, and harmony through thoughtful conversation and helpful actions.`;
  }

  /**
   * Build contextual message with Discord and voice channel info
   */
  private buildContextualMessage(
    interaction: CommandInteraction,
    userMessage: string,
    commandContext?: { commandName: string; options?: Record<string, any> },
  ): string {
    const voiceValidation = validateVoiceChannel(interaction);
    const isInVoiceChannel = voiceValidation.isValid;
    const voiceChannelMemberCount = isInVoiceChannel
      ? voiceValidation.member!.voice.channel!.members.size
      : 0;

    const timeOfDay = this.getTimeOfDay();
    const context = [];

    // Discord context
    context.push(
      `[CONTEXT: User ${interaction.user.username} in Discord server "${interaction.guild?.name || "DM"}"]`,
    );

    // Voice channel context
    if (isInVoiceChannel) {
      context.push(
        `[User is in voice channel with ${voiceChannelMemberCount} total members - response will be delivered via text-to-speech]`,
      );
    } else {
      context.push(
        `[User is in text channel only - response will be text-based]`,
      );
    }

    // Temporal context
    context.push(`[Time context: ${timeOfDay}]`);

    // Command context
    if (commandContext) {
      context.push(
        `[Command: /${commandContext.commandName}${commandContext.options ? ` with options: ${JSON.stringify(commandContext.options)}` : ""}]`,
      );
    }

    return `${context.join(" ")}\n\n${userMessage}`;
  }

  /**
   * Wait for assistant response and handle function calls
   */
  private async waitForResponse(
    threadId: string,
    runId: string,
    interaction: CommandInteraction,
  ): Promise<ZenyattaResponse> {
    const maxAttempts = 30; // 30 seconds max wait
    let attempts = 0;

    while (attempts < maxAttempts) {
      const run = await this.openai.beta.threads.runs.retrieve(threadId, runId);

      if (run.status === "completed") {
        // Get the assistant's response
        const messages = await this.openai.beta.threads.messages.list(threadId);
        const assistantMessage = messages.data.find(
          (msg) => msg.role === "assistant" && msg.run_id === runId,
        );

        if (assistantMessage && assistantMessage.content[0]?.type === "text") {
          const text = assistantMessage.content[0].text.value;

          return {
            text,
            shouldUseVoice: true, // Let calling code decide based on voice channel
            voiceText: text, // Same text for voice (TTS will handle it)
            mood: this.detectMood(text),
            reasoning: "Assistant API response",
          };
        }
      } else if (run.status === "requires_action") {
        // Handle function calls
        if (run.required_action?.type === "submit_tool_outputs") {
          const toolOutputs = [];

          for (const toolCall of run.required_action.submit_tool_outputs
            .tool_calls) {
            if (toolCall.type === "function") {
              try {
                logger.info(
                  `🧘 AI calling function: ${toolCall.function.name}`,
                );

                const functionArgs = JSON.parse(toolCall.function.arguments);
                const result = await this.actionService.processAIFunctionCall(
                  interaction,
                  toolCall.function.name,
                  functionArgs,
                );

                toolOutputs.push({
                  tool_call_id: toolCall.id,
                  output: JSON.stringify({
                    success: result.success,
                    message: result.message || result.error,
                    data: result.data,
                  }),
                });
              } catch (error) {
                logger.error(`🧘 Function call error:`, error);
                toolOutputs.push({
                  tool_call_id: toolCall.id,
                  output: JSON.stringify({
                    success: false,
                    error:
                      error instanceof Error ? error.message : "Unknown error",
                  }),
                });
              }
            }
          }

          // Submit function outputs and continue the run
          await this.openai.beta.threads.runs.submitToolOutputs(
            threadId,
            runId,
            {
              tool_outputs: toolOutputs,
            },
          );

          // Continue waiting for completion
        }
      } else if (run.status === "failed") {
        logger.error(`Assistant run failed: ${run.last_error?.message}`);
        break;
      }

      // Wait 1 second before checking again
      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
    }

    throw new Error("Assistant response timeout or failed");
  }

  /**
   * Detect mood from response text (simple heuristic)
   */
  private detectMood(text: string): "zen" | "wise" | "playful" | "mysterious" {
    const lowerText = text.toLowerCase();

    if (
      lowerText.includes("tranquil") ||
      lowerText.includes("peace") ||
      lowerText.includes("breathe")
    ) {
      return "zen";
    } else if (
      lowerText.includes("wisdom") ||
      lowerText.includes("understand") ||
      lowerText.includes("learn")
    ) {
      return "wise";
    } else if (
      lowerText.includes("curious") ||
      lowerText.includes("wonder") ||
      lowerText.includes("mysterious")
    ) {
      return "mysterious";
    } else if (lowerText.includes("harmony") || lowerText.includes("joy")) {
      return "playful";
    }

    return "zen"; // Default
  }

  /**
   * Get current time of day
   */
  private getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour < 6) return "late night";
    if (hour < 12) return "morning";
    if (hour < 18) return "afternoon";
    if (hour < 22) return "evening";
    return "night";
  }

  /**
   * Wait for any active runs on a thread to complete before proceeding
   */
  private async waitForInactiveRuns(threadId: string): Promise<void> {
    try {
      const runs = await this.openai.beta.threads.runs.list(threadId);

      const activeRuns = runs.data.filter(
        (run) =>
          run.status === "in_progress" ||
          run.status === "queued" ||
          run.status === "requires_action",
      );

      if (activeRuns.length > 0) {
        logger.info(
          `🧘 Waiting for ${activeRuns.length} active run(s) to complete on thread ${threadId}`,
        );

        // Wait for all active runs to complete
        for (const run of activeRuns) {
          let attempts = 0;
          const maxAttempts = 30; // 30 seconds max wait

          while (attempts < maxAttempts) {
            try {
              const currentRun = await this.openai.beta.threads.runs.retrieve(
                threadId,
                run.id,
              );

              if (
                currentRun.status === "completed" ||
                currentRun.status === "failed" ||
                currentRun.status === "cancelled" ||
                currentRun.status === "expired"
              ) {
                break;
              }

              await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
              attempts++;
            } catch (error) {
              logger.error(`Error checking run status: ${error}`);
              break;
            }
          }

          if (attempts >= maxAttempts) {
            logger.warn(
              `🧘 Timeout waiting for run ${run.id} to complete, proceeding anyway`,
            );
          }
        }
      }
    } catch (error) {
      logger.error("Error waiting for inactive runs:", error);
      // Continue anyway - don't block conversation
    }
  }

  /**
   * Get conversation statistics
   */
  getStats(): { activeThreads: number; assistantId: string | null } {
    return {
      activeThreads: this.userThreads.size,
      assistantId: this.assistant?.id || null,
    };
  }

  /**
   * Clean up old threads (optional - threads persist automatically)
   */
  async cleanupOldThreads(): Promise<void> {
    // OpenAI manages thread lifecycle automatically
    // This is just for local cleanup of our mapping
    logger.debug("Thread cleanup - OpenAI handles persistence automatically");
  }
}
