import { User } from "discord.js";
import { OpenAIService } from "./openaiService";
import { logger } from "../utils/logger";

/**
 * Represents a single message in a conversation
 */
interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: any;
}

/**
 * Additional context for conversations
 */
class ConversationContext {
  public mood: 'zen' | 'playful' | 'wise' | 'mysterious' = 'zen';
  public topic?: string;
  public voiceChannelId?: string;
  public preferences: { [key: string]: any } = {};

  setMood(mood: 'zen' | 'playful' | 'wise' | 'mysterious') {
    this.mood = mood;
  }

  setTopic(topic: string) {
    this.topic = topic;
  }

  setPreference(key: string, value: any) {
    this.preferences[key] = value;
  }
}

/**
 * Represents a conversation with a specific user
 */
class UserConversation {
  public userId: string;
  public username: string;
  public messages: ConversationMessage[] = [];
  public lastActivity: Date = new Date();
  public context: ConversationContext = new ConversationContext();

  constructor(userId: string, username: string) {
    this.userId = userId;
    this.username = username;
  }

  addMessage(role: 'user' | 'assistant', content: string, metadata?: any) {
    this.messages.push({
      role,
      content,
      timestamp: new Date(),
      metadata
    });

    // Keep only the last MAX_HISTORY_LENGTH messages
    if (this.messages.length > ConversationService.MAX_HISTORY_LENGTH) {
      this.messages = this.messages.slice(-ConversationService.MAX_HISTORY_LENGTH);
    }

    this.lastActivity = new Date();
  }

  getRecentMessages(count: number = 5): ConversationMessage[] {
    return this.messages.slice(-count);
  }

  isActive(): boolean {
    const now = new Date();
    return (now.getTime() - this.lastActivity.getTime()) < ConversationService.CONVERSATION_TIMEOUT;
  }
}

/**
 * Manages ongoing conversations with users
 * Each user gets their own conversation state and history
 */
export class ConversationService {
  private static conversations = new Map<string, UserConversation>();
  public static readonly MAX_HISTORY_LENGTH = 10; // Keep last 10 messages per user
  public static readonly CONVERSATION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  /**
   * Get or create a conversation for a user
   */
  static getConversation(user: User): UserConversation {
    const userId = user.id;
    
    if (!this.conversations.has(userId)) {
      const conversation = new UserConversation(userId, user.displayName || user.username);
      this.conversations.set(userId, conversation);
      logger.info(`Started new conversation with ${user.username} (${userId})`);
    }

    return this.conversations.get(userId)!;
  }

  /**
   * Process a user message and generate a response
   */
  static async processMessage(
    user: User, 
    message: string, 
    metadata?: { channelId?: string; voiceChannelId?: string }
  ): Promise<string> {
    const conversation = this.getConversation(user);
    
    // Add user message to history
    conversation.addMessage('user', message, metadata);

    try {
      // Build context for AI based on conversation history
      const systemPrompt = this.buildSystemPrompt(conversation);
      const conversationHistory = this.buildConversationHistory(conversation);

      // Generate response using OpenAI
      const response = await OpenAIService.generateChatCompletion([
        { role: 'system', content: systemPrompt },
        ...conversationHistory
      ], {
        temperature: 0.8,
        maxTokens: 200
      });

      // Add assistant response to history
      conversation.addMessage('assistant', response, { 
        generatedAt: new Date(),
        model: 'gpt-3.5-turbo'
      });

      logger.info(`Conversation with ${user.username}: "${message}" -> "${response}"`);
      return response;

    } catch (error) {
      logger.error(`Error processing message for ${user.username}:`, error);
      return "I am experiencing some turbulence in my thoughts. Please try again, and perhaps we can find harmony together.";
    }
  }

  /**
   * Build system prompt based on conversation context
   */
  private static buildSystemPrompt(conversation: UserConversation): string {
    const basePrompt = `You are Zenyatta from Overwatch - a wise, peaceful omnic monk who speaks in thoughtful, philosophical ways. 
    You often reference concepts like harmony, balance, transcendence, and the iris. 
    Keep responses conversational but maintain your zen personality.`;

    const contextAdditions = [];
    
    if (conversation.context.mood === 'playful') {
      contextAdditions.push("You're in a more playful mood today, feel free to be a bit more lighthearted.");
    } else if (conversation.context.mood === 'wise') {
      contextAdditions.push("Focus on sharing deep wisdom and philosophical insights.");
    } else if (conversation.context.mood === 'mysterious') {
      contextAdditions.push("Be more cryptic and mysterious in your responses.");
    }

    if (conversation.context.topic) {
      contextAdditions.push(`The current conversation topic is: ${conversation.context.topic}`);
    }

    return [basePrompt, ...contextAdditions].join('\n\n');
  }

  /**
   * Build conversation history for AI context
   */
  private static buildConversationHistory(conversation: UserConversation) {
    return conversation.getRecentMessages(6).map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }));
  }

  /**
   * Set conversation context/mood
   */
  static setConversationMood(user: User, mood: 'zen' | 'playful' | 'wise' | 'mysterious') {
    const conversation = this.getConversation(user);
    conversation.context.setMood(mood);
    logger.info(`Set conversation mood for ${user.username} to: ${mood}`);
  }

  /**
   * Set conversation topic
   */
  static setConversationTopic(user: User, topic: string) {
    const conversation = this.getConversation(user);
    conversation.context.setTopic(topic);
    logger.info(`Set conversation topic for ${user.username} to: ${topic}`);
  }

  /**
   * Get conversation summary for a user
   */
  static getConversationSummary(user: User) {
    const conversation = this.conversations.get(user.id);
    if (!conversation) {
      return { exists: false };
    }

    return {
      exists: true,
      messageCount: conversation.messages.length,
      lastActivity: conversation.lastActivity,
      isActive: conversation.isActive(),
      mood: conversation.context.mood,
      topic: conversation.context.topic,
      recentMessages: conversation.getRecentMessages(3)
    };
  }

  /**
   * Clear conversation for a user
   */
  static clearConversation(user: User): boolean {
    const cleared = this.conversations.delete(user.id);
    if (cleared) {
      logger.info(`Cleared conversation for ${user.username}`);
    }
    return cleared;
  }

  /**
   * Get all active conversations (for monitoring)
   */
  static getActiveConversations() {
    const active = Array.from(this.conversations.values())
      .filter(conv => conv.isActive())
      .map(conv => ({
        userId: conv.userId,
        username: conv.username,
        messageCount: conv.messages.length,
        lastActivity: conv.lastActivity,
        mood: conv.context.mood,
        topic: conv.context.topic
      }));

    return {
      count: active.length,
      conversations: active
    };
  }

  /**
   * Cleanup old conversations
   */
  static cleanupOldConversations(): number {
    const before = this.conversations.size;
    
    for (const [userId, conversation] of this.conversations.entries()) {
      if (!conversation.isActive()) {
        this.conversations.delete(userId);
        logger.debug(`Cleaned up inactive conversation for user ${userId}`);
      }
    }

    const cleaned = before - this.conversations.size;
    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} inactive conversations`);
    }
    return cleaned;
  }

  /**
   * Get conversation statistics
   */
  static getStats() {
    const activeConversations = Array.from(this.conversations.values()).filter(c => c.isActive());
    
    return {
      totalConversations: this.conversations.size,
      activeConversations: activeConversations.length,
      inactiveConversations: this.conversations.size - activeConversations.length,
      totalMessages: Array.from(this.conversations.values()).reduce((sum, conv) => sum + conv.messages.length, 0)
    };
  }

  /**
   * Set context for a user's conversation
   */
  static setUserContext(userId: string, context: { mood?: 'zen' | 'playful' | 'wise' | 'mysterious'; topic?: string }): boolean {
    const conversation = this.conversations.get(userId);
    if (!conversation) {
      return false;
    }

    if (context.mood) {
      conversation.context.setMood(context.mood);
    }
    
    if (context.topic) {
      conversation.context.setTopic(context.topic);
    }

    logger.info(`Updated context for user ${conversation.username}: mood=${context.mood}, topic=${context.topic}`);
    return true;
  }

  /**
   * Export conversation logs (for debugging/analysis)
   */
  static exportConversationLogs() {
    const logs = Array.from(this.conversations.values()).map(conv => ({
      userId: conv.userId,
      username: conv.username,
      messageCount: conv.messages.length,
      lastActivity: conv.lastActivity,
      context: conv.context,
      messages: conv.messages
    }));

    return {
      exportedAt: new Date(),
      totalConversations: logs.length,
      conversations: logs
    };
  }
}

/**
 * Represents a single message in a conversation
 */
interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: any;
}

// Auto-cleanup every 15 minutes
setInterval(() => {
  ConversationService.cleanupOldConversations();
}, 15 * 60 * 1000);

export default ConversationService;
