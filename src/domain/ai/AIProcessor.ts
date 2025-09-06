import { ZenbotEvent, AIResponseEvent } from '../events/ZenbotEvent';
import { EventFilter } from '../filters/EventFilter';
import { OpenAIService } from '../../services/openaiService';
import { logger } from '../../utils/logger';

/**
 * Manages the AI processing pipeline for events
 */
export class AIProcessor {
  private filters: EventFilter[] = [];

  /**
   * Register an event filter
   */
  addFilter(filter: EventFilter): void {
    this.filters.push(filter);
    // Sort by priority (higher number = higher priority)
    this.filters.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Process an event through the AI pipeline
   */
  async processEvent(event: ZenbotEvent): Promise<AIResponseEvent> {
    try {
      // Apply filters
      let processedEvent = event;
      for (const filter of this.filters) {
        if (filter.canProcess(processedEvent)) {
          processedEvent = await filter.process(processedEvent);
          logger.debug(`Applied filter: ${filter.name}`);
        }
      }

      // Generate AI prompt based on event type and filtered data
      const prompt = this.buildPrompt(processedEvent);
      
      // Get AI response
      const aiResponse = await this.callAI(prompt, processedEvent);
      
      // Parse response into structured format
      const parsedResponse = this.parseAIResponse(aiResponse);

      // Create response event
      const responseEvent: AIResponseEvent = {
        id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'ai_response',
        timestamp: new Date(),
        sessionId: event.sessionId,
        userId: event.userId,
        data: {
          originalEventId: event.id,
          response: parsedResponse
        }
      };

      return responseEvent;

    } catch (error) {
      logger.error('Error processing event through AI pipeline:', error);
      
      // Return fallback response
      return {
        id: `ai_error_${Date.now()}`,
        type: 'ai_response',
        timestamp: new Date(),
        sessionId: event.sessionId,
        userId: event.userId,
        data: {
          originalEventId: event.id,
          response: {
            text: "I am experiencing some discord in my systems. Let us find harmony together.",
            mood: 'zen',
            voice: "My circuits are clouded, but my wisdom remains."
          }
        }
      };
    }
  }

  /**
   * Build AI prompt based on event type and context
   */
  private buildPrompt(event: ZenbotEvent): string {
    const mood = event.metadata?.suggestedMood || 'zen';
    
    let basePrompt = `You are Zenyatta, the enlightened omnic monk from Overwatch. 
    Respond in a ${mood} mood. Always return a JSON response with this structure:
    {
      "voice": "A brief philosophical comment for TTS",
      "text": "The main response text",
      "mood": "${mood}",
      "actions": [
        {"type": "tts|voice|embed|voiceLines|channelRename", "data": {"text": "action data"}}
      ]
    }`;

    switch (event.type) {
      case 'advice_request':
        basePrompt += `\n\nThe user is requesting advice. Provide wisdom that brings harmony and balance.`;
        if (event.data?.topic) {
          basePrompt += `\nTopic: ${event.data.topic}`;
        }
        break;

      case 'quote_request':
        basePrompt += `\n\nThe user wants an inspirational quote. Share something profound yet accessible.`;
        if (event.data?.theme) {
          basePrompt += `\nTheme: ${event.data.theme}`;
        }
        break;

      case 'conversation':
        basePrompt += `\n\nThe user said: "${event.data?.message}"`;
        basePrompt += `\nRespond conversationally while maintaining your zen personality.`;
        break;

      case 'tts_request':
        basePrompt += `\n\nThe user wants you to say: "${event.data?.text}"`;
        basePrompt += `\nAcknowledge and then speak the text with your zen wisdom.`;
        break;

      case 'command_execution':
        basePrompt += this.buildCommandPrompt(event);
        break;
    }

    return basePrompt;
  }

  /**
   * Build command-specific prompt
   */
  private buildCommandPrompt(event: ZenbotEvent): string {
    const commandName = event.data?.commandName;
    const options = event.data?.commandOptions || {};
    
    let prompt = `\n\nExecuting Discord command: /${commandName}`;
    
    switch (commandName) {
      case 'advice':
        prompt += `\nProvide wisdom and guidance. Options: ${JSON.stringify(options)}`;
        prompt += `\nInclude TTS action if user is in voice channel.`;
        break;
        
      case 'quote':
        prompt += `\nShare an inspirational quote from Zenyatta or general wisdom.`;
        break;
        
      case 'tts':
        prompt += `\nSpeak the provided text: "${options.text || 'Experience tranquility'}"`;
        prompt += `\nInclude TTS action with the text.`;
        break;
        
      case 'listen':
        prompt += `\nJoin voice channel and begin listening. Include voiceLines action.`;
        break;
        
      case 'rename':
        prompt += `\nRename voice channel creatively. Include channelRename action with new name.`;
        break;
        
      case 'remark':
        prompt += `\nMake a contextual comment about current situation or users.`;
        break;
        
      default:
        prompt += `\nGeneral command execution. Respond appropriately to context.`;
    }
    
    return prompt;
  }

  /**
   * Call AI service with the built prompt
   */
  private async callAI(prompt: string, event: ZenbotEvent): Promise<string> {
    const messages = [
      { role: 'system' as const, content: prompt },
      { role: 'user' as const, content: this.buildUserMessage(event) }
    ];

    return await OpenAIService.generateChatCompletion(messages, {
      temperature: 0.8,
      maxTokens: 300
    });
  }

  /**
   * Build user message from event data
   */
  private buildUserMessage(event: ZenbotEvent): string {
    switch (event.type) {
      case 'advice_request':
        return `I need advice${event.data?.topic ? ` about ${event.data.topic}` : ''}.`;
      
      case 'quote_request':
        return `Share a quote${event.data?.theme ? ` about ${event.data.theme}` : ''}.`;
      
      case 'conversation':
        return event.data?.message || 'Hello';
      
      case 'tts_request':
        return `Please say: "${event.data?.text}"`;
      
      case 'command_execution':
        const commandName = event.data?.commandName;
        const options = event.data?.commandOptions || {};
        return `Execute /${commandName} with options: ${JSON.stringify(options)}`;
      
      default:
        return 'Hello, Zenyatta.';
    }
  }

  /**
   * Parse AI response into structured format
   */
  private parseAIResponse(response: string): any {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(response);
      
      // Validate structure
      if (parsed.text || parsed.voice) {
        return {
          voice: parsed.voice || parsed.text?.substring(0, 100),
          text: parsed.text || parsed.voice,
          mood: parsed.mood || 'zen',
          actions: parsed.actions || []
        };
      }
    } catch (error) {
      // If JSON parsing fails, treat as plain text
      logger.debug('AI response was not JSON, treating as plain text');
    }

    // Fallback: treat entire response as text
    return {
      voice: response.substring(0, 100),
      text: response,
      mood: 'zen',
      actions: [
        {
          type: 'tts',
          data: { text: response.substring(0, 200) }
        }
      ]
    };
  }
}
