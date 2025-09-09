import OpenAI from "openai";
import { Config, OPENAI_API_KEY, AI_CONFIG, VOICE_CONFIG } from "../config";
import { logger } from "../utils/logger";
import { ZenyattaAssistantService } from "./zenyattaAssistantService";

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
        apiKey: OPENAI_API_KEY,
      });
      logger.info("OpenAI client initialized");
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
        instructions: ZenyattaAssistantService.getTTSInstructions(),
        response_format: VOICE_CONFIG.TTS_FORMAT,
      });

      const buffer = Buffer.from(await response.arrayBuffer());

      if (buffer.length === 0) {
        throw new Error("TTS response buffer is empty");
      }

      logger.info(`TTS buffer created successfully: ${buffer.length} bytes`);
      return buffer;
    } catch (error) {
      logger.error("Error creating TTS stream:", error);
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
      logger.error("Error creating legacy TTS:", error);
      throw new Error(
        `Failed to generate legacy TTS: ${(error as Error).message}`,
      );
    }
  }

  // ===== SPEECH TRANSCRIPTION METHODS =====

  /**
   * Transcribes audio file to text using Whisper
   */
  static async transcribeAudio(audioFilePath: string): Promise<string> {
    const client = this.getClient();
    const fs = await import("fs");

    try {
      logger.info(`Transcribing audio file: ${audioFilePath}`);

      // Create a File object from the file path - use OGG since Whisper doesn't support OPUS
      const audioBuffer = fs.readFileSync(audioFilePath);
      const audioFile = new File([audioBuffer], "audio.ogg", {
        type: "audio/ogg",
      });

      const transcription = await client.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        language: "en", // Can be made configurable
      });

      logger.info(`Transcription successful: "${transcription.text}"`);
      return transcription.text.trim();
    } catch (error) {
      logger.error("Error transcribing audio:", error);
      throw new Error(
        `Failed to transcribe audio: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Transcribes audio buffer to text (for in-memory processing)
   */
  static async transcribeAudioBuffer(
    audioBuffer: Buffer,
    filename: string = "audio.wav",
  ): Promise<string> {
    const client = this.getClient();

    try {
      logger.info(`Transcribing audio buffer: ${audioBuffer.length} bytes`);

      // Create a File object directly from the WAV buffer
      const audioFile = new File([audioBuffer], filename, {
        type: "audio/wav",
      });

      const transcription = await client.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        language: "en", // Can be made configurable
      });

      logger.info(`Buffer transcription successful: "${transcription.text}"`);
      return transcription.text.trim();
    } catch (error) {
      logger.error("Error transcribing audio buffer:", error);
      throw new Error(
        `Failed to transcribe audio buffer: ${(error as Error).message}`,
      );
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
    } = {},
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
        throw new Error("No content in AI response");
      }

      return content;
    } catch (error) {
      logger.error("Error generating chat completion:", error);
      throw new Error(
        `Failed to generate AI response: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Batch processes quotes with AI (used sparingly)
   */
  static async batchParseQuotes(contents: string[]): Promise<any[]> {
    if (contents.length === 0) return [];

    try {
      const batchContent = contents.map((c, i) => `${i}: ${c}`).join("\n");
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: `Parse multiple Discord quotes. Return JSON array: [{"index": 0, "speaker": "name or null", "quote": "actual quote", "isQuoted": true/false}]`,
        },
        {
          role: "user",
          content: batchContent,
        },
      ];

      const result = await this.generateChatCompletion(messages, {
        temperature: 0.1,
        maxTokens: 1000,
      });

      return JSON.parse(result);
    } catch (error) {
      logger.error("Batch AI parsing failed:", error);
      // Fallback to simple parsing would be handled by the calling service
      throw new Error(
        `Failed to parse quotes with AI: ${(error as Error).message}`,
      );
    }
  }

  // ===== RESPONSES API METHODS (Modern Streaming) =====

  /**
   * Generate a response using the new Responses API with streaming
   */
  static async createResponseStream(
    input: string,
    options: {
      model?: string;
      stream?: boolean;
    } = {},
  ): Promise<AsyncIterable<any> | string> {
    const client = this.getClient();

    try {
      logger.info(`🚀 Creating Responses API stream for input: "${input.substring(0, 100)}..."`);

      const response = await client.responses.create({
        model: options.model || AI_CONFIG.CHAT_MODEL,
        input,
        stream: options.stream !== false, // Default to streaming
      });

      if (options.stream === false) {
        // Non-streaming response
        return typeof response === 'string' ? response : response.toString();
      }

      // Return the stream for iteration
      return response as AsyncIterable<any>;
    } catch (error) {
      logger.error("Error creating Responses API stream:", error);
      throw new Error(
        `Failed to create response stream: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Generate a simple text response using Responses API (non-streaming)
   */
  static async createResponse(
    input: string,
    options: {
      model?: string;
    } = {},
  ): Promise<string> {
    const stream = await this.createResponseStream(input, { 
      ...options, 
      stream: false 
    });
    
    if (typeof stream === 'string') {
      return stream;
    }
    
    throw new Error("Expected string response but got stream");
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
      logger.error("OpenAI health check failed:", error);
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
  batchParseQuotes,
  createResponseStream,
  createResponse,
  healthCheck,
} = OpenAIService;
