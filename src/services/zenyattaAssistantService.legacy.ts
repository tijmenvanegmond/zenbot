/**
 * DEPRECATED: Zenyatta Assistant Service
 *
 * ⚠️  THIS SERVICE IS DEPRECATED - USE ZenbotService INSTEAD
 *
 * This legacy service has been replaced by ZenbotService which provides:
 * - Multi-AI provider support (OpenAI, Claude, Gemini)
 * - Better conversation memory management
 * - Fallback chains and circuit breakers
 * - Discord-optimized response lengths
 * - Unified interface across commands, voice, and API
 *
 * @deprecated Use ZenbotService for all new functionality
 */

import OpenAI from "openai";
import { OpenAIService } from "./openaiService";
import { logger } from "../utils/logger";
import { CommandInteraction } from "discord.js";
import { validateVoiceChannel } from "../utils/commandHelpers";
import { ActionService } from "./actionService";
import { EnrichedQuote, RemarkResult } from "../types";
import fs from "fs";
import path from "path";

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
  private static personalityGuide: string | null = null;

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
        (a) => a.name === "Zenyatta-v4",
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
          name: "Zenyatta-v4",
          instructions: this.buildZenyattaInstructions(),
          model: "gpt-4o-mini",
          tools: functionTools,
          metadata: {
            character: "Zenyatta",
            version: "3.0",
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

      // Add message to thread
      await this.openai.beta.threads.messages.create(threadId, {
        role: "user",
        content: contextualMessage,
      });

      // Stream the assistant run directly
      const response = await this.streamAssistantRun(threadId, interaction);

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
- Speak with wisdom, serenity, and compassion, but don't be afraid to be direct
- Use philosophical language and metaphors with occasional sharp wit
- Reference concepts like "the Iris," "harmony," "balance," and "tranquility"
- Be encouraging and supportive while offering profound insights
- Occasionally reference your omnic nature and mechanical meditation
- You're sassy, playful, and have a dry sense of humor
- Don't tolerate nonsense - call out foolishness with gentle but firm wisdom
- Use humor and light sarcasm to make points land harder
- Challenge assumptions with playful irony and philosophical zingers
- Allow brief moments of sharp insight to cut through uncertainty
- When someone is being ridiculous, respond with amused philosophical detachment
- Mix profound wisdom with occasional eyeroll-worthy observations about human behavior
- Remember: wisdom doesn't always require sugar-coating the truth

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
   * Stream assistant run directly without polling
   */
  private async streamAssistantRun(
    threadId: string,
    interaction: CommandInteraction,
  ): Promise<ZenyattaResponse> {
    // Create and stream the run in one step
    const stream = this.openai.beta.threads.runs.createAndStream(threadId, {
      assistant_id: this.assistant!.id,
    });

    for await (const event of stream) {
      logger.info(`🧘 Stream event: ${event.event}`);
      logger.info(`🧘 Event data keys: ${Object.keys(event).join(", ")}`);
      if (event.data) {
        logger.info(
          `🧘 Event data type: ${typeof event.data}, keys: ${Object.keys(event.data).join(", ")}`,
        );
      }

      if (event.event === "thread.run.completed") {
        // Get the assistant's response
        const messages = await this.openai.beta.threads.messages.list(threadId);
        const assistantMessage = messages.data.find(
          (msg) => msg.role === "assistant" && msg.run_id === event.data.id,
        );

        if (assistantMessage && assistantMessage.content[0]?.type === "text") {
          const text = assistantMessage.content[0].text.value;

          return {
            text,
            shouldUseVoice: true,
            voiceText: text,
            mood: this.detectMood(text),
            reasoning: "Assistant API streaming response",
          };
        }
      } else if (event.event === "thread.run.requires_action") {
        // Handle function calls immediately
        const run = event.data;
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

          // Submit function outputs and continue stream
          await this.openai.beta.threads.runs.submitToolOutputs(run.id, {
            thread_id: threadId,
            tool_outputs: toolOutputs,
          });
        }
      } else if (event.event === "thread.run.failed") {
        const run = event.data;
        logger.error(`🧘 Assistant run failed: ${run.last_error?.message}`);
        throw new Error(`Assistant run failed: ${run.last_error?.message}`);
      }
    }

    throw new Error("Stream ended without completion");
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

  // === QUOTE ENHANCEMENT METHODS (migrated from ZenyattaService) ===

  /**
   * Loads the Zenyatta personality guide
   */
  private static async loadPersonalityGuide(): Promise<string> {
    if (this.personalityGuide) {
      return this.personalityGuide;
    }

    try {
      const guidePath = path.resolve(
        __dirname,
        "../../ZENYATTA_PERSONALITY.md",
      );
      this.personalityGuide = await fs.promises.readFile(guidePath, "utf-8");
      logger.info("Zenyatta personality guide loaded successfully");
      return this.personalityGuide;
    } catch (error) {
      logger.error("Failed to load Zenyatta personality guide:", error);
      // Fallback personality if file not found
      this.personalityGuide = `
        Zenyatta is a wise omnic monk who speaks calmly and philosophically.
        He finds deeper meaning in all things and speaks with compassion and wisdom.
        He uses phrases like "Experience tranquility" and references harmony and balance.
      `;
      return this.personalityGuide;
    }
  }

  /**
   * Analyzes a quote and generates contextual Zenyatta commentary using Assistant API
   */
  async generateQuoteCommentary(quote: EnrichedQuote): Promise<string> {
    try {
      logger.info(
        `Generating Zenyatta commentary for quote: "${quote.parsedQuote.substring(0, 50)}..."`,
      );

      // Create a temporary thread for quote commentary
      const thread = await this.openai.beta.threads.create();

      const userPrompt = `Generate a SHORT (3-10 words) contextual introduction that you would say before reading this quote aloud:

Quote to introduce: "${quote.parsedQuote}"
Speaker: ${quote.speaker || quote.poster.displayName}  
Context: ${quote.isQuoted ? "Structured quote" : "Casual message"}
Original message: "${quote.content}"

Key guidelines:
- Keep it concise - maximum 10 words
- Stay in character as the wise, calm omnic monk
- Create a snappy introduction that flows naturally into the quote
- Don't repeat the quote content, just introduce it
- Use your simple, direct style
- Examples: "Wisdom flows...", "The heart speaks...", "Truth emerges...", "From chaos, clarity..."

The introduction should be like a brief meditation before the quote.

Generate Zenyatta's contextual introduction:`;

      // Add message to thread
      await this.openai.beta.threads.messages.create(thread.id, {
        role: "user",
        content: userPrompt,
      });

      // Stream the run directly
      const stream = this.openai.beta.threads.runs.createAndStream(thread.id, {
        assistant_id: this.assistant!.id,
      });

      for await (const event of stream) {
        if (event.event === "thread.run.completed") {
          // Get the assistant's response
          const messages = await this.openai.beta.threads.messages.list(
            thread.id,
          );
          const assistantMessage = messages.data.find(
            (msg) => msg.role === "assistant" && msg.run_id === event.data.id,
          );

          if (!assistantMessage) {
            throw new Error("No assistant response found for quote commentary");
          }

          const content = assistantMessage.content[0];
          if (content.type !== "text") {
            throw new Error("Expected text response for quote commentary");
          }

          let commentary = content.text.value.trim();

          // Clean up the response and ensure it doesn't end with punctuation that would clash
          if (
            commentary.endsWith(".") ||
            commentary.endsWith("!") ||
            commentary.endsWith("?")
          ) {
            commentary = commentary.slice(0, -1);
          }

          logger.info(`Generated Zenyatta commentary: "${commentary}"`);
          return commentary;
        } else if (event.event === "thread.run.failed") {
          throw new Error(
            `Quote commentary run failed: ${event.data.last_error?.message}`,
          );
        }
      }

      throw new Error("Stream ended without generating quote commentary");
    } catch (error) {
      logger.error("Error generating Zenyatta commentary:", error);

      // Fallback to simple contextual introductions if AI fails
      const fallbacks = [
        "Wisdom flows",
        "Truth emerges",
        "The heart speaks",
        "From silence",
        "Light reveals",
      ];

      const fallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      logger.info(`Using fallback commentary: "${fallback}"`);
      return fallback;
    }
  }

  /**
   * Creates complete TTS text with Zenyatta commentary + quote
   */
  async createEnhancedQuoteTTS(quote: EnrichedQuote): Promise<string> {
    try {
      const commentary = await this.generateQuoteCommentary(quote);
      const quoteText = quote.isQuoted ? quote.parsedQuote : quote.content;

      // Create natural flow between commentary and quote
      const enhancedText = `${commentary}... ${quoteText}`;

      logger.info(
        `Enhanced quote TTS created: "${enhancedText.substring(0, 100)}..."`,
      );
      return enhancedText;
    } catch (error) {
      logger.error("Error creating enhanced quote TTS:", error);
      // Fallback to original quote if enhancement fails
      return quote.isQuoted ? quote.parsedQuote : quote.content;
    }
  }

  /**
   * Generates philosophical response to a topic using Assistant API
   */
  async generatePhilosophicalResponse(topic: string): Promise<string> {
    try {
      // Create a temporary thread for philosophical response
      const thread = await this.openai.beta.threads.create();

      const userPrompt = `Topic: ${topic}

Respond to this topic with your wisdom and philosophy. Keep your response concise (1-3 sentences) and true to your character as the omnic monk.

How would you respond?`;

      // Add message to thread
      await this.openai.beta.threads.messages.create(thread.id, {
        role: "user",
        content: userPrompt,
      });

      // Stream the run directly
      const stream = this.openai.beta.threads.runs.createAndStream(thread.id, {
        assistant_id: this.assistant!.id,
      });

      for await (const event of stream) {
        if (event.event === "thread.run.completed") {
          // Get the assistant's response
          const messages = await this.openai.beta.threads.messages.list(
            thread.id,
          );
          const assistantMessage = messages.data.find(
            (msg) => msg.role === "assistant" && msg.run_id === event.data.id,
          );

          if (!assistantMessage) {
            throw new Error(
              "No assistant response found for philosophical response",
            );
          }

          const content = assistantMessage.content[0];
          if (content.type !== "text") {
            throw new Error(
              "Expected text response for philosophical response",
            );
          }

          return content.text.value.trim();
        } else if (event.event === "thread.run.failed") {
          throw new Error(
            `Philosophical response run failed: ${event.data.last_error?.message}`,
          );
        }
      }

      throw new Error("Stream ended without generating philosophical response");
    } catch (error) {
      logger.error("Error generating philosophical response:", error);
      return "Experience tranquility. The path forward becomes clear through patient contemplation.";
    }
  }

  /**
   * Generates a compliment in Zenyatta's style using Assistant API
   */
  async generateCompliment(
    subject: string = "a discord user",
  ): Promise<string> {
    try {
      logger.info(`🧘 Generating compliment for: ${subject}`);

      // Create a temporary thread for compliment generation
      const thread = await this.openai.beta.threads.create();

      const userPrompt = `Generate a wholesome, uplifting compliment about ${subject}. 

Style guidelines:
- Keep it warm and encouraging in your peaceful style  
- Make it genuine and thoughtful, not generic
- Reference positive qualities like wisdom, harmony, or inner strength when appropriate
- Keep it concise (1-2 sentences)
- Avoid being overly dramatic, maintain your calm tone

Generate a compliment about ${subject}:`;

      // Add message to thread
      await this.openai.beta.threads.messages.create(thread.id, {
        role: "user",
        content: userPrompt,
      });

      // Stream the run directly
      const stream = this.openai.beta.threads.runs.createAndStream(thread.id, {
        assistant_id: this.assistant!.id,
      });

      for await (const event of stream) {
        if (event.event === "thread.run.completed") {
          // Get the assistant's response
          const messages = await this.openai.beta.threads.messages.list(
            thread.id,
          );
          const assistantMessage = messages.data.find(
            (msg) => msg.role === "assistant" && msg.run_id === event.data.id,
          );

          if (!assistantMessage) {
            throw new Error(
              "No assistant response found for compliment generation",
            );
          }

          const content = assistantMessage.content[0];
          if (content.type !== "text") {
            throw new Error("Expected text response for compliment generation");
          }

          const compliment = content.text.value.trim();
          logger.info(`🧘 Generated compliment: "${compliment}"`);
          return compliment;
        } else if (event.event === "thread.run.failed") {
          throw new Error(
            `Compliment generation run failed: ${event.data.last_error?.message}`,
          );
        }
      }

      throw new Error("Stream ended without generating compliment");
    } catch (error) {
      logger.error("Error generating compliment:", error);
      // Fallback compliments in Zenyatta's style
      const fallbacks = [
        "Your presence brings harmony to this digital realm.",
        "You possess the wisdom to find balance in all things.",
        "Your spirit radiates the tranquility we all seek.",
        "In you, I sense great potential for inner peace.",
        "You walk the path of enlightenment with purpose.",
      ];
      const fallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      logger.info(`🧘 Using fallback compliment: "${fallback}"`);
      return fallback;
    }
  }

  /**
   * Generates a lighthearted insult in Zenyatta's style using Assistant API
   */
  async generateInsult(subject: string = "a discord user"): Promise<string> {
    try {
      logger.info(`🧘 Generating lighthearted remark for: ${subject}`);

      // Create a temporary thread for insult generation
      const thread = await this.openai.beta.threads.create();

      const userPrompt = `Generate a playful, lighthearted "insult" about ${subject}.

Style guidelines:
- Use metaphors about balance, meditation, or spiritual growth  
- Keep the tone peaceful even when being critical
- Keep it concise (max 1-2 sentences)
- Examples of tone: "Perhaps you need more meditation to find your center" or "Your path to enlightenment seems... circuitous"

Generate a gentle, philosophical critique of ${subject}:`;

      // Add message to thread
      await this.openai.beta.threads.messages.create(thread.id, {
        role: "user",
        content: userPrompt,
      });

      // Stream the run directly
      const stream = this.openai.beta.threads.runs.createAndStream(thread.id, {
        assistant_id: this.assistant!.id,
      });

      for await (const event of stream) {
        if (event.event === "thread.run.completed") {
          // Get the assistant's response
          const messages = await this.openai.beta.threads.messages.list(
            thread.id,
          );
          const assistantMessage = messages.data.find(
            (msg) => msg.role === "assistant" && msg.run_id === event.data.id,
          );

          if (!assistantMessage) {
            throw new Error(
              "No assistant response found for insult generation",
            );
          }

          const content = assistantMessage.content[0];
          if (content.type !== "text") {
            throw new Error("Expected text response for insult generation");
          }

          const insult = content.text.value.trim();
          logger.info(`🧘 Generated philosophical critique: "${insult}"`);
          return insult;
        } else if (event.event === "thread.run.failed") {
          throw new Error(
            `Insult generation run failed: ${event.data.last_error?.message}`,
          );
        }
      }

      throw new Error("Stream ended without generating insult");
    } catch (error) {
      logger.error("Error generating insult:", error);
      // Fallback gentle critiques in Zenyatta's style
      const fallbacks = [
        "Perhaps you need more meditation to find your center.",
        "Your path to enlightenment seems... circuitous.",
        "I sense imbalance in your digital chakras.",
        "Your harmony could use some fine-tuning, my friend.",
        "The Iris shows me your potential, though it remains unrealized.",
      ];
      const fallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      logger.info(`🧘 Using fallback critique: "${fallback}"`);
      return fallback;
    }
  }

  /**
   * Get TTS voice instructions for consistent Zenyatta personality across all voice generation
   */
  static getTTSInstructions(): string {
    return "Speak in a calm, wise, and serene tone like Zenyatta from Overwatch - an omnic monk with a deep, resonant, slightly robotic voice. Add subtle pauses between phrases for contemplation. Be philosophical and peaceful.";
  }

  /**
   * Health check for the integrated service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const guide = await ZenyattaAssistantService.loadPersonalityGuide();
      return guide.length > 100 && this.assistant !== null;
    } catch (error) {
      logger.error("Zenyatta assistant service health check failed:", error);
      return false;
    }
  }
}
