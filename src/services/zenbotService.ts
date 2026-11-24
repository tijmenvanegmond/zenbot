/**
 * Zenbot Service (formerly Unified Zenyatta Service)
 * Provides concise, mildly spicy AI persona responses with conversation memory
 * Primary Zenbot persona service (all legacy UnifiedZenyattaService shims removed)
 */

import { CommandInteraction } from "discord.js";
import { RemarkType } from "../actions/entertainment/remarkAction";
import { getCuratedRemark } from "../voice/curatedRemarks";
import { formatQuoteForSpeech, INTRO_PAUSE } from "../utils/quoteFormat";

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
import {
  UnifiedConferenceManager,
  ConferenceResponse,
} from "./ai/unifiedConferenceManager";
import { MemorySessionStorage } from "./ai/storage/memoryStorage";
import { DefaultAIServiceManager } from "./ai/aiServiceManager";
import { validateVoiceChannel } from "../utils/commandHelpers";
import { ActionService } from "./actionService";
import { EnrichedQuote, RemarkResult } from "../types";
import { logger } from "../utils/logger";
import { randomUUID } from "crypto";
import {
  DEFAULT_GEMINI_MODEL,
  FAST_GEMINI_MODEL,
} from "./ai/providers/geminiProvider";

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
export class AIUnavailableError extends Error {
  constructor() {
    super("No AI provider configured");
    this.name = "AIUnavailableError";
  }
}

export class ZenbotService {
  private static instance: ZenbotService | null = null;
  // null when no AI provider is configured - AI-backed methods then throw
  // AIUnavailableError and callers fall back to curated (non-AI) content
  private aiManager: AIServiceManager | null;
  private actionService: ActionService;
  private conferenceManager: UnifiedConferenceManager | null = null;
  private personalityCache = new Map<string, string>();

  // Session management - maps user+context to session IDs
  private userSessions = new Map<string, string>();

  constructor(aiManager: AIServiceManager | null) {
    this.aiManager = aiManager;
    this.actionService = ActionService.getInstance();
  }

  /**
   * Initialize the global singleton instance (for backward compatibility)
   */
  static initialize(aiManager: AIServiceManager | null): void {
    if (!this.instance) {
      this.instance = new ZenbotService(aiManager);
      logger.info(
        aiManager
          ? "🧘 Zenbot Service initialized"
          : "🧘 Zenbot Service initialized without AI - using curated responses",
      );
    }
  }

  /**
   * Whether an AI provider is configured
   */
  isAIEnabled(): boolean {
    return this.aiManager !== null;
  }

  private requireAI(): AIServiceManager {
    if (!this.aiManager) {
      throw new AIUnavailableError();
    }
    return this.aiManager;
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
    instanceName?: string,
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
    contextType: "command" | "voice" | "api" = "command",
    personalityId: string = "zenbot-default",
  ): Promise<ZenbotSession> {
    const userId = interaction.user.id;
    const contextId = interaction.guild?.id || "dm";
    const sessionKey = `${userId}:${contextId}:${personalityId}`;

    let sessionId = this.userSessions.get(sessionKey);
    let session: AISession | null = null;

    if (sessionId) {
      session = await this.requireAI().getProvider().getSession(sessionId);
    }

    if (!session) {
      // Create new Zenyatta session
      const context = this.buildZenbotContext(interaction);

      session = await this.requireAI().createSession("Zenbot", {
        userId,
        contextId,
        systemPrompt: this.buildZenbotSystemPrompt(
          context,
          contextType,
          personalityId,
        ),
        maxHistoryMessages: 100,
        sessionExpiry: 1440, // 24 hours
        persistSession: true,
      });

      this.userSessions.set(sessionKey, session.id);
      logger.info(
        `🤖 Created new Zenbot session ${session.id} for user ${userId}`,
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
    updates: Partial<ZenbotSessionContext>,
  ): Promise<void> {
    const session = await this.getOrCreateSession(interaction);
    const currentContext = session.metadata.context;
    const newContext = { ...currentContext, ...updates };

    await this.requireAI().getProvider().updateSession(session.id, {
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
    },
    personalityId: string = "zenbot-default",
    excludeFunctions: string[] = [],
  ): Promise<UnifiedZenyattaResponse> {
    const session = await this.getOrCreateSession(
      interaction,
      "command",
      personalityId,
    );

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
      commandContext,
    );

    try {
      // Decide whether to attempt function calling
      const provider = this.requireAI().getProvider();
      let responseText: string;

      if (provider.supportsFunctions) {
        try {
          // Build available function definitions from actions
          const functions = this.actionService
            .getFunctionDefinitions(excludeFunctions)
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
            responseText = await this.requireAI().chat(
              session.id,
              contextualMessage,
            );
          }
        } catch (fcError) {
          logger.warn(
            "⚠️ Function calling path failed; falling back to standard chat:",
            fcError instanceof Error ? fcError.message : fcError,
          );
          responseText = await this.requireAI().chat(
            session.id,
            contextualMessage,
          );
        }
      } else {
        // Provider does not support functions
        responseText = await this.requireAI().chat(
          session.id,
          contextualMessage,
        );
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
        `💬 Zenbot responded to ${interaction.user.username} in session ${session.id}: "${responseText.substring(0, 100)}..."`,
      );
      return response;
    } catch (error) {
      // Rethrow so callers can use their own curated (non-AI) fallbacks
      // instead of speaking a generic error line
      logger.error("⚠️ Zenbot conversation failed:", error);
      throw error;
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
    },
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
      commandContext,
    );

    try {
      for await (const event of this.requireAI().chatStream(
        session.id,
        contextualMessage,
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
    const executedTTSActions = new Set<string>(); // Track TTS actions separately
    let rounds = 0;
    let aggregate = "";
    let anyActions = false;

    while (rounds < MAX_ROUNDS) {
      rounds++;
      const userMessage =
        rounds === 1
          ? initialMessage
          : "Continue if legitimate new actions remain.";

      const availableFunctions = functions.map((f) => f.name).join(", ");
      logger.info(
        `🔧 Function calling attempt ${rounds} for session ${sessionId} with functions: [${availableFunctions}]`,
      );

      const callStartTime = Date.now();
      const { response, functionCalls } = await provider.callFunctions(
        sessionId,
        userMessage,
        functions,
        {},
      );
      const callDuration = Date.now() - callStartTime;

      const calledFunctionNames =
        functionCalls?.map((call: any) => call.name).join(", ") || "none";
      logger.info(
        `🔧 Function call result (${callDuration}ms): called=[${calledFunctionNames}], response="${response?.substring(0, 100)}..."`,
      );

      if (response) {
        aggregate = aggregate ? `${aggregate}\n${response}` : response;
      }

      if (!functionCalls || functionCalls.length === 0) break;

      anyActions = true;

      for (const call of functionCalls) {
        const signature = `${call.name}:${JSON.stringify(call.arguments || {})}`;

        // Check for exact duplicates
        if (executedSignatures.has(signature)) {
          logger.warn(
            `🛑 Loop guard: repeated function call detected (${signature}). Aborting further execution.`,
          );
          rounds = MAX_ROUNDS; // force exit
          break;
        }

        // Special handling for TTS actions - prevent multiple TTS calls in same session
        const isTTSAction =
          call.name.includes("tts") ||
          call.name === "play_tts" ||
          call.name === "enhanced_tts" ||
          call.name === "speak";
        if (isTTSAction) {
          // For TTS actions, only allow ONE TTS call per function calling session
          const ttsActionType = call.name;

          if (executedTTSActions.has(ttsActionType)) {
            logger.warn(
              `🛑 TTS guard: preventing multiple TTS actions in same session (${ttsActionType}). Only one TTS call allowed per interaction.`,
            );
            continue; // Skip this call but don't abort the entire sequence
          }
          executedTTSActions.add(ttsActionType);
        }

        executedSignatures.add(signature);

        try {
          logger.info(
            `🔨 Executing function: ${call.name} with args: ${JSON.stringify(call.arguments || {}).substring(0, 200)}`,
          );
          const actionStartTime = Date.now();

          const result = await this.actionService.processAIFunctionCall(
            interaction as any,
            call.name,
            call.arguments || {},
          );

          const actionDuration = Date.now() - actionStartTime;
          const summary = result.success
            ? `${call.name} success${result.responseText ? `: ${result.responseText.substring(0, 140)}` : ""}`
            : `${call.name} failed: ${result.error}`;

          logger.info(
            `✅ Function ${call.name} completed in ${actionDuration}ms: ${summary.substring(0, 150)}`,
          );

          // Skip adding tool results to history for OpenAI to avoid conversation flow issues
          // OpenAI handles tool calling within the same callFunctions operation
          const provider = this.requireAI().getProvider();
          if (provider.name !== "openai") {
            await provider.addToHistory(sessionId, [
              {
                role: "tool",
                content: summary,
                metadata: {
                  functionName: call.name,
                  tool_call_id: call.id,
                },
              } as any,
            ]);
          }
        } catch (err) {
          logger.error(`❌ Action execution for '${call.name}' failed:`, err);
        }
      }

      if (rounds >= MAX_ROUNDS) {
        logger.warn(
          `🛑 Reached max function call rounds (${MAX_ROUNDS}) for session ${sessionId}.`,
        );
        break;
      }
    }

    logger.info(
      `🔧 Function calling complete: anyActions=${anyActions}, aggregate="${aggregate?.substring(0, 100)}..."`,
    );

    if (anyActions) {
      try {
        const wrap = await this.requireAI().chat(
          sessionId,
          "Provide your final response with full Zenbot personality - be concise but witty (≤240 chars), keep the best parts from your function call responses. No meta-commentary about actions taken.",
        );
        logger.info(`🔧 Final wrap: "${wrap?.substring(0, 100)}..."`);
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
   * Advice in Zenbot's voice: one direct call (no tools). With function
   * calling the AI used to speak one line (in a random voice) and reply with
   * another. Returns null if AI is unavailable or fails - callers fall back
   * to curated wisdom.
   */
  async getAdvice(
    topic?: string,
    urgency: "low" | "medium" | "high" = "medium",
  ): Promise<string | null> {
    const length =
      urgency === "high"
        ? "One or two short sentences - they're in a hurry."
        : "Two or three short sentences.";

    const prompt = `You are Zenbot, a dry, deadpan omnic monk bot in a Discord friend group. Someone asks for advice${topic ? ` about: ${topic}` : ""}.

Give genuinely useful advice, delivered with dry wit. It will be spoken out loud in voice chat.

Rules:
- ${length} At most 50 words, on a single line.
- Actually answer: give one concrete idea, not vague mysticism.
- Never start with "Ah". Never use: peak, masterpiece, humans, humanity, chuckles, sighs.
- Don't mention urgency levels or repeat the question back.
- No stage directions, asterisks, emojis or quotation marks.

Reply with only the advice.`;

    return this.generateSpokenLine(prompt, { label: "advice", maxWords: 60 });
  }

  /**
   * Get quote with conversation memory
   */
  async getQuote(
    interaction: CommandInteraction,
    theme?: string,
  ): Promise<UnifiedZenyattaResponse> {
    const message = theme
      ? `Please share a meaningful quote about ${theme}.`
      : `Please share an inspirational quote or piece of wisdom.`;

    return this.converse(
      interaction,
      message,
      {
        commandName: "quote",
        options: { theme },
      },
      "zenbot-default",
      ["conference"],
    );
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
    _interaction: CommandInteraction,
    type: RemarkType = RemarkType.POSITIVE,
    subject?: string,
    voiceChannelName?: string,
  ): Promise<RemarkResult> {
    const targetSubject = subject || "someone";

    const remarkLabel = this.getRemarkTypeDescription(type);

    // Without per-type tone, "mildly spicy" won and compliments came out as insults
    const toneByType: Partial<Record<RemarkType, string>> = {
      [RemarkType.POSITIVE]:
        "Genuinely kind: a real compliment, delivered dry. Not backhanded, no insult.",
      [RemarkType.ENCOURAGING]:
        "Genuinely supportive and uplifting, in a dry voice. No insult.",
      [RemarkType.WISE]: "Calm and sincere. A small piece of real wisdom.",
      [RemarkType.PHILOSOPHICAL]: "Thoughtful and wry, not mean.",
      [RemarkType.MYSTERIOUS]: "Cryptic and ominous, playful rather than mean.",
      [RemarkType.NEGATIVE]: "A lighthearted roast. Mildly spicy, never cruel.",
      [RemarkType.SARCASTIC]: "Dry sarcasm. Mildly spicy, never cruel.",
      [RemarkType.HUMOROUS]: "Playful and funny.",
    };
    const tone = toneByType[type] ?? "Dry and witty.";

    const prompt = `You are Zenbot, a dry, deadpan omnic monk bot hanging out in a Discord friend group${voiceChannelName ? ` (voice channel: "${voiceChannelName}")` : ""}.

Say ${remarkLabel} about ${targetSubject}. It will be spoken out loud in voice chat.

Tone: ${tone}

Rules:
- One line, at most 20 words. No hate, no slurs.
- Address or name ${targetSubject} directly.
- Never start with "Ah". Never use: peak, masterpiece, humans, humanity, chuckles.
- No stage directions, asterisks, emojis or quotation marks.

Reply with only the remark.`;

    // One direct call (no tools): with function calling, the AI used to call
    // speak with one line and then reply with a different one
    const text = await this.generateSpokenLine(prompt, {
      label: "remark",
      maxWords: 28,
    });
    return { text: text ?? getCuratedRemark(type, targetSubject) };
  }

  /**
   * One short line meant to be spoken: a single direct generation on the fast
   * model (no tools, no session) with a 10s timeout. Returns null when AI is
   * unavailable, slow, or the line fails validation - callers use curated
   * fallbacks then.
   */
  private async generateSpokenLine(
    prompt: string,
    { label, maxWords }: { label: string; maxWords: number },
  ): Promise<string | null> {
    try {
      const provider = this.requireAI().getProvider();
      const raw = await Promise.race([
        provider.generateText(prompt, {
          temperature: 1.0,
          maxTokens: 1000,
          ...(provider.name === "gemini" && { model: FAST_GEMINI_MODEL }),
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`${label} timed out`)), 10000),
        ),
      ]);

      const cleaned = (
        raw
          .split("\n")
          .map((line) => line.trim())
          .find(Boolean) ?? ""
      )
        .replace(/\*[^*]*\*|_[^_]*_/g, "") // *chuckles* / _sighs_
        .replace(/["“”]/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
      const tryHard = /^ah\b|\bpeak\b|masterpiece|humans?\b|humanity/i;

      if (wordCount >= 2 && wordCount <= maxWords && !tryHard.test(cleaned)) {
        return /[.!?…]$/.test(cleaned) ? cleaned : `${cleaned}.`;
      }
      logger.warn(`⚠️ Rejected ${label}: "${cleaned}"`);
    } catch (error) {
      if (!(error instanceof AIUnavailableError)) {
        logger.warn(`⚠️ ${label} generation failed, using fallback:`, error);
      }
    }
    return null;
  }
  // ===== QUOTE INTROS =====

  private recentQuoteIntros: string[] = [];

  private rememberQuoteIntro(intro: string): void {
    this.recentQuoteIntros = [intro, ...this.recentQuoteIntros].slice(0, 8);
  }

  private pickFallbackQuoteIntro(quote: EnrichedQuote): string {
    const firstSpeaker = quote.lines?.find((l) => l.speaker)?.speaker;
    const options = [
      "Entered into the record.",
      "From the archives.",
      "Submitted without comment.",
      "Someone wrote this down. On purpose.",
      "Exhibit A.",
      "This was said. Out loud.",
      "The archives remember.",
      "Context was not provided. Neither will I.",
      ...(firstSpeaker
        ? [`${firstSpeaker}, unprompted.`, `Nobody stopped ${firstSpeaker}.`]
        : []),
    ].filter((option) => !this.recentQuoteIntros.includes(option));

    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * Short deadpan lead-in spoken before a quote. One direct generation call
   * (no tools, no session) with a timeout, falling back to curated intros.
   */
  async generateQuoteIntro(quote: EnrichedQuote): Promise<string> {
    const quoteBlock = (quote.lines ?? [])
      .map((l) => (l.speaker ? `${l.speaker}: ${l.text}` : `(${l.text})`))
      .join("\n");

    const prompt = `You are Zenbot, a dry, deadpan omnic monk bot hanging out in a Discord friend group's voice chat. You're about to read a quote from their #quotes channel out loud.

Write ONE short lead-in (3-10 words) to say right before the quote.

The quote:
${quoteBlock || quote.content}

Rules:
- Deadpan and understated. The quote is the joke: set it up, never explain, rate or judge it.
- Never start with "Ah". Never use: peak, masterpiece, elegance, humans, humanity, philosophy, Aristotle, chuckles.
- No stage directions, asterisks, emojis or quotation marks.
- Don't repeat the quote or spoil its punchline.
- Must sound different from these recent ones: ${this.recentQuoteIntros.join(" | ") || "(none yet)"}

Tone examples (don't copy them): Entered into the record without objection. / Osha, unprompted, at 2am. / Nobody asked for context. Here it is anyway. / The archives remember this one.

Reply with only the lead-in.`;

    const intro = await this.generateSpokenLine(prompt, {
      label: "quote intro",
      maxWords: 14,
    });
    const finalIntro = intro ?? this.pickFallbackQuoteIntro(quote);
    this.rememberQuoteIntro(finalIntro);
    return finalIntro;
  }

  /**
   * Full spoken text for a quote: intro, a pause, then the quote itself
   */
  async createEnhancedQuote(
    _interaction: CommandInteraction | MinimalInteractionContext,
    quote: EnrichedQuote,
  ): Promise<string> {
    const intro = await this.generateQuoteIntro(quote);
    return `${intro}${INTRO_PAUSE} ${formatQuoteForSpeech(quote)}`;
  }

  // ===== UTILITY METHODS =====

  private buildZenbotContext(
    interaction: CommandInteraction | MinimalInteractionContext,
  ): ZenbotSessionContext {
    // Check if this is a full CommandInteraction or minimal context
    const isFullInteraction = "options" in interaction;
    const voiceValidation = isFullInteraction
      ? validateVoiceChannel(interaction as CommandInteraction)
      : { isValid: false, member: null };

    // For voice interactions, the channel IS the voice channel
    const isVoiceInteraction =
      !isFullInteraction &&
      interaction.channel &&
      "members" in (interaction.channel as any);

    // Defensive channel name extraction
    let channelName = "Unknown Channel";
    if (interaction.channel) {
      // Check if channel has a name property (most channel types do, except DMChannel)
      if (
        "name" in interaction.channel &&
        typeof (interaction.channel as any).name === "string"
      ) {
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
    contextType: string,
    personalityId: string = "zenbot-default",
  ): string {
    // Load personality from external file - single source of truth
    const personalityTemplate = this.loadZenbotPersonality(personalityId);

    return `${personalityTemplate}

CURRENT CONTEXT:
- User: ${context.discordUser?.displayName || "unknown user"}
- Location: ${context.voiceChannel ? `Voice channel "${context.voiceChannel.name}" (${context.voiceChannel.memberCount} members)` : "Text channel"}
- Interaction type: ${contextType}

VOICE ADAPTATION:
- ${context.voiceChannel ? "In voice: you may add a single dramatic pause using an ellipsis once." : "In text: be extra tight and skip performative fluff."}

VOICE CHANNEL MANAGEMENT:
- If you want to speak but there's no voice channel context, call 'voice_channel_control' with action 'join' FIRST
- Then call 'speak' to deliver your response
- Always join before speaking when voice output is desired but no voice channel is available`;
  }

  private loadZenbotPersonality(
    personalityId: string = "zenbot-default",
  ): string {
    const fs = require("fs");
    const path = require("path");

    const personalityPath = path.join(
      process.cwd(),
      "personalities",
      `${personalityId}.md`,
    );
    return fs.readFileSync(personalityPath, "utf8");
  }

  private buildContextualMessage(
    interaction: CommandInteraction | MinimalInteractionContext,
    userMessage: string,
    commandContext?: { commandName: string; options?: Record<string, any> },
  ): string {
    const context = this.buildZenbotContext(interaction);
    const timeOfDay = this.getTimeOfDay();

    const contextInfo = [];

    // Temporal context
    contextInfo.push(`[Time: ${timeOfDay}]`);

    // Command context
    if (commandContext) {
      contextInfo.push(
        `[Command: /${commandContext.commandName}${commandContext.options ? ` ${JSON.stringify(commandContext.options)}` : ""}]`,
      );
    }

    // Voice status update
    if (context.voiceChannel) {
      contextInfo.push(
        `[Voice: ${context.voiceChannel.memberCount} members in "${context.voiceChannel.name}"]`,
      );
    } else {
      // If not in voice, we're in Discord text - enforce brevity
      contextInfo.push(
        `[Discord Text: Keep response ≤240 chars unless user explicitly asks for expansion]`,
      );
    }

    return `${contextInfo.join(" ")}\n\n${userMessage}`;
  }

  private shouldUseVoice(
    interaction: CommandInteraction | MinimalInteractionContext,
  ): boolean {
    // Check if this is a full CommandInteraction or minimal context
    const isFullInteraction = "options" in interaction;
    if (!isFullInteraction) return false; // API calls don't use voice by default

    const voiceValidation = validateVoiceChannel(
      interaction as CommandInteraction,
    );
    return voiceValidation.isValid;
  }

  private detectCurrentMood(
    messages: any[],
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
    text: string,
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
    if (!this.aiManager) {
      return {
        activeSessions: 0,
        totalMessages: 0,
        aiProvider: "none",
        aiProviderHealth: false,
      };
    }

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

  // ===== CONFERENCE =====

  /**
   * Convene a multi-AI conference for complex questions
   */
  async conference(
    interaction: CommandInteraction | MinimalInteractionContext,
    question: string,
    options: {
      requireConsensus?: boolean;
      debateRounds?: number;
      maxProviders?: number;
      providerFilter?: "all" | "reasoning" | "creative" | "fast";
    } = {},
  ): Promise<ConferenceResponse> {
    try {
      logger.info(`🧠 Starting conference: "${question.substring(0, 100)}..."`);

      // Initialize consciousness system if not already done
      if (!this.conferenceManager) {
        await this.initializeConferenceSystem();
      }

      if (!this.conferenceManager) {
        throw new Error(
          "Consciousness system unavailable - no AI providers configured",
        );
      }

      const {
        requireConsensus = false,
        debateRounds = 2,
        maxProviders = 3,
        providerFilter = "all",
      } = options;

      // Determine provider selection based on filter
      let requiredProviders: string[] = [];
      if (providerFilter === "reasoning") {
        requiredProviders = ["anthropic", "gemini"];
      } else if (providerFilter === "creative") {
        requiredProviders = ["gemini", "openai"];
      } else if (providerFilter === "fast") {
        requiredProviders = ["gemini"];
      }

      // Execute conference
      const result = await this.conferenceManager.conference(
        interaction.user.id,
        interaction.guild?.id || "api-context",
        question,
        this.buildConferenceSystemPrompt(interaction),
        {
          requiredProviders:
            requiredProviders.length > 0 ? requiredProviders : undefined,
          maxDebateRounds: Math.max(1, Math.min(5, debateRounds)),
          requireFullConsensus: requireConsensus,
        },
      );

      logger.info(
        `🎭 Conference completed with ${(result.consensusLevel * 100).toFixed(1)}% consensus`,
      );

      return result;
    } catch (error) {
      logger.error("🧠 Conference failed:", error);
      throw error;
    }
  }

  /**
   * Initialize the conference system with available providers
   */
  private async initializeConferenceSystem(): Promise<void> {
    try {
      // Check if we already have a DefaultAIServiceManager that we can reuse
      if (this.aiManager instanceof DefaultAIServiceManager) {
        this.conferenceManager = new UnifiedConferenceManager(this.aiManager, {
          enableCollaboration: true,
          requireConsensus: false,
          maxProvidersPerQuery: 3,
          debateRounds: 2,
          consensusThreshold: 0.7,
          specialization: {
            reasoning: ["zenbot", "anthropic", "gemini"],
            functions: ["openai"],
            creativity: ["zenbot", "gemini", "openai"],
            speed: ["gemini"],
          },
        });

        logger.info(
          "🧠 Consciousness system initialized using existing AI manager",
        );
        return;
      }

      // If we don't have a DefaultAIServiceManager, create a new one for consciousness
      const availableProviders: Record<string, any> = {};

      // Prefer Gemini first
      if (process.env.GOOGLE_AI_API_KEY) {
        availableProviders.gemini = {
          apiKey: process.env.GOOGLE_AI_API_KEY,
          defaultModel: DEFAULT_GEMINI_MODEL,
        };
      }

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

      if (Object.keys(availableProviders).length < 2) {
        logger.warn("🧠 Conference requires at least 2 AI providers");
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
      const consciousnessAiManager = new DefaultAIServiceManager(
        aiConfig,
        sessionStorage,
      );

      // Allow providers to initialize
      await new Promise((resolve) => setTimeout(resolve, 1000));

      this.conferenceManager = new UnifiedConferenceManager(
        consciousnessAiManager,
        {
          enableCollaboration: true,
          requireConsensus: false,
          maxProvidersPerQuery: 3,
          debateRounds: 2,
          consensusThreshold: 0.7,
          specialization: {
            reasoning: ["zenbot", "anthropic", "gemini"],
            functions: ["openai"],
            creativity: ["zenbot", "gemini", "openai"],
            speed: ["gemini"],
          },
        },
      );

      logger.info(
        `🧠 Consciousness system initialized with ${Object.keys(availableProviders).length} providers`,
      );
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
      fallbacks[provider] = providers.filter((p) => p !== provider);
    }

    return fallbacks;
  }

  /**
   * Build system prompt for conference
   */
  private buildConferenceSystemPrompt(
    interaction: CommandInteraction | MinimalInteractionContext,
  ): string {
    const context = this.buildZenbotContext(interaction);

    return `You are part of Zenbot's unified consciousness - a sardonic, wise AI with multiple provider streams working as one mind.

This is a CONFERENCE - a formal multi-AI deliberation requiring your best analysis and reasoning.

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
   * Check if conference is available
   */
  isConferenceAvailable(): boolean {
    if (!this.aiManager) {
      return false;
    }

    const externalProviderCount = [
      process.env.OPENAI_API_KEY,
      process.env.ANTHROPIC_API_KEY,
      process.env.GOOGLE_AI_API_KEY,
    ].filter(Boolean).length;

    // Conference is available if we have Zenbot + at least 1 external provider
    // OR if we have 2+ external providers (Zenbot will be added automatically)
    return externalProviderCount >= 1; // Zenbot is always available as the 2nd voice
  }

  /**
   * Clean up expired sessions
   */
  async cleanup(): Promise<void> {
    if (!this.aiManager) {
      return;
    }

    await this.requireAI().getProvider().cleanupSessions();

    // Clean up consciousness manager if it exists
    if (this.conferenceManager) {
      await this.conferenceManager.cleanup();
    }

    // Clean up local session mapping
    for (const [key, sessionId] of this.userSessions.entries()) {
      const session = await this.requireAI()
        .getProvider()
        .getSession(sessionId);
      if (!session) {
        this.userSessions.delete(key);
      }
    }
  }
}
