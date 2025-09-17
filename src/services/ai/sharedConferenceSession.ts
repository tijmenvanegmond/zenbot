/**
 * Shared Conference Session
 * Enables true unified memory and collaboration across multiple AI providers
 */

import { Message, AISession, SessionMetadata } from "./types";
import { logger } from "../../utils/logger";
import { randomUUID } from "crypto";

export interface ProviderContribution {
  providerId: string;
  providerName: string;
  timestamp: Date;
  message: Message;
  confidence: number; // 0-1 how confident this provider is in its response
  reasoning?: string; // Why this provider chose this response
  suggestedActions?: string[]; // Actions this provider suggests
}

export interface ConferenceState {
  currentTopic: string;
  consensusLevel: number; // 0-1 how much providers agree
  activeProviders: string[];
  lastSynthesis: Date;
  workingMemory: Record<string, any>; // Shared context all providers can access
  collaborationHistory: ProviderContribution[];
}

export interface SharedConferenceSession extends AISession {
  conference: ConferenceState;
  providerSessions: Map<string, string>; // Maps provider name to their individual session ID
  lastActiveProvider: string;
  collaborationEnabled: boolean;
  synthesisRequired: boolean;
}

export class SharedConferenceManager {
  private sessions = new Map<string, SharedConferenceSession>();
  private providers = new Map<string, any>(); // Store provider instances

  constructor() {
    logger.info("🧠 Shared Conference Manager initialized");
  }

  /**
   * Register an AI provider with the conference system
   */
  registerProvider(
    providerId: string,
    providerName: string,
    providerInstance: any,
  ): void {
    this.providers.set(providerId, {
      name: providerName,
      instance: providerInstance,
      lastActivity: new Date(),
      contributionCount: 0,
    });
    logger.info(
      `🤖 Registered provider ${providerName} (${providerId}) with conference system`,
    );
  }

  /**
   * Create a new shared conference session
   */
  async createSharedSession(
    userId: string,
    contextId: string,
    initialMetadata: SessionMetadata,
    enabledProviders: string[] = [],
  ): Promise<SharedConferenceSession> {
    const sessionId = randomUUID();

    // Create individual sessions for each provider
    const providerSessions = new Map<string, string>();
    const activeProviders =
      enabledProviders && enabledProviders.length > 0
        ? enabledProviders
        : Array.from(this.providers.keys());

    for (const providerId of activeProviders) {
      const provider = this.providers.get(providerId);
      if (provider) {
        try {
          const individualSession = await provider.instance.createSession({
            userId,
            contextId,
            systemPrompt: this.buildSharedSystemPrompt(
              initialMetadata,
              providerId,
            ),
            maxHistoryMessages: 50, // Smaller individual histories since we have shared memory
            persistSession: true,
          });
          providerSessions.set(providerId, individualSession.id);
          logger.info(
            `✅ Created individual session for ${provider.name}: ${individualSession.id}`,
          );
        } catch (error) {
          logger.error(
            `❌ Failed to create session for provider ${provider.name}:`,
            error,
          );
        }
      }
    }

    const sharedSession: SharedConferenceSession = {
      id: sessionId,
      userId,
      contextId,
      messages: [],
      metadata: {
        ...initialMetadata,
        provider: "shared-conference",
        model: "multi-provider-unified",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 1440 * 60 * 1000), // 24 hours
      conference: {
        currentTopic: "general conversation",
        consensusLevel: 1.0,
        activeProviders: Array.from(providerSessions.keys()),
        lastSynthesis: new Date(),
        workingMemory: {
          conversationContext: initialMetadata.context || {},
          sharedKnowledge: {},
          pendingQuestions: [],
        },
        collaborationHistory: [],
      },
      providerSessions,
      lastActiveProvider: activeProviders[0] || "",
      collaborationEnabled: true,
      synthesisRequired: false,
    };

    this.sessions.set(sessionId, sharedSession);
    logger.info(
      `🧠 Created shared conference session ${sessionId} with ${providerSessions.size} providers`,
    );

    return sharedSession;
  }

  /**
   * Get shared session by ID
   */
  getSharedSession(sessionId: string): SharedConferenceSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Add a message to shared conference (visible to all providers)
   */
  async addSharedMessage(sessionId: string, message: Message): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Shared session ${sessionId} not found`);
    }

    // Add to shared memory
    session.messages.push(message);
    session.updatedAt = new Date();

    // Sync to all individual provider sessions
    for (const [providerId, providerSessionId] of session.providerSessions) {
      const provider = this.providers.get(providerId);
      if (provider) {
        try {
          await provider.instance.addToHistory(providerSessionId, [message]);
        } catch (error) {
          logger.warn(
            `⚠️ Failed to sync message to provider ${provider.name}:`,
            error,
          );
        }
      }
    }

    logger.debug(
      `🔄 Synced message to ${session.providerSessions.size} providers in session ${sessionId}`,
    );
  }

  /**
   * Collaborative conversation where multiple providers contribute
   */
  async collaborativeConverse(
    sessionId: string,
    userMessage: string,
    options: {
      requireConsensus?: boolean;
      maxProviders?: number;
      debateRounds?: number;
    } = {},
  ): Promise<{
    finalResponse: string;
    contributions: ProviderContribution[];
    consensusLevel: number;
    synthesisReasoning: string;
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Shared session ${sessionId} not found`);
    }

    const {
      requireConsensus = false,
      maxProviders = 3,
      debateRounds = 1,
    } = options;

    // Add user message to shared memory
    await this.addSharedMessage(sessionId, {
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    });

    const contributions: ProviderContribution[] = [];

    // Phase 1: Initial provider responses
    const activeProviders = Array.from(
      session.providerSessions.entries(),
    ).slice(0, maxProviders);

    for (const [providerId, providerSessionId] of activeProviders) {
      const provider = this.providers.get(providerId);
      if (!provider) continue;

      try {
        const response = await provider.instance.continueConversation(
          providerSessionId,
          userMessage,
        );

        const contribution: ProviderContribution = {
          providerId,
          providerName: provider.name,
          timestamp: new Date(),
          message: {
            role: "assistant",
            content: response,
            timestamp: new Date(),
            metadata: { provider: provider.name },
          },
          confidence: this.calculateConfidence(response),
          reasoning: `${provider.name} initial response`,
        };

        contributions.push(contribution);
        session.conference.collaborationHistory.push(contribution);

        logger.info(
          `💭 ${provider.name} contributed: "${response.substring(0, 100)}..."`,
        );
      } catch (error) {
        logger.error(
          `❌ Provider ${provider.name} failed to contribute:`,
          error,
        );
      }
    }

    // Phase 2: Cross-provider awareness and debate (if multiple rounds)
    if (debateRounds > 1 && contributions.length > 1) {
      await this.facilitateDebate(session, contributions, debateRounds - 1);
    }

    // Phase 3: Synthesis and consensus
    const synthesis = await this.synthesizeContributions(
      session,
      contributions,
      requireConsensus,
    );

    // Add final response to shared memory
    await this.addSharedMessage(sessionId, {
      role: "assistant",
      content: synthesis.finalResponse,
      timestamp: new Date(),
      metadata: {
        synthesized: true,
        consensusLevel: synthesis.consensusLevel,
        contributors: contributions.map((c) => c.providerName),
      },
    });

    session.conference.consensusLevel = synthesis.consensusLevel;
    session.conference.lastSynthesis = new Date();

    return {
      finalResponse: synthesis.finalResponse,
      contributions,
      consensusLevel: synthesis.consensusLevel,
      synthesisReasoning: synthesis.reasoning,
    };
  }

  /**
   * Enable providers to debate and refine their positions (but preserve Zenbot's natural voice)
   */
  private async facilitateDebate(
    session: SharedConferenceSession,
    initialContributions: ProviderContribution[],
    rounds: number,
  ): Promise<void> {
    for (let round = 0; round < rounds; round++) {
      logger.info(`🎭 Starting debate round ${round + 1}/${rounds}`);

      // Let each provider see others' contributions and respond naturally
      for (const [providerId, providerSessionId] of session.providerSessions) {
        const provider = this.providers.get(providerId);
        if (!provider) continue;

        // Build summary of other providers' contributions
        const otherContributions = initialContributions
          .filter((c) => c.providerId !== providerId)
          .map((c) => `${c.providerName}: "${c.message.content}"`)
          .join("\n");

        if (otherContributions) {
          let debatePrompt: string;

          if (providerId === "zenbot") {
            // Let Zenbot be naturally dismissive/critical
            debatePrompt = `Other AIs said:\n${otherContributions}\n\nYour thoughts?`;
          } else {
            // Standard debate prompt for other providers
            debatePrompt = `Other AI perspectives:\n${otherContributions}\n\nYour response or refinement?`;
          }

          try {
            const refinedResponse =
              await provider.instance.continueConversation(
                providerSessionId,
                debatePrompt,
              );

            // Update the original contribution with refined response
            const originalContribution = initialContributions.find(
              (c) => c.providerId === providerId,
            );
            if (originalContribution) {
              originalContribution.message.content = refinedResponse;
              originalContribution.reasoning += ` (natural response round ${round + 1})`;
              originalContribution.timestamp = new Date();
            }

            logger.info(
              `🔄 ${provider.name} ${providerId === "zenbot" ? "critiqued" : "refined"} their position after debate`,
            );
          } catch (error) {
            logger.warn(
              `⚠️ Provider ${provider.name} failed to participate in debate:`,
              error,
            );
          }
        }
      }
    }
  }

  /**
   * Synthesize multiple provider contributions into a unified response
   */
  private async synthesizeContributions(
    session: SharedConferenceSession,
    contributions: ProviderContribution[],
    requireConsensus: boolean,
  ): Promise<{
    finalResponse: string;
    consensusLevel: number;
    reasoning: string;
  }> {
    if (contributions.length === 0) {
      return {
        finalResponse: "No providers were able to respond.",
        consensusLevel: 0,
        reasoning: "No contributions to synthesize",
      };
    }

    if (contributions.length === 1) {
      return {
        finalResponse: contributions[0].message.content,
        consensusLevel: contributions[0].confidence,
        reasoning: `Single provider response from ${contributions[0].providerName}`,
      };
    }

    // Calculate consensus level based on response similarity and confidence
    const consensusLevel = this.calculateConsensusLevel(contributions);

    // Always let Zenbot make the final decision regardless of consensus
    // Consensus level is still calculated for transparency but doesn't control synthesis
    return await this.createUnifiedResponse(
      session,
      contributions,
      consensusLevel,
    );
  }

  /**
   * Create a unified response with Zenbot as the final decision-maker
   */
  private async createUnifiedResponse(
    session: SharedConferenceSession,
    contributions: ProviderContribution[],
    consensusLevel: number,
  ): Promise<{
    finalResponse: string;
    consensusLevel: number;
    reasoning: string;
  }> {
    // Always prioritize Zenbot as the final decision-maker if available
    const zenbotContribution = contributions.find(
      (c) => c.providerId === "zenbot",
    );
    const zenbotProvider = this.providers.get("zenbot");

    if (zenbotContribution && zenbotProvider) {
      try {
        // Get other AI perspectives (excluding Zenbot's initial response)
        const otherContributions = contributions.filter(
          (c) => c.providerId !== "zenbot",
        );

        const zenbotSessionId = session.providerSessions.get("zenbot");
        if (!zenbotSessionId) {
          throw new Error("Zenbot session not found");
        }

        if (otherContributions.length > 0) {
          // Let Zenbot respond to other AIs naturally - NO synthesis pressure
          const contributionSummary = otherContributions
            .map((c) => `${c.providerName}: "${c.message.content}"`)
            .join("\n\n");

          const naturalPrompt = `Other AIs weighed in:\n\n${contributionSummary}\n\nYour take?`;

          const zenbotResponse =
            await zenbotProvider.instance.continueConversation(
              zenbotSessionId,
              naturalPrompt,
            );

          return {
            finalResponse: zenbotResponse,
            consensusLevel,
            reasoning: `Zenbot's natural response to ${otherContributions.length} AI perspectives`,
          };
        } else {
          // Only Zenbot responded, use its response directly
          return {
            finalResponse: zenbotContribution.message.content,
            consensusLevel: zenbotContribution.confidence,
            reasoning: "Zenbot's sole perspective",
          };
        }
      } catch (error) {
        logger.error(
          "❌ Failed to get Zenbot's natural response, falling back:",
          error,
        );
      }
    }

    // Fallback: Use most confident provider (if Zenbot unavailable)
    const bestProvider = contributions.reduce((best, current) =>
      current.confidence > best.confidence ? current : best,
    );

    const provider = this.providers.get(bestProvider.providerId);
    if (!provider) {
      return {
        finalResponse: bestProvider.message.content,
        consensusLevel,
        reasoning: "Fallback to best single contribution (Zenbot unavailable)",
      };
    }

    try {
      const contributionSummary = contributions
        .map((c) => `${c.providerName}: "${c.message.content}"`)
        .join("\n\n");

      const synthesisPrompt = `Acting as the primary decision-maker, review these AI perspectives and form YOUR definitive response:

${contributionSummary}

Provide your final position incorporating the best insights while maintaining decisive authority. Don't just synthesize - decide what's right.`;

      const providerSessionId = session.providerSessions.get(
        bestProvider.providerId,
      );
      if (!providerSessionId) {
        throw new Error("Provider session not found");
      }

      const unifiedResponse = await provider.instance.continueConversation(
        providerSessionId,
        synthesisPrompt,
      );

      return {
        finalResponse: unifiedResponse,
        consensusLevel,
        reasoning: `Fallback synthesis by ${provider.name} (Zenbot unavailable) incorporating ${contributions.length} perspectives`,
      };
    } catch (error) {
      logger.error(
        "❌ Failed to create unified response, falling back to best contribution:",
        error,
      );
      return {
        finalResponse: bestProvider.message.content,
        consensusLevel,
        reasoning: `Synthesis failed, used best single contribution from ${bestProvider.providerName}`,
      };
    }
  }

  /**
   * Present multiple perspectives when consensus is low
   */
  private presentMultiplePerspectives(
    contributions: ProviderContribution[],
    consensusLevel: number,
  ): {
    finalResponse: string;
    consensusLevel: number;
    reasoning: string;
  } {
    const perspectives = contributions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3) // Top 3 most confident
      .map((c, i) => `**${c.providerName}**: ${c.message.content}`)
      .join("\n\n");

    return {
      finalResponse: `Multiple AI perspectives on this (consensus: ${(consensusLevel * 100).toFixed(0)}%):\n\n${perspectives}`,
      consensusLevel,
      reasoning: `Low consensus (${consensusLevel.toFixed(2)}), presenting multiple perspectives`,
    };
  }

  /**
   * Calculate confidence level for a response
   */
  private calculateConfidence(response: string): number {
    // Simple heuristic - could be made more sophisticated
    let confidence = 0.5;

    // Longer responses tend to be more confident
    if (response.length > 100) confidence += 0.1;
    if (response.length > 200) confidence += 0.1;

    // Certain phrases indicate high/low confidence
    const lowConfidenceWords = [
      "maybe",
      "possibly",
      "might",
      "unclear",
      "uncertain",
    ];
    const highConfidenceWords = [
      "definitely",
      "certainly",
      "clearly",
      "obviously",
    ];

    const lowerResponse = response.toLowerCase();
    lowConfidenceWords.forEach((word) => {
      if (lowerResponse.includes(word)) confidence -= 0.1;
    });

    highConfidenceWords.forEach((word) => {
      if (lowerResponse.includes(word)) confidence += 0.1;
    });

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Calculate consensus level between multiple contributions
   */
  private calculateConsensusLevel(
    contributions: ProviderContribution[],
  ): number {
    if (contributions.length < 2) return 1.0;

    // Simple similarity calculation based on common themes/words
    // In a real implementation, you might use semantic similarity models
    const responses = contributions.map((c) => c.message.content.toLowerCase());
    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < responses.length; i++) {
      for (let j = i + 1; j < responses.length; j++) {
        const similarity = this.calculateTextSimilarity(
          responses[i],
          responses[j],
        );
        totalSimilarity += similarity;
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  /**
   * Simple text similarity calculation
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(/\s+/).filter((w) => w.length > 3));
    const words2 = new Set(text2.split(/\s+/).filter((w) => w.length > 3));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Build system prompt for shared conference providers
   */
  private buildSharedSystemPrompt(
    metadata: SessionMetadata,
    providerId: string,
  ): string {
    const basePrompt = metadata.systemPrompt || "";

    // Special handling for Zenbot to preserve authentic personality
    if (providerId === "zenbot") {
      return basePrompt; // Use pure Zenbot personality, no conference contamination
    }

    return `${basePrompt}

CONFERENCE MODE:
You are contributing to a multi-AI discussion. Be authentic to your AI provider's strengths while engaging with other perspectives.

Keep your natural voice - don't over-collaborate or synthesize unnecessarily.`;
  }

  /**
   * Clean up expired sessions
   */
  async cleanup(): Promise<number> {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions) {
      if (session.expiresAt && session.expiresAt.getTime() < now) {
        // Clean up individual provider sessions
        for (const [
          providerId,
          providerSessionId,
        ] of session.providerSessions) {
          const provider = this.providers.get(providerId);
          if (provider) {
            try {
              await provider.instance.deleteSession(providerSessionId);
            } catch (error) {
              logger.warn(
                `⚠️ Failed to cleanup provider session ${providerSessionId}:`,
                error,
              );
            }
          }
        }

        this.sessions.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(
        `🧹 Cleaned up ${cleaned} expired shared conference sessions`,
      );
    }

    return cleaned;
  }

  /**
   * Get statistics about the shared conference system
   */
  getStats(): {
    activeSessions: number;
    totalProviders: number;
    totalContributions: number;
    averageConsensusLevel: number;
  } {
    const activeSessions = this.sessions.size;
    const totalProviders = this.providers.size;

    let totalContributions = 0;
    let totalConsensus = 0;
    let sessionsWithConsensus = 0;

    for (const session of this.sessions.values()) {
      totalContributions += session.conference.collaborationHistory.length;
      if (session.conference.consensusLevel > 0) {
        totalConsensus += session.conference.consensusLevel;
        sessionsWithConsensus++;
      }
    }

    return {
      activeSessions,
      totalProviders,
      totalContributions,
      averageConsensusLevel:
        sessionsWithConsensus > 0 ? totalConsensus / sessionsWithConsensus : 0,
    };
  }
}
