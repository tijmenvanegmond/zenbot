import { FastifyInstance } from "fastify";
import { ConversationService } from "../../../services/conversationService";

/**
 * API routes for conversation management
 */
export function registerConversationRoutes(fastify: FastifyInstance) {
  
  // Get conversation statistics
  fastify.get('/conversations/stats', async (request, reply) => {
    try {
      const stats = ConversationService.getStats();
      return {
        success: true,
        data: stats
      };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve conversation stats'
      });
    }
  });

  // Clean up old conversations
  fastify.post('/conversations/cleanup', async (request, reply) => {
    try {
      ConversationService.cleanupOldConversations();
      const stats = ConversationService.getStats();
      
      return {
        success: true,
        message: 'Conversation cleanup completed',
        data: stats
      };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to cleanup conversations'
      });
    }
  });

  // Set conversation context for a user (admin endpoint)
  fastify.post<{
    Body: {
      userId: string;
      mood?: 'zen' | 'playful' | 'wise' | 'mysterious';
      topic?: string;
    }
  }>('/conversations/context', async (request, reply) => {
    try {
      const { userId, mood, topic } = request.body;
      
      if (!userId) {
        return reply.status(400).send({
          success: false,
          error: 'User ID is required'
        });
      }

      const result = ConversationService.setUserContext(userId, { mood, topic });
      
      if (result) {
        return {
          success: true,
          message: 'Context updated successfully'
        };
      } else {
        return reply.status(404).send({
          success: false,
          error: 'User conversation not found'
        });
      }
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to update conversation context'
      });
    }
  });
}
