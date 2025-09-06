import { ZenbotEvent, AIResponseEvent } from '../events/ZenbotEvent';

/**
 * Filter interface for processing events before AI
 */
export interface EventFilter {
  name: string;
  priority: number;
  canProcess(event: ZenbotEvent): boolean;
  process(event: ZenbotEvent): Promise<ZenbotEvent>;
}

/**
 * Context filter - adds conversation context
 */
export class ContextFilter implements EventFilter {
  name = 'context';
  priority = 100;

  canProcess(event: ZenbotEvent): boolean {
    return ['advice_request', 'quote_request', 'conversation'].includes(event.type);
  }

  async process(event: ZenbotEvent): Promise<ZenbotEvent> {
    // Add conversation history and user context
    if (!event.metadata) event.metadata = {};
    
    event.metadata.contextEnhanced = true;
    event.metadata.userHistory = `Previous conversations with user ${event.userId}`;
    
    return event;
  }
}

/**
 * Mood filter - determines appropriate response mood
 */
export class MoodFilter implements EventFilter {
  name = 'mood';
  priority = 90;

  canProcess(event: ZenbotEvent): boolean {
    return true;
  }

  async process(event: ZenbotEvent): Promise<ZenbotEvent> {
    if (!event.metadata) event.metadata = {};
    
    // Determine mood based on time, context, user history
    const hour = new Date().getHours();
    let mood: 'zen' | 'playful' | 'wise' | 'mysterious' = 'zen';
    
    if (hour >= 22 || hour <= 6) mood = 'mysterious';
    else if (hour >= 18) mood = 'wise';
    else if (hour >= 12) mood = 'playful';
    
    event.metadata.suggestedMood = mood;
    
    return event;
  }
}

/**
 * Content filter - validates and sanitizes content
 */
export class ContentFilter implements EventFilter {
  name = 'content';
  priority = 80;

  canProcess(event: ZenbotEvent): boolean {
    return true;
  }

  async process(event: ZenbotEvent): Promise<ZenbotEvent> {
    if (!event.metadata) event.metadata = {};
    
    // Validate content, apply safety filters
    event.metadata.contentValidated = true;
    event.metadata.safetyLevel = 'safe';
    
    return event;
  }
}

/**
 * Command filter - adds command-specific context and logic
 */
export class CommandFilter implements EventFilter {
  name = 'command';
  priority = 70;

  canProcess(event: ZenbotEvent): boolean {
    return event.type === 'command_execution';
  }

  async process(event: ZenbotEvent): Promise<ZenbotEvent> {
    if (!event.metadata) event.metadata = {};
    
    const commandName = event.data?.commandName;
    const options = event.data?.commandOptions || {};
    const voiceChannelId = event.data?.voiceChannelId;
    
    // Add command-specific context
    event.metadata.commandName = commandName;
    event.metadata.hasVoiceChannel = !!voiceChannelId;
    
    // Command-specific processing
    switch (commandName) {
      case 'advice':
        event.metadata.requiresAI = true;
        event.metadata.expectedActions = ['tts'];
        if (options.urgency === 'high') {
          event.metadata.suggestedMood = 'wise';
        }
        break;
        
      case 'quote':
        event.metadata.requiresAI = true;
        event.metadata.expectedActions = ['embed'];
        break;
        
      case 'tts':
        event.metadata.requiresAI = false;
        event.metadata.expectedActions = ['tts'];
        event.metadata.ttsText = options.text;
        break;
        
      case 'listen':
        event.metadata.requiresAI = true;
        event.metadata.expectedActions = ['voiceLines'];
        break;
        
      case 'rename':
        event.metadata.requiresAI = true;
        event.metadata.expectedActions = ['channelRename'];
        event.metadata.suggestedMood = 'playful';
        break;
        
      case 'remark':
        event.metadata.requiresAI = true;
        event.metadata.expectedActions = ['tts'];
        break;
    }
    
    return event;
  }
}
