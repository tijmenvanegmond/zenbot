import { CommandInteraction, VoiceChannel, GuildMember } from 'discord.js';
import { logger } from '../utils/logger';
import { validateVoiceChannel } from '../utils/commandHelpers';
import { playTTSInChannel } from '../utils/voiceHelpers';
import { OpenAIService } from './openaiService';

/**
 * Response modes for different contexts
 */
export type ResponseMode = 
  | 'text_only'           // Just Discord message
  | 'voice_only'          // Just TTS in voice channel  
  | 'voice_with_text'     // TTS + Discord message
  | 'enhanced_voice'      // AI-enhanced TTS + rich Discord embed
  | 'contextual';         // AI decides based on context

/**
 * Context factors for intelligent response selection
 */
interface ResponseContext {
  // User context
  userId: string;
  username: string;
  isInVoiceChannel: boolean;
  voiceChannelMemberCount?: number;
  
  // Command context
  commandName: string;
  urgency?: 'low' | 'medium' | 'high';
  commandOptions: Record<string, any>;
  
  // Temporal context
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  dayOfWeek: string;
  
  // Social context
  isPrivate: boolean;
  guildSize?: number;
  channelActivity?: 'low' | 'medium' | 'high';
}

/**
 * Smart response payload
 */
export interface SmartResponse {
  mode: ResponseMode;
  textResponse?: string;
  voiceResponse?: string;
  embed?: any;
  shouldDelay?: boolean;
  delayMs?: number;
  reasoning?: string; // For debugging AI decisions
}

/**
 * Service for intelligent response mode selection and execution
 */
export class SmartResponseService {
  
  /**
   * Intelligently determine the best response mode and content
   */
  static async generateResponse(
    interaction: CommandInteraction,
    baseContent: string,
    preferredMode?: ResponseMode
  ): Promise<SmartResponse> {
    
    const context = this.buildContext(interaction);
    const mode = preferredMode || await this.selectResponseMode(context, baseContent);
    
    logger.debug(`Selected response mode: ${mode} for command: ${context.commandName}`);
    
    switch (mode) {
      case 'text_only':
        return {
          mode: 'text_only',
          textResponse: baseContent
        };
        
      case 'voice_only':
        return {
          mode: 'voice_only',
          voiceResponse: await this.createVoiceResponse(baseContent, context)
        };
        
      case 'voice_with_text':
        const voiceText = await this.createVoiceResponse(baseContent, context);
        return {
          mode: 'voice_with_text',
          textResponse: this.formatTextResponse(baseContent, context),
          voiceResponse: voiceText
        };
        
      case 'enhanced_voice':
        const enhanced = await this.createEnhancedResponse(baseContent, context);
        return {
          mode: 'enhanced_voice',
          textResponse: enhanced.text,
          voiceResponse: enhanced.voice,
          embed: enhanced.embed,
          shouldDelay: enhanced.shouldDelay,
          delayMs: enhanced.delayMs
        };
        
      case 'contextual':
        // AI decides everything based on full context
        return await this.createContextualResponse(baseContent, context);
        
      default:
        return { mode: 'text_only', textResponse: baseContent };
    }
  }
  
  /**
   * Execute the smart response (send to Discord)
   */
  static async executeResponse(
    interaction: CommandInteraction,
    response: SmartResponse
  ): Promise<void> {
    
    const validation = validateVoiceChannel(interaction);
    
    try {
      // Handle voice component
      if ((response.mode === 'voice_only' || response.mode === 'voice_with_text' || response.mode === 'enhanced_voice') 
          && response.voiceResponse && validation.isValid) {
        
        const voiceChannel = validation.member!.voice.channel as VoiceChannel;
        
        // Optional delay for dramatic effect
        if (response.shouldDelay && response.delayMs) {
          await new Promise(resolve => setTimeout(resolve, response.delayMs));
        }
        
        await playTTSInChannel(voiceChannel, response.voiceResponse);
        logger.info(`🧘 Smart TTS executed: "${response.voiceResponse.substring(0, 50)}..."`);
      }
      
      // Handle text component
      if (response.mode !== 'voice_only' && response.textResponse) {
        const replyContent: any = {
          content: response.textResponse
        };
        
        if (response.embed) {
          replyContent.embeds = [response.embed];
        }
        
        await interaction.editReply(replyContent);
      }
      
    } catch (error) {
      logger.error('Smart response execution failed:', error);
      // Fallback to text
      await interaction.editReply({
        content: response.textResponse || 'Experience harmony... through technical difficulties.'
      });
    }
  }
  
  /**
   * Build comprehensive context for AI decision making
   */
  private static buildContext(interaction: CommandInteraction): ResponseContext {
    const validation = validateVoiceChannel(interaction);
    const now = new Date();
    const hour = now.getHours();
    
    let timeOfDay: ResponseContext['timeOfDay'] = 'afternoon';
    if (hour < 6) timeOfDay = 'night';
    else if (hour < 12) timeOfDay = 'morning';
    else if (hour < 18) timeOfDay = 'afternoon';
    else if (hour < 22) timeOfDay = 'evening';
    else timeOfDay = 'night';
    
    return {
      userId: interaction.user.id,
      username: interaction.user.username,
      isInVoiceChannel: validation.isValid,
      voiceChannelMemberCount: validation.isValid ? 
        (validation.member!.voice.channel as VoiceChannel)?.members?.size : undefined,
      
      commandName: interaction.commandName,
      urgency: interaction.options.get('urgency')?.value as any,
      commandOptions: Object.fromEntries(
        interaction.options.data.map(opt => [opt.name, opt.value])
      ),
      
      timeOfDay,
      dayOfWeek: now.toLocaleDateString('en', { weekday: 'long' }).toLowerCase(),
      
      isPrivate: !interaction.guildId,
      guildSize: interaction.guild?.memberCount,
      channelActivity: 'medium' // Could be enhanced with actual activity metrics
    };
  }
  
  /**
   * AI-driven response mode selection
   */
  private static async selectResponseMode(
    context: ResponseContext, 
    content: string
  ): Promise<ResponseMode> {
    
    // Simple rule-based logic (could be enhanced with AI)
    
    // No voice channel = text only
    if (!context.isInVoiceChannel) {
      return 'text_only';
    }
    
    // High urgency or late night = prefer voice
    if (context.urgency === 'high' || context.timeOfDay === 'night') {
      return 'voice_with_text';
    }
    
    // Advice and quotes benefit from enhanced presentation
    if (['advice', 'quote'].includes(context.commandName)) {
      return 'enhanced_voice';
    }
    
    // TTS command is obviously voice-focused
    if (context.commandName === 'tts') {
      return 'voice_with_text';
    }
    
    // Default: voice + text for good UX
    return 'voice_with_text';
  }
  
  /**
   * Create voice-optimized version of response
   */
  private static async createVoiceResponse(
    content: string, 
    context: ResponseContext
  ): Promise<string> {
    
    // For now, simple adaptations
    // Could be enhanced with AI to make content more voice-friendly
    
    let voiceText = content;
    
    // Remove Discord formatting
    voiceText = voiceText.replace(/\*\*(.*?)\*\*/g, '$1'); // Bold
    voiceText = voiceText.replace(/\*(.*?)\*/g, '$1'); // Italic
    voiceText = voiceText.replace(/`(.*?)`/g, '$1'); // Code
    voiceText = voiceText.replace(/#{1,6}\s/g, ''); // Headers
    
    // Add Zenyatta character touches based on context
    if (context.timeOfDay === 'morning') {
      voiceText = `Good morning, ${context.username}. ${voiceText}`;
    } else if (context.timeOfDay === 'evening') {
      voiceText = `Peace be upon you this evening. ${voiceText}`;
    }
    
    // Add pauses for contemplation on advice
    if (context.commandName === 'advice') {
      voiceText = voiceText.replace(/\. /g, '... ');
    }
    
    return voiceText;
  }
  
  /**
   * Format text response for Discord
   */
  private static formatTextResponse(content: string, context: ResponseContext): string {
    // Could add context-aware formatting
    return content;
  }
  
  /**
   * Create enhanced response with embeds, delays, etc.
   */
  private static async createEnhancedResponse(
    content: string, 
    context: ResponseContext
  ): Promise<{text: string, voice: string, embed?: any, shouldDelay?: boolean, delayMs?: number}> {
    
    const voice = await this.createVoiceResponse(content, context);
    
    // For advice, add contemplative delay
    const shouldDelay = context.commandName === 'advice' && context.urgency !== 'high';
    
    return {
      text: content,
      voice,
      shouldDelay,
      delayMs: shouldDelay ? 1500 : 0 // 1.5 second pause for wisdom
    };
  }
  
  /**
   * AI-generated contextual response (most advanced mode)
   */
  private static async createContextualResponse(
    baseContent: string, 
    context: ResponseContext
  ): Promise<SmartResponse> {
    
    try {
      const prompt = `You are Zenyatta, responding to a Discord command. 
      
Context: ${JSON.stringify(context, null, 2)}
Base content: "${baseContent}"

Decide the best response approach and return JSON:
{
  "mode": "text_only|voice_only|voice_with_text|enhanced_voice",
  "textResponse": "Discord message text",
  "voiceResponse": "TTS text (if voice mode)",
  "shouldDelay": boolean,
  "delayMs": number,
  "reasoning": "why you chose this approach"
}`;

      const aiResponse = await OpenAIService.generateChatCompletion([
        { role: 'system', content: prompt },
        { role: 'user', content: 'Generate the response' }
      ], { temperature: 0.7, maxTokens: 300 });
      
      const parsed = JSON.parse(aiResponse);
      
      return {
        mode: parsed.mode || 'voice_with_text',
        textResponse: parsed.textResponse || baseContent,
        voiceResponse: parsed.voiceResponse,
        shouldDelay: parsed.shouldDelay || false,
        delayMs: parsed.delayMs || 0,
        reasoning: parsed.reasoning
      };
      
    } catch (error) {
      logger.error('AI contextual response failed:', error);
      // Fallback to simple voice + text
      return {
        mode: 'voice_with_text',
        textResponse: baseContent,
        voiceResponse: await this.createVoiceResponse(baseContent, context)
      };
    }
  }
}