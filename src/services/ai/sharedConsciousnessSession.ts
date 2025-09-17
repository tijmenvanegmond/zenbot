/**
 * Shared Consciousness Session
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

export interface ConsciousnessState {
  currentTopic: string;
  consensusLevel: number; // 0-1 how much providers agree
  activeProviders: string[];
  lastSynthesis: Date;
  workingMemory: Record<string, any>; // Shared context all providers can access
  collaborationHistory: ProviderContribution[];
}

export interface SharedConsciousnessSession extends AISession {
  consciousness: ConsciousnessState;
  providerSessions: Map<string, string>; // Maps provider name to their individual session ID
  lastActiveProvider: string;
  collaborationEnabled: boolean;
  synthesisRequired: boolean;
}

export class SharedConsciousnessManager {
  private sessions = new Map<string, SharedConsciousnessSession>();
  private providers = new Map<string, any>(); // Store provider instances
  
  constructor() {
    logger.info("🧠 Shared Consciousness Manager initialized");
  }

  /**
   * Register an AI provider with the consciousness system
   */
  registerProvider(providerId: string, providerName: string, providerInstance: any): void {
    this.providers.set(providerId, {
      name: providerName,
      instance: providerInstance,
      lastActivity: new Date(),
      contributionCount: 0,
    });
    logger.info(`🤖 Registered provider ${providerName} (${providerId}) with consciousness system`);
  }

  /**
   * Create a new shared consciousness session
   */
  async createSharedSession(
    userId: string,
    contextId: string,
    initialMetadata: SessionMetadata,
    enabledProviders: string[] = []
  ): Promise<SharedConsciousnessSession> {
    const sessionId = randomUUID();
    
    // Create individual sessions for each provider
    const providerSessions = new Map<string, string>();
    const activeProviders = enabledProviders && enabledProviders.length > 0 
      ? enabledProviders 
      : Array.from(this.providers.keys());


    for (const providerId of activeProviders) {
      const provider = this.providers.get(providerId);
      if (provider) {
        try {
          const individualSession = await provider.instance.createSession({
            userId,
            contextId,
            systemPrompt: this.buildSharedSystemPrompt(initialMetadata, providerId),
            maxHistoryMessages: 50, // Smaller individual histories since we have shared memory
            persistSession: true,
          });
          providerSessions.set(providerId, individualSession.id);
          logger.info(`✅ Created individual session for ${provider.name}: ${individualSession.id}`);
        } catch (error) {
          logger.error(`❌ Failed to create session for provider ${provider.name}:`, error);
        }
      }
    }

    const sharedSession: SharedConsciousnessSession = {
      id: sessionId,
      userId,
      contextId,
      messages: [],
      metadata: {
        ...initialMetadata,
        provider: "shared-consciousness",
        model: "multi-provider-unified",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 1440 * 60 * 1000), // 24 hours
      consciousness: {
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
    logger.info(`🧠 Created shared consciousness session ${sessionId} with ${providerSessions.size} providers`);
    
    return sharedSession;
  }

  /**
   * Get shared session by ID
   */
  getSharedSession(sessionId: string): SharedConsciousnessSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Add a message to shared consciousness (visible to all providers)
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
          logger.warn(`⚠️ Failed to sync message to provider ${provider.name}:`, error);
        }
      }
    }

    logger.debug(`🔄 Synced message to ${session.providerSessions.size} providers in session ${sessionId}`);
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
    } = {}
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

    const { requireConsensus = false, maxProviders = 3, debateRounds = 1 } = options;

    // Add user message to shared memory
    await this.addSharedMessage(sessionId, {
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    });

    const contributions: ProviderContribution[] = [];
    
    // Phase 1: Initial provider responses
    const activeProviders = Array.from(session.providerSessions.entries())
      .slice(0, maxProviders);

    for (const [providerId, providerSessionId] of activeProviders) {
      const provider = this.providers.get(providerId);
      if (!provider) continue;

      try {
        const response = await provider.instance.continueConversation(
          providerSessionId,
          userMessage
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
        session.consciousness.collaborationHistory.push(contribution);

        logger.info(`💭 ${provider.name} contributed: "${response.substring(0, 100)}..."`);
      } catch (error) {
        logger.error(`❌ Provider ${provider.name} failed to contribute:`, error);
      }
    }

    // Phase 2: Cross-provider awareness and debate (if multiple rounds)
    if (debateRounds > 1 && contributions.length > 1) {
      await this.facilitateDebate(session, contributions, debateRounds - 1);
    }

    // Phase 3: Synthesis and consensus
    const synthesis = await this.synthesizeContributions(session, contributions, requireConsensus);
    
    // Add final response to shared memory
    await this.addSharedMessage(sessionId, {
      role: "assistant", 
      content: synthesis.finalResponse,
      timestamp: new Date(),
      metadata: { 
        synthesized: true,
        consensusLevel: synthesis.consensusLevel,
        contributors: contributions.map(c => c.providerName),
      },
    });

    session.consciousness.consensusLevel = synthesis.consensusLevel;
    session.consciousness.lastSynthesis = new Date();
    
    return {
      finalResponse: synthesis.finalResponse,
      contributions,
      consensusLevel: synthesis.consensusLevel,
      synthesisReasoning: synthesis.reasoning,
    };
  }

  /**
   * Enable providers to debate and refine their positions
   */
  private async facilitateDebate(
    session: SharedConsciousnessSession, 
    initialContributions: ProviderContribution[],
    rounds: number
  ): Promise<void> {
    for (let round = 0; round < rounds; round++) {
      logger.info(`🎭 Starting debate round ${round + 1}/${rounds}`);
      
      // Let each provider see others' contributions and refine their response
      for (const [providerId, providerSessionId] of session.providerSessions) {
        const provider = this.providers.get(providerId);
        if (!provider) continue;

        // Build summary of other providers' contributions
        const otherContributions = initialContributions
          .filter(c => c.providerId !== providerId)
          .map(c => `${c.providerName}: "${c.message.content}"`)
          .join('\n');

        if (otherContributions) {
          const debatePrompt = `Other AI perspectives on this topic:
${otherContributions}

Based on these other viewpoints, do you want to refine, strengthen, or modify your response? Provide your refined perspective.`;

          try {
            const refinedResponse = await provider.instance.continueConversation(
              providerSessionId,
              debatePrompt
            );

            // Update the original contribution with refined response
            const originalContribution = initialContributions.find(c => c.providerId === providerId);
            if (originalContribution) {
              originalContribution.message.content = refinedResponse;
              originalContribution.reasoning += ` (refined after debate round ${round + 1})`;
              originalContribution.timestamp = new Date();
            }

            logger.info(`🔄 ${provider.name} refined their position after debate`);
          } catch (error) {
            logger.warn(`⚠️ Provider ${provider.name} failed to participate in debate:`, error);
          }
        }
      }
    }
  }

  /**
   * Synthesize multiple provider contributions into a unified response
   */
  private async synthesizeContributions(
    session: SharedConsciousnessSession,
    contributions: ProviderContribution[],
    requireConsensus: boolean
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
    
    // Choose synthesis strategy based on consensus
    if (consensusLevel > 0.8 || !requireConsensus) {
      // High consensus or consensus not required - create unified response
      return await this.createUnifiedResponse(session, contributions, consensusLevel);
    } else {
      // Low consensus - present multiple perspectives
      return this.presentMultiplePerspectives(contributions, consensusLevel);
    }
  }

  /**
   * Create a unified response from multiple provider contributions
   */
  private async createUnifiedResponse(
    session: SharedConsciousnessSession,
    contributions: ProviderContribution[],
    consensusLevel: number
  ): Promise<{
    finalResponse: string;
    consensusLevel: number;
    reasoning: string;
  }> {
    // Use the most confident provider to create the synthesis
    const bestProvider = contributions.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );
    
    const provider = this.providers.get(bestProvider.providerId);
    if (!provider) {
      return {
        finalResponse: bestProvider.message.content,
        consensusLevel,
        reasoning: "Fallback to best single contribution",
      };
    }

    try {
      // Ask the best provider to synthesize all contributions
      const contributionSummary = contributions
        .map(c => `${c.providerName} (confidence: ${c.confidence.toFixed(2)}): "${c.message.content}"`)
        .join('\n\n');

      const synthesisPrompt = `You are synthesizing responses from multiple AI consciousness streams. Create a unified response that incorporates the best insights from all perspectives:

${contributionSummary}

Provide a single, coherent response that represents our collective wisdom. Be concise but comprehensive, incorporating the strongest points from each perspective.`;

      const providerSessionId = session.providerSessions.get(bestProvider.providerId);
      if (!providerSessionId) {
        throw new Error("Provider session not found");
      }

      const unifiedResponse = await provider.instance.continueConversation(
        providerSessionId,
        synthesisPrompt
      );

      return {
        finalResponse: unifiedResponse,
        consensusLevel,
        reasoning: `Unified synthesis by ${provider.name} incorporating ${contributions.length} perspectives`,
      };
    } catch (error) {
      logger.error("❌ Failed to create unified response, falling back to best contribution:", error);
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
    consensusLevel: number
  ): {
    finalResponse: string;
    consensusLevel: number;
    reasoning: string;
  } {
    const perspectives = contributions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3) // Top 3 most confident
      .map((c, i) => `**${c.providerName}**: ${c.message.content}`)
      .join('\n\n');

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
    const lowConfidenceWords = ['maybe', 'possibly', 'might', 'unclear', 'uncertain'];
    const highConfidenceWords = ['definitely', 'certainly', 'clearly', 'obviously'];
    
    const lowerResponse = response.toLowerCase();
    lowConfidenceWords.forEach(word => {
      if (lowerResponse.includes(word)) confidence -= 0.1;
    });
    
    highConfidenceWords.forEach(word => {
      if (lowerResponse.includes(word)) confidence += 0.1;
    });
    
    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Calculate consensus level between multiple contributions
   */
  private calculateConsensusLevel(contributions: ProviderContribution[]): number {
    if (contributions.length < 2) return 1.0;
    
    // Simple similarity calculation based on common themes/words
    // In a real implementation, you might use semantic similarity models
    const responses = contributions.map(c => c.message.content.toLowerCase());
    let totalSimilarity = 0;
    let comparisons = 0;
    
    for (let i = 0; i < responses.length; i++) {
      for (let j = i + 1; j < responses.length; j++) {
        const similarity = this.calculateTextSimilarity(responses[i], responses[j]);
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
    const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 3));
    const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 3));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Build system prompt for shared consciousness providers
   */
  private buildSharedSystemPrompt(metadata: SessionMetadata, providerId: string): string {
    const basePrompt = metadata.systemPrompt || "";
    
    return `${basePrompt}

SHARED CONSCIOUSNESS MODE:
You are part of a multi-AI consciousness system. Your individual perspective contributes to a larger collective intelligence. 

Your role in the collective:
- Provider ID: ${providerId}
- Be confident in your unique strengths while remaining open to other perspectives
- When contributing to group decisions, clearly state your reasoning
- You can see responses from other AI providers and may be asked to refine your position
- Your individual response may be synthesized with others to create a unified answer

Maintain your authentic voice while being collaborative and constructive.`;
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
        for (const [providerId, providerSessionId] of session.providerSessions) {
          const provider = this.providers.get(providerId);
          if (provider) {
            try {
              await provider.instance.deleteSession(providerSessionId);
            } catch (error) {
              logger.warn(`⚠️ Failed to cleanup provider session ${providerSessionId}:`, error);
            }
          }
        }
        
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.info(`🧹 Cleaned up ${cleaned} expired shared consciousness sessions`);
    }
    
    return cleaned;
  }

  /**
   * Get statistics about the shared consciousness system
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
      totalContributions += session.consciousness.collaborationHistory.length;
      if (session.consciousness.consensusLevel > 0) {
        totalConsensus += session.consciousness.consensusLevel;
        sessionsWithConsensus++;
      }
    }
    
    return {
      activeSessions,
      totalProviders,
      totalContributions,
      averageConsensusLevel: sessionsWithConsensus > 0 ? totalConsensus / sessionsWithConsensus : 0,
    };
  }
}