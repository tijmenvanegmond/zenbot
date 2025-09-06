import { Message } from 'discord.js';
import { ConversationService } from '../../services/conversationService';
import { logger } from '../../utils/logger';

/**
 * Handle direct messages and mentions for conversational interaction
 */
export async function onMessageCreate(message: Message) {
  // Ignore bot messages and system messages
  if (message.author.bot || message.system) {
    return;
  }

  // Only respond to DMs or mentions in guilds
  const isDM = !message.guild;
  const isMentioned = message.mentions.has(message.client.user!);
  
  if (!isDM && !isMentioned) {
    return;
  }

  try {
    // Get the message content, removing mentions if present
    let content = message.content;
    if (isMentioned) {
      content = content.replace(/<@!?\d+>/g, '').trim();
    }

    // Skip empty messages
    if (!content) {
      return;
    }

    // Get voice channel context if user is in one
    const voiceChannelId = message.member?.voice?.channelId;

    logger.info(`Processing conversation message from ${message.author.username}: "${content}"`);

    // Generate response using conversation service
    const response = await ConversationService.processMessage(
      message.author,
      content,
      { 
        channelId: message.channel.id,
        voiceChannelId: voiceChannelId || undefined
      }
    );

    // Send response
    await message.reply(response);

  } catch (error) {
    logger.error('Error handling conversational message:', error);
    
    // Send fallback response
    try {
      await message.reply('I seem to be experiencing some discord in my systems. Perhaps we can try again in a moment?');
    } catch (replyError) {
      logger.error('Failed to send error response:', replyError);
    }
  }
}
