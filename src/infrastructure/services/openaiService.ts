import OpenAI from "openai";
import { Config, OPENAI_API_KEY, AI_CONFIG, VOICE_CONFIG } from "../../config";
import { logger } from "../../utils/logger";

/**
 * Centralized OpenAI service to eliminate duplicate client creation
 * and standardize AI operations across the application
 */
export class OpenAIService {
  private static instance: OpenAI | null = null;

  /**
   * Gets singleton OpenAI client instance
   */
  static getClient(): OpenAI {
    if (!this.instance) {
      this.instance = new OpenAI({ 
        apiKey: OPENAI_API_KEY 
      });
      logger.info('OpenAI client initialized');
    }
    return this.instance;
  }

  // ===== TTS METHODS =====

  /**
   * Creates TTS audio stream with Zenyatta personality
   */
  static async createTTSStream(text: string): Promise<Buffer> {
    const client = this.getClient();
    
    try {
      logger.info(`Creating TTS for text: "${text}"`);
      
      const response = await client.audio.speech.create({
        model: VOICE_CONFIG.TTS_MODEL,
        voice: VOICE_CONFIG.TTS_VOICE,
        input: text,
        instructions: VOICE_CONFIG.ZENYATTA_INSTRUCTIONS,
        response_format: VOICE_CONFIG.TTS_FORMAT,
      });

      const buffer = Buffer.from(await response.arrayBuffer());
      
      if (buffer.length === 0) {
        throw new Error('TTS response buffer is empty');
      }
      
      logger.info(`TTS buffer created successfully: ${buffer.length} bytes`);
      return buffer;
    } catch (error) {
      logger.error('Error creating TTS stream:', error);
      throw new Error(`Failed to generate TTS: ${(error as Error).message}`);
    }
  }

  /**
   * Creates legacy TTS file (for backward compatibility)
   */
  static async createLegacyTTS(text: string): Promise<Buffer> {
    const client = this.getClient();
    
    try {
      const response = await client.audio.speech.create({
        model: VOICE_CONFIG.LEGACY_TTS_MODEL,
        voice: VOICE_CONFIG.LEGACY_TTS_VOICE,
        input: text,
        response_format: VOICE_CONFIG.LEGACY_TTS_FORMAT,
      });

      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      logger.error('Error creating legacy TTS:', error);
      throw new Error(`Failed to generate legacy TTS: ${(error as Error).message}`);
    }
  }

  // ===== SPEECH TRANSCRIPTION METHODS =====

  /**
   * Transcribes audio file to text using Whisper
   */
  static async transcribeAudio(audioFilePath: string): Promise<string> {
    const client = this.getClient();
    const fs = await import('fs');
    
    try {
      logger.info(`Transcribing audio file: ${audioFilePath}`);
      
      // Create a File object from the file path - use OGG since Whisper doesn't support OPUS
      const audioBuffer = fs.readFileSync(audioFilePath);
      const audioFile = new File([audioBuffer], 'audio.ogg', { type: 'audio/ogg' });
      
      const transcription = await client.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        language: "en", // Can be made configurable
      });

      logger.info(`Transcription successful: "${transcription.text}"`);
      return transcription.text.trim();
    } catch (error) {
      logger.error('Error transcribing audio:', error);
      throw new Error(`Failed to transcribe audio: ${(error as Error).message}`);
    }
  }

  /**
   * Transcribes audio buffer to text (for in-memory processing)
   */
  static async transcribeAudioBuffer(audioBuffer: Buffer, filename: string = "audio.wav"): Promise<string> {
    const client = this.getClient();
    
    try {
      logger.info(`Transcribing audio buffer: ${audioBuffer.length} bytes`);
      
      // Create a File object directly from the WAV buffer
      const audioFile = new File([audioBuffer], filename, { type: 'audio/wav' });
      
      const transcription = await client.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        language: "en", // Can be made configurable
      });

      logger.info(`Buffer transcription successful: "${transcription.text}"`);
      return transcription.text.trim();
    } catch (error) {
      logger.error('Error transcribing audio buffer:', error);
      throw new Error(`Failed to transcribe audio buffer: ${(error as Error).message}`);
    }
  }

  // ===== CHAT COMPLETION METHODS =====

  /**
   * Generates AI chat completion with standard configuration
   */
  static async generateChatCompletion(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    options: {
      temperature?: number;
      maxTokens?: number;
      model?: string;
    } = {}
  ): Promise<string> {
    const client = this.getClient();
    
    try {
      const response = await client.chat.completions.create({
        model: options.model || AI_CONFIG.CHAT_MODEL,
        messages,
        temperature: options.temperature || AI_CONFIG.DEFAULT_TEMPERATURE,
        max_tokens: options.maxTokens || AI_CONFIG.DEFAULT_MAX_TOKENS,
      });

      const content = response.choices[0]?.message.content;
      if (!content) {
        throw new Error('No content in AI response');
      }

      return content;
    } catch (error) {
      logger.error('Error generating chat completion:', error);
      throw new Error(`Failed to generate AI response: ${(error as Error).message}`);
    }
  }

  /**
   * Generates a compliment about a subject
   */
  static async generateCompliment(subject: string = "a discord user"): Promise<string> {
    try {
      logger.info(`Generating compliment for: ${subject}`);
      
      // Random compliment styles for variety
      const styles = [
        "Write a wholesome compliment comparing them to something awesome",
        "Write a compliment about their gaming skills or Discord presence", 
        "Write a compliment using food/cooking metaphors",
        "Write a compliment comparing them to a superhero or fictional character",
        "Write a compliment about their personality or vibe",
        "Write a compliment using nature or animal metaphors",
        "Write a compliment about how they make others feel",
        "Write a nerdy/geeky compliment with pop culture references"
      ];
      
      const randomStyle = styles[Math.floor(Math.random() * styles.length)];
      
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: `You are a creative AI that generates unique, funny compliments. Be original and avoid overused internet memes. 
                   Make each compliment feel personal and fresh. Keep it wholesome but creative.`
        },
        {
          role: "user",
          content: `${randomStyle} about ${subject}. Be creative and original, avoid cliché phrases.`
        }
      ];

      const result = await this.generateChatCompletion(messages, {
        temperature: 0.9, // Higher creativity
        maxTokens: 100 // Keep it snappy
      });
      logger.info(`Generated compliment: "${result}"`);
      return result;
    } catch (error) {
      logger.error('Error generating compliment:', error);
      return `${subject} is absolutely wonderful!`;
    }
  }

  /**
   * Generates a lighthearted insult about a subject
   */
  static async generateInsult(subject: string = "a discord user"): Promise<string> {
    try {
      logger.info(`Generating insult for: ${subject}`);
      
      // Random insult styles for maximum creativity
      const styles = [
        "Write a playful insult comparing them to a silly animal or creature",
        "Write a roast about their gaming skills or Discord habits (keep it friendly)",
        "Write a lighthearted insult using food or cooking comparisons",
        "Write a mock-dramatic insult like they're a villain in a comedy movie",
        "Write a nerdy insult with video game or tech references",
        "Write a silly insult about their imaginary superpowers being useless",
        "Write a playful insult comparing them to an inanimate object",
        "Write a roast in the style of a nature documentary narrator",
        "Write an insult like they're a malfunctioning robot or AI",
        "Write a medieval-style insult but keep it silly and harmless"
      ];
      
      const randomStyle = styles[Math.floor(Math.random() * styles.length)];
      
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: `You are a master of creative, harmless roasting. Generate original, playful insults that are funny without being mean.
                   Avoid overused internet memes like "you're like a cloud" or generic put-downs. Be creative and unique!
                   Keep it silly and lighthearted - think playground teasing, not actually hurtful.`
        },
        {
          role: "user",
          content: `${randomStyle} about ${subject}. Be original, creative, and avoid cliché insults.`
        }
      ];

      const result = await this.generateChatCompletion(messages, {
        temperature: 1.0, // Maximum creativity for insults
        maxTokens: 100 // Keep it snappy
      });
      logger.info(`Generated insult: "${result}"`);
      return result;
    } catch (error) {
      logger.error('Error generating insult:', error);
      return `${subject} is being a silly goose!`;
    }
  }

  /**
   * Batch processes quotes with AI (used sparingly)
   */
  static async batchParseQuotes(contents: string[]): Promise<any[]> {
    if (contents.length === 0) return [];
    
    try {
      const batchContent = contents.map((c, i) => `${i}: ${c}`).join('\n');
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: "system", 
          content: `Parse multiple Discord quotes. Return JSON array: [{"index": 0, "speaker": "name or null", "quote": "actual quote", "isQuoted": true/false}]`
        },
        {
          role: "user",
          content: batchContent
        }
      ];

      const result = await this.generateChatCompletion(messages, {
        temperature: 0.1,
        maxTokens: 1000
      });
      
      return JSON.parse(result);
    } catch (error) {
      logger.error('Batch AI parsing failed:', error);
      // Fallback to simple parsing would be handled by the calling service
      throw new Error(`Failed to parse quotes with AI: ${(error as Error).message}`);
    }
  }

  /**
   * Health check for OpenAI service
   */
  static async healthCheck(): Promise<boolean> {
    try {
      const client = this.getClient();
      // Try a minimal request to verify API key works
      await client.models.list();
      return true;
    } catch (error) {
      logger.error('OpenAI health check failed:', error);
      return false;
    }
  }
}

// Export convenience methods
export const {
  getClient,
  createTTSStream,
  createLegacyTTS,
  transcribeAudio,
  transcribeAudioBuffer,
  generateChatCompletion,
  generateCompliment,
  generateInsult,
  batchParseQuotes,
  healthCheck
} = OpenAIService;