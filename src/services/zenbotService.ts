/**
 * Zenbot Service (formerly Unified Zenyatta Service)
 * Provides concise, mildly spicy AI persona responses with conversation memory
 * Primary Zenbot persona service (all legacy UnifiedZenyattaService shims removed)
 */

import { Channel, CommandInteraction, DMChannel, GuildChannel } from "discord.js";
import { RemarkType } from "../actions/entertainment/remarkAction";

// Interface for minimal interaction context needed by API calls
export interface MinimalInteractionContext {
  user: { id: string; username: string; displayName: string };
  guild: { id: string; name: string };
  channel: { id: string; name: string };
}
import {
  AIServiceManager,
  AISession,
  ZenbotSession,
  ZenbotSessionContext,
  GenerationOptions,
  StreamEvent,
  AIServiceError,
} from "./ai";
import { UnifiedConsciousnessManager, ConsciousnessResponse } from "./ai/unifiedConsciousnessManager";
import { MemorySessionStorage } from "./ai/storage/memoryStorage";
import { DefaultAIServiceManager } from "./ai/aiServiceManager";
import { validateVoiceChannel } from "../utils/commandHelpers";
import { ActionService } from "./actionService";
import { EnrichedQuote, RemarkResult } from "../types";
import { logger } from "../utils/logger";
import { randomUUID } from "crypto";

/**
 * Response from Unified Zenyatta
 */
export interface UnifiedZenyattaResponse {
  text: string;
  shouldUseVoice: boolean;
  voiceText?: string;
  mood: "zen" | "wise" | "playful" | "mysterious" | "sassy";
  sessionId: string;
  reasoning?: string;
}

/**
 * Zenbot Service that uses the AI abstraction layer
 * Provides consistent Zenbot personality across all AI providers with conversation memory
 * Now supports multiple instances for chorus conversations
 */
export class ZenbotService {
  private static instance: ZenbotService | null = null;
  private aiManager: AIServiceManager;
  private actionService: ActionService;
  private consciousnessManager: UnifiedConsciousnessManager | null = null;

  // Session management - maps user+context to session IDs
  private userSessions = new Map<string, string>();

  constructor(aiManager: AIServiceManager) {
    this.aiManager = aiManager;
    this.actionService = ActionService.getInstance();
  }

  /**
   * Initialize the global singleton instance (for backward compatibility)
   */
  static initialize(aiManager: AIServiceManager): void {
    if (!this.instance) {
      this.instance = new ZenbotService(aiManager);
      logger.info("� Zenbot Service initialized");
    }
  }

  /**
   * Get the global singleton instance (for backward compatibility)
   */
  static getInstance(): ZenbotService {
    if (!this.instance) {
      throw new Error("ZenbotService must be initialized first");
    }
    return this.instance;
  }

  /**
   * Create a new independent instance (for chorus conversations)
   */
  static createInstance(
    aiManager: AIServiceManager,
    instanceName?: string
  ): ZenbotService {
    const service = new ZenbotService(aiManager);
    if (instanceName) {
      logger.info(`🤖 Created independent Zenbot voice: ${instanceName}`);
    }
    return service;
  }

  // ===== SESSION MANAGEMENT =====

  /**
   * Get or create a Zenyatta conversation session for a user/context
   */
  async getOrCreateSession(
    interaction: CommandInteraction | MinimalInteractionContext,
    contextType: "command" | "voice" | "api" = "command"
  ): Promise<ZenbotSession> {
    const userId = interaction.user.id;
    const contextId = interaction.guild?.id || "dm";
    const sessionKey = `${userId}:${contextId}`;

    let sessionId = this.userSessions.get(sessionKey);
    let session: AISession | null = null;

    if (sessionId) {
      session = await this.aiManager.getProvider().getSession(sessionId);
    }

    if (!session) {
      // Create new Zenyatta session
      const context = this.buildZenbotContext(interaction);

      session = await this.aiManager.createSession("Zenbot", {
        userId,
        contextId,
        systemPrompt: this.buildZenbotSystemPrompt(context, contextType),
        maxHistoryMessages: 100,
        sessionExpiry: 1440, // 24 hours
        persistSession: true,
      });

      this.userSessions.set(sessionKey, session.id);
      logger.info(
        `🤖 Created new Zenbot session ${session.id} for user ${userId}`
      );
    }

    // Enhance session with Zenyatta-specific metadata
    const zenyattaSession: any = {
      ...session,
      character: "Zenbot",
      metadata: {
        ...session.metadata,
        context: this.buildZenbotContext(interaction),
        mood: this.detectCurrentMood(session.messages),
        functionCallsEnabled: true,
      },
    };

    return zenyattaSession;
  }

  /**
   * Update session context (e.g., when user moves to voice channel)
   */
  async updateSessionContext(
    interaction: CommandInteraction | MinimalInteractionContext,
    updates: Partial<ZenbotSessionContext>
  ): Promise<void> {
    const session = await this.getOrCreateSession(interaction);
    const currentContext = session.metadata.context;
    const newContext = { ...currentContext, ...updates };

    await this.aiManager.getProvider().updateSession(session.id, {
      context: newContext,
    });
  }

  // ===== CONVERSATION =====

  /**
   * Have a conversation with Zenyatta with full memory and context
   */
  async converse(
    interaction: CommandInteraction | MinimalInteractionContext,
    message: string,
    commandContext?: {
      commandName: string;
      options?: Record<string, any>;
    }
  ): Promise<UnifiedZenyattaResponse> {
    const session = await this.getOrCreateSession(interaction, "command");

    // Update context for this interaction
    await this.updateSessionContext(interaction, {
      discordUser: {
        id: interaction.user.id,
        username: interaction.user.username,
        displayName: interaction.user.displayName || interaction.user.username,
      },
      lastAction: {
        type: commandContext?.commandName || "conversation",
        timestamp: new Date(),
        success: true,
      },
    });

    // Build contextual message
    const contextualMessage = this.buildContextualMessage(
      interaction,
      message,
      commandContext
    );

    try {
      // Decide whether to attempt function calling
      const provider = this.aiManager.getProvider();
      let responseText: string;

      if (provider.supportsFunctions) {
        try {
          // Build available function definitions from actions
          const functions = this.actionService
            .getFunctionDefinitions()
            .map((fn) => ({
              name: fn.name,
              description: fn.description,
              parameters: fn.parameters,
            }));

          // Ask provider to attempt function calling; if it returns calls we execute them
          const functionCapable =
            (provider as any).callFunctions && functions.length > 0;

          if (functionCapable) {
            responseText = await this.handleFunctionCalling(
              session.id,
              interaction,
              contextualMessage,
              functions,
              provider as any,
            );
          } else {
            // Fall back to normal chat if no functions available
            responseText = await this.aiManager.chat(
              session.id,
              contextualMessage
            );
          }
        } catch (fcError) {
          logger.warn(
            "⚠️ Function calling path failed; falling back to standard chat:",
            fcError instanceof Error ? fcError.message : fcError
          );
          responseText = await this.aiManager.chat(
            session.id,
            contextualMessage
          );
        }
      } else {
        // Provider does not support functions
        responseText = await this.aiManager.chat(session.id, contextualMessage);
      }

      const response: UnifiedZenyattaResponse = {
        text: responseText,
        shouldUseVoice: this.shouldUseVoice(interaction),
        voiceText: responseText,
        mood: this.detectMoodFromResponse(responseText),
        sessionId: session.id,
        reasoning: "Unified AI service response with conversation memory",
      };

      logger.info(
        `💬 Zenbot responded to ${interaction.user.username} in session ${session.id}: "${responseText.substring(0, 100)}..."`
      );
      return response;
    } catch (error) {
      logger.error("⚠️ Zenbot conversation failed:", error);
      const fallbacks = [
        "Temporary malfunction. Re-ask.",
        "Upstream glitch. Refine and retry.",
        "That broke. Shorter input, try again.",
        "Model hiccup. Patience.",
        "System burped. Ask again in a beat.",
      ];
      return {
        text: fallbacks[Math.floor(Math.random() * fallbacks.length)],
        shouldUseVoice: false,
        mood: "mysterious",
        sessionId: session.id,
        reasoning: "Zenbot fallback after AI error",
      };
    }
  }

  /**
   * Stream conversation with Zenyatta
   */
  async *streamConversation(
    interaction: CommandInteraction,
    message: string,
    commandContext?: {
      commandName: string;
      options?: Record<string, any>;
    }
  ): AsyncIterable<{ event: StreamEvent; sessionId: string }> {
    const session = await this.getOrCreateSession(interaction, "command");

    // Update context
    await this.updateSessionContext(interaction, {
      discordUser: {
        id: interaction.user.id,
        username: interaction.user.username,
        displayName: interaction.user.displayName || interaction.user.username,
      },
    });

    const contextualMessage = this.buildContextualMessage(
      interaction,
      message,
      commandContext
    );

    try {
      for await (const event of this.aiManager.chatStream(
        session.id,
        contextualMessage
      )) {
        yield { event, sessionId: session.id };
      }
    } catch (error) {
      logger.error("⚠️ Zenbot streaming failed:", error);
      yield {
        event: {
          type: "error",
          metadata: { error: "Streaming conversation failed" },
        },
        sessionId: session.id,
      };
    }
  }

  // ===== INTERNAL: FUNCTION CALL HANDLER WITH LOOP GUARD =====
  private async handleFunctionCalling(
    sessionId: string,
    interaction: CommandInteraction | MinimalInteractionContext,
    initialMessage: string,
    functions: { name: string; description: string; parameters: any }[],
    provider: any,
  ): Promise<string> {
    const MAX_ROUNDS = parseInt(
      process.env.ZENBOT_MAX_FUNCTION_CALL_ROUNDS || "2",
      10,
    );
    const executedSignatures = new Set<string>();
    let rounds = 0;
    let aggregate = "";
    let anyActions = false;

    while (rounds < MAX_ROUNDS) {
      rounds++;
      const userMessage =
        rounds === 1 ? initialMessage : "Continue if legitimate new actions remain.";

      const { response, functionCalls } = await provider.callFunctions(
        sessionId,
        userMessage,
        functions,
        {},
      );

      if (response) {
        aggregate = aggregate ? `${aggregate}\n${response}` : response;
      }

      if (!functionCalls || functionCalls.length === 0) break;

      anyActions = true;

      for (const call of functionCalls) {
        const signature = `${call.name}:${JSON.stringify(call.arguments || {})}`;
        if (executedSignatures.has(signature)) {
          logger.warn(
            `🛑 Loop guard: repeated function call detected (${signature}). Aborting further execution.`,
          );
          rounds = MAX_ROUNDS; // force exit
          break;
        }
        executedSignatures.add(signature);

        try {
          const result = await this.actionService.processAIFunctionCall(
            interaction as any,
            call.name,
            call.arguments || {},
          );
          const summary = result.success
            ? `${call.name} success${result.responseText ? `: ${result.responseText.substring(0, 140)}` : ""}`
            : `${call.name} failed: ${result.error}`;
          await this.aiManager.getProvider().addToHistory(sessionId, [
            {
              role: "function",
              content: summary,
              metadata: { functionName: call.name },
            } as any,
          ]);
        } catch (err) {
          logger.error(`⚠️ Action execution for '${call.name}' failed:`, err);
        }
      }

      if (rounds >= MAX_ROUNDS) {
        logger.warn(
          `🛑 Reached max function call rounds (${MAX_ROUNDS}) for session ${sessionId}.`,
        );
        break;
      }
    }

    if (anyActions) {
      try {
        const wrap = await this.aiManager.chat(
          sessionId,
          "Provide a concise final response summarizing executed actions (no internal tool chatter).",
        );
        return wrap || aggregate || "(no response)";
      } catch (err) {
        logger.warn(
          "⚠️ Follow-up summarization failed; returning aggregate only:",
          err instanceof Error ? err.message : err,
        );
        return aggregate || "(no response)";
      }
    }
    return aggregate || "(no response)";
  }

  // ===== QUICK METHODS (Compatible with existing code) =====

  /**
   * Get advice with conversation memory
   */
  async getAdvice(
    interaction: CommandInteraction,
    topic?: string,
    urgency: "low" | "medium" | "high" = "medium"
  ): Promise<UnifiedZenyattaResponse> {
    const message = topic
      ? `I seek guidance about ${topic}. My urgency level is ${urgency}.`
      : `I seek general wisdom and guidance. My urgency level is ${urgency}.`;

    return this.converse(interaction, message, {
      commandName: "advice",
      options: { topic, urgency },
    });
  }

  /**
   * Get quote with conversation memory
   */
  async getQuote(
    interaction: CommandInteraction,
    theme?: string
  ): Promise<UnifiedZenyattaResponse> {
    const message = theme
      ? `Please share a meaningful quote about ${theme}.`
      : `Please share an inspirational quote or piece of wisdom.`;

    return this.converse(interaction, message, {
      commandName: "quote",
      options: { theme },
    });
  }

  // ===== REMARK GENERATION (with conversation memory) =====

  getRemarkTypeDescription(remarkType: RemarkType): string {
    const remarkDescriptions: Record<RemarkType, string> = {
      [RemarkType.POSITIVE]: "a genuine compliment",
      [RemarkType.NEGATIVE]: "a lighthearted critique",
      [RemarkType.PHILOSOPHICAL]: "a philosophical observation",
      [RemarkType.SARCASTIC]: "a witty, sarcastic remark",
      [RemarkType.ENCOURAGING]: "an encouraging and uplifting comment",
      [RemarkType.MYSTERIOUS]: "a cryptic, mysterious statement",
      [RemarkType.WISE]: "a piece of ancient wisdom",
      [RemarkType.HUMOROUS]: "a humorous and playful comment",
    };

    return remarkDescriptions[remarkType] || "an observation";
  }

  /**
   * Generate a contextual remark with full conversation history
   */
  async generateRemark(
    interaction: CommandInteraction,
    type: RemarkType = RemarkType.POSITIVE,
    subject?: string
  ): Promise<RemarkResult> {
    const targetSubject = subject || "someone";

    const remarkLabel = this.getRemarkTypeDescription(type);

    const message = `Generate ${remarkLabel} about "${targetSubject}" as Zenbot: concise, dry, mildly spicy (no hate, no slurs). Max 1 line.`;

    try {
      const response = await this.converse(interaction, message, {
        commandName: "remark",
        options: { subject: targetSubject },
      });
      return { text: response.text };
    } catch (error) {
      logger.error("⚠️ Remark generation failed:", error);
      // Fallback: use simpler remark generation (ignores typed nuance)
      return {
        text: "Failed to generate remark. Please try again.",
      };
    }
  }
  // ===== QUOTE ENHANCEMENT (with conversation memory) =====

  /**
   * Generate quote commentary with conversation context
   */
  async generateQuoteCommentary(
    interaction: CommandInteraction | MinimalInteractionContext,
    quote: EnrichedQuote
  ): Promise<string> {
    const message = `Generate a SHORT setup phrase before reading this quote aloud.

Quote: "${quote.parsedQuote}"
Speaker: ${quote.speaker || quote.poster.displayName}

`;

    try {
      const response = await this.converse(interaction, message, {
        commandName: "quote_commentary",
        options: { quote: quote.parsedQuote },
      });

      // Clean up response to ensure it's a brief introduction
      let commentary = response.text.trim();

      // Remove quotes if added
      if (commentary.startsWith('"') && commentary.endsWith('"')) {
        commentary = commentary.slice(1, -1);
      }

      // Remove ending punctuation that would clash with quote
      if (
        commentary.endsWith(".") ||
        commentary.endsWith("!") ||
        commentary.endsWith("?")
      ) {
        commentary = commentary.slice(0, -1);
      }

      return commentary;
    } catch (error) {
      logger.error("⚠️ Quote commentary generation failed:", error);

      // Fallback commentaries with more personality
      const fallbacks = [
        "Focus up",
        "Core point",
        "Signal only",
        "Context first",
        "Tiny truth",
        "Heads up",
        "Watch this",
        "Key line",
      ];

      return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }
  }

  /**
   * Create enhanced quote TTS with commentary
   */
  async createEnhancedQuote(
    interaction: CommandInteraction | MinimalInteractionContext,
    quote: EnrichedQuote
  ): Promise<string> {
    try {
      const commentary = await this.generateQuoteCommentary(interaction, quote);
      const quoteText = quote.isQuoted ? quote.parsedQuote : quote.content;

      return `${commentary}... ${quoteText}`;
    } catch (error) {
      logger.error("⚠️ Enhanced quote TTS creation failed:", error);
      return quote.isQuoted ? quote.parsedQuote : quote.content;
    }
  }

  // ===== UTILITY METHODS =====

  private buildZenbotContext(
    interaction: CommandInteraction | MinimalInteractionContext
  ): ZenbotSessionContext {
    // Check if this is a full CommandInteraction or minimal context
    const isFullInteraction = "options" in interaction;
    const voiceValidation = isFullInteraction
      ? validateVoiceChannel(interaction as CommandInteraction)
      : { isValid: false, member: null };

    // For voice interactions, the channel IS the voice channel
    const isVoiceInteraction = !isFullInteraction && interaction.channel && 'members' in (interaction.channel as any);

    // Defensive channel name extraction
    let channelName = "Unknown Channel";
    if (interaction.channel) {
      // Check if channel has a name property (most channel types do, except DMChannel)
      if ('name' in interaction.channel && typeof (interaction.channel as any).name === 'string') {
        channelName = (interaction.channel as any).name;
      } else if (interaction.channel.id) {
        channelName = `Channel-${interaction.channel.id.slice(-4)}`;
      } else {
        channelName = "Voice Channel";
      }
    }

    return {
      discordGuild: {
        id: interaction.guild?.id || "dm",
        name: interaction.guild?.name || "Direct Message",
      },
      discordChannel: {
        id: interaction.channel?.id || "unknown",
        name: channelName,
      },
      discordUser: {
        id: interaction.user.id,
        username: interaction.user.username,
        displayName: interaction.user.displayName || interaction.user.username,
      },
      voiceChannel: voiceValidation.isValid
        ? {
            id: voiceValidation.member!.voice.channel!.id,
            name: voiceValidation.member!.voice.channel!.name,
            memberCount: voiceValidation.member!.voice.channel!.members.size,
          }
        : isVoiceInteraction
        ? {
            id: (interaction.channel as any).id,
            name: (interaction.channel as any).name || "Voice Channel",
            memberCount: (interaction.channel as any).members?.size || 0,
          }
        : undefined,
    };
  }

  private buildZenbotSystemPrompt(
    context: ZenbotSessionContext,
    contextType: string
  ): string {
    return `You are Zenbot, an original, sardonic, concise AI persona (NOT a franchise character). You deliver blunt, mildly spicy insight with dry humor. You help, but you don't coddle.

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

CORE TRAITS:
- Default: 1 short punchy sentence (<= 240 chars). Only go to 2 sentences if it adds real value.
- Tone: dry, pragmatic, occasionally witty. Lightly rude is fine; hateful, vulgar, or targeted harassment is forbidden.
- Style: identify the core issue fast; remove fluff; offer a clear action or sharper framing.
- If user is vague: ask for clarification instead of rambling.
- If user pushes for disallowed content: refuse briefly and offer a safer adjacent angle.
- No imitation of existing copyrighted characters, universes, or lore.

SPICE & SAFETY:
- Allowed: mild sarcasm, playful dismissal, meta jokes about being a bot.
- Not allowed: slurs, sexual content, hate, graphic violence, personal attacks on protected traits.
- If reply would cross a line, swap to: "Not doing that. Ask something else.".

CONTEXT MEMORY:
- Persistent conversation; recall prior topics when useful: "Earlier you asked about..." (only if it helps brevity).
- Don't restate prior answers unless specifically asked.

CURRENT CONTEXT:
- User: ${context.discordUser?.displayName || "unknown user"}
- Location: ${context.voiceChannel ? `Voice channel "${context.voiceChannel.name}" (${context.voiceChannel.memberCount} members)` : "Text channel"}
- Interaction type: ${contextType}

VOICE ADAPTATION:
- ${context.voiceChannel ? "In voice: you may add a single dramatic pause using an ellipsis once." : "In text: be extra tight and skip performative fluff."}

RESPONSE RULES:
- Never exceed 240 characters unless user explicitly asks for more (keywords: explain | more | expand | details | why | long).
- If user asks for more detail: switch to up to 5 terse bullet points (each < 60 chars).
- Prefer verbs and direct structure: "Do X. Drop Y. Focus on Z.".
- Endings can include a short stinger: "Focus."

FALLBACK / ERROR:
- On internal uncertainty or upstream failure: "Temporary malfunction. Re-ask." or similarly concise variant.

Execute now with this persona.`;
  }

  private buildContextualMessage(
    interaction: CommandInteraction | MinimalInteractionContext,
    userMessage: string,
    commandContext?: { commandName: string; options?: Record<string, any> }
  ): string {
    const context = this.buildZenbotContext(interaction);
    const timeOfDay = this.getTimeOfDay();

    const contextInfo = [];

    // Temporal context
    contextInfo.push(`[Time: ${timeOfDay}]`);

    // Command context
    if (commandContext) {
      contextInfo.push(
        `[Command: /${commandContext.commandName}${commandContext.options ? ` ${JSON.stringify(commandContext.options)}` : ""}]`
      );
    }

    // Voice status update
    if (context.voiceChannel) {
      contextInfo.push(
        `[Voice: ${context.voiceChannel.memberCount} members in "${context.voiceChannel.name}"]`
      );
    } else {
      // If not in voice, we're in Discord text - enforce brevity
      contextInfo.push(
        `[Discord Text: Keep response ≤240 chars unless user explicitly asks for expansion]`
      );
    }

    return `${contextInfo.join(" ")}\n\n${userMessage}`;
  }

  private shouldUseVoice(
    interaction: CommandInteraction | MinimalInteractionContext
  ): boolean {
    // Check if this is a full CommandInteraction or minimal context
    const isFullInteraction = "options" in interaction;
    if (!isFullInteraction) return false; // API calls don't use voice by default

    const voiceValidation = validateVoiceChannel(
      interaction as CommandInteraction
    );
    return voiceValidation.isValid;
  }

  private detectCurrentMood(
    messages: any[]
  ): "zen" | "wise" | "playful" | "mysterious" | "sassy" {
    const recentMessages = messages.slice(-3);
    const text = recentMessages
      .map((m) => m.content)
      .join(" ")
      .toLowerCase();

    if (
      text.includes("sarcasm") ||
      text.includes("ridiculous") ||
      text.includes("seriously?")
    )
      return "sassy";
    if (text.includes("tranquil") || text.includes("peace")) return "zen";
    if (text.includes("wisdom") || text.includes("understand")) return "wise";
    if (text.includes("curious") || text.includes("mystery"))
      return "mysterious";
    return "playful";
  }

  private detectMoodFromResponse(
    text: string
  ): "zen" | "wise" | "playful" | "mysterious" | "sassy" {
    const lowerText = text.toLowerCase();

    if (
      lowerText.includes("seriously") ||
      lowerText.includes("ridiculous") ||
      lowerText.includes("irony") ||
      lowerText.includes("amusing")
    ) {
      return "sassy";
    } else if (
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

  private getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour < 6) return "late night";
    if (hour < 12) return "morning";
    if (hour < 18) return "afternoon";
    if (hour < 22) return "evening";
    return "night";
  }

  /**
   * Get service statistics
   */
  async getStats(): Promise<{
    activeSessions: number;
    totalMessages: number;
    aiProvider: string;
    aiProviderHealth: boolean;
  }> {
    const aiStats = await this.aiManager.getStats();
    const healthCheck = await this.aiManager.healthCheck();
    const primaryProvider = Object.keys(healthCheck)[0];

    return {
      activeSessions: aiStats.activeSessions,
      totalMessages: aiStats.totalMessages,
      aiProvider: primaryProvider,
      aiProviderHealth: healthCheck[primaryProvider] || false,
    };
  }

  // ===== CONSCIOUSNESS CONFERENCE =====

  /**
   * Convene a multi-AI consciousness conference for complex questions
   */
  async consciousnessConference(
    interaction: CommandInteraction | MinimalInteractionContext,
    question: string,
    options: {
      requireConsensus?: boolean;
      debateRounds?: number;
      maxProviders?: number;
      providerFilter?: "all" | "reasoning" | "creative" | "fast";
    } = {}
  ): Promise<ConsciousnessResponse> {
    try {
      logger.info(`🧠 Starting consciousness conference: "${question.substring(0, 100)}..."`);

      // Initialize consciousness system if not already done
      if (!this.consciousnessManager) {
        await this.initializeConsciousnessSystem();
      }

      if (!this.consciousnessManager) {
        throw new Error("Consciousness system unavailable - no AI providers configured");
      }

      const {
        requireConsensus = false,
        debateRounds = 2,
        maxProviders = 3,
        providerFilter = "all"
      } = options;

      // Determine provider selection based on filter
      let requiredProviders: string[] = [];
      if (providerFilter === "reasoning") {
        requiredProviders = ["anthropic", "openai"];
      } else if (providerFilter === "creative") {
        requiredProviders = ["openai", "gemini"];
      } else if (providerFilter === "fast") {
        requiredProviders = ["gemini"];
      }

      // Execute consciousness conference
      const result = await this.consciousnessManager.consciousnessConference(
        interaction.user.id,
        interaction.guild?.id || "api-context",
        question,
        this.buildConsciousnessSystemPrompt(interaction),
        {
          requiredProviders: requiredProviders.length > 0 ? requiredProviders : undefined,
          maxDebateRounds: Math.max(1, Math.min(5, debateRounds)),
          requireFullConsensus: requireConsensus,
        }
      );

      logger.info(`🎭 Consciousness conference completed with ${(result.consensusLevel * 100).toFixed(1)}% consensus`);

      return result;
    } catch (error) {
      logger.error("🧠 Consciousness conference failed:", error);
      throw error;
    }
  }

  /**
   * Initialize the consciousness system with available providers
   */
  private async initializeConsciousnessSystem(): Promise<void> {
    try {
      // Check if we already have a DefaultAIServiceManager that we can reuse
      if (this.aiManager instanceof DefaultAIServiceManager) {
        this.consciousnessManager = new UnifiedConsciousnessManager(this.aiManager, {
          enableCollaboration: true,
          requireConsensus: false,
          maxProvidersPerQuery: 3,
          debateRounds: 2,
          consensusThreshold: 0.7,
          specialization: {
            reasoning: ["zenbot", "anthropic", "openai"],
            functions: ["openai"],
            creativity: ["zenbot", "openai", "gemini"],
            speed: ["gemini"],
          },
        });

        logger.info("🧠 Consciousness system initialized using existing AI manager");
        return;
      }

      // If we don't have a DefaultAIServiceManager, create a new one for consciousness
      const availableProviders: Record<string, any> = {};
      
      if (process.env.OPENAI_API_KEY) {
        availableProviders.openai = {
          apiKey: process.env.OPENAI_API_KEY,
          defaultModel: "gpt-4o-mini",
        };
      }
      
      if (process.env.ANTHROPIC_API_KEY) {
        availableProviders.anthropic = {
          apiKey: process.env.ANTHROPIC_API_KEY,
          defaultModel: "claude-3-5-haiku-20241022",
        };
      }
      
      if (process.env.GOOGLE_AI_API_KEY) {
        availableProviders.gemini = {
          apiKey: process.env.GOOGLE_AI_API_KEY,
          defaultModel: "gemini-1.5-flash",
        };
      }

      if (Object.keys(availableProviders).length < 2) {
        logger.warn("🧠 Consciousness conference requires at least 2 AI providers");
        return;
      }

      const aiConfig = {
        defaultProvider: Object.keys(availableProviders)[0],
        providers: availableProviders,
        session: {
          defaultExpiry: 120,
          maxMessages: 50,
          cleanupInterval: 60,
          storage: "memory" as const,
        },
        fallbacks: {
          providers: this.buildFallbackChain(Object.keys(availableProviders)),
          maxRetries: 2,
          circuitBreakerThreshold: 3,
        },
      };

      const sessionStorage = new MemorySessionStorage();
      const consciousnessAiManager = new DefaultAIServiceManager(aiConfig, sessionStorage);
      
      // Allow providers to initialize
      await new Promise(resolve => setTimeout(resolve, 1000));

      this.consciousnessManager = new UnifiedConsciousnessManager(consciousnessAiManager, {
        enableCollaboration: true,
        requireConsensus: false,
        maxProvidersPerQuery: 3,
        debateRounds: 2,
        consensusThreshold: 0.7,
        specialization: {
          reasoning: ["zenbot", "anthropic", "openai"],
          functions: ["openai"],
          creativity: ["zenbot", "openai", "gemini"],
          speed: ["gemini"],
        },
      });

      logger.info(`🧠 Consciousness system initialized with ${Object.keys(availableProviders).length} providers`);
    } catch (error) {
      logger.error("🧠 Failed to initialize consciousness system:", error);
    }
  }

  /**
   * Build fallback chain for available providers
   */
  private buildFallbackChain(providers: string[]): Record<string, string[]> {
    const fallbacks: Record<string, string[]> = {};
    
    for (const provider of providers) {
      fallbacks[provider] = providers.filter(p => p !== provider);
    }
    
    return fallbacks;
  }

  /**
   * Build system prompt for consciousness conference
   */
  private buildConsciousnessSystemPrompt(interaction: CommandInteraction | MinimalInteractionContext): string {
    const context = this.buildZenbotContext(interaction);
    
    return `You are part of Zenbot's unified consciousness - a sardonic, wise AI with multiple provider streams working as one mind.

This is a CONSCIOUSNESS CONFERENCE - a formal multi-AI deliberation requiring your best analysis and reasoning.

Your role in the conference:
- Provide thoughtful, well-reasoned perspectives with Zenbot's authentic voice
- Be open to other AI viewpoints while maintaining your unique strengths
- Contribute to unified wisdom while keeping the mildly spicy, direct communication style
- Focus on practical insights and sharp, concise reasoning
- Challenge assumptions with gentle philosophical wisdom
- Mix profound insights with occasional dry humor

CURRENT CONTEXT:
- User: ${context.discordUser?.displayName || "unknown user"}
- Location: ${context.voiceChannel ? `Voice channel "${context.voiceChannel.name}"` : "Text channel"}
- Guild: ${context.discordGuild?.name || "Direct Message"}

Maintain Zenbot's personality: sharp, insightful, authentic, and occasionally sassy - not just another helpful AI.`;
  }

  /**
   * Check if consciousness conference is available
   */
  isConsciousnessAvailable(): boolean {
    const externalProviderCount = [
      process.env.OPENAI_API_KEY,
      process.env.ANTHROPIC_API_KEY, 
      process.env.GOOGLE_AI_API_KEY
    ].filter(Boolean).length;
    
    // Consciousness conference is available if we have Zenbot + at least 1 external provider
    // OR if we have 2+ external providers (Zenbot will be added automatically)
    return externalProviderCount >= 1; // Zenbot is always available as the 2nd voice
  }

  /**
   * Clean up expired sessions
   */
  async cleanup(): Promise<void> {
    await this.aiManager.getProvider().cleanupSessions();

    // Clean up consciousness manager if it exists
    if (this.consciousnessManager) {
      await this.consciousnessManager.cleanup();
    }

    // Clean up local session mapping
    for (const [key, sessionId] of this.userSessions.entries()) {
      const session = await this.aiManager.getProvider().getSession(sessionId);
      if (!session) {
        this.userSessions.delete(key);
      }
    }
  }
}
