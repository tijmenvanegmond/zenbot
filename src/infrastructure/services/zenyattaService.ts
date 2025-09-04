import { OpenAIService } from "./openaiService";
import { logger } from "../../utils/logger";
import { EnrichedQuote } from "../../types";
import fs from "fs";
import path from "path";

/**
 * Zenyatta Personality Service - Dynamic contextual commentary generation
 * Channels the wisdom of the omnic monk for personalized quote introductions
 */
export class ZenyattaService {
  private static personalityGuide: string | null = null;

  /**
   * Loads the Zenyatta personality guide
   */
  private static async loadPersonalityGuide(): Promise<string> {
    if (this.personalityGuide) {
      return this.personalityGuide;
    }

    try {
      const guidePath = path.resolve(__dirname, "../../ZENYATTA_PERSONALITY.md");
      this.personalityGuide = await fs.promises.readFile(guidePath, "utf-8");
      logger.info("Zenyatta personality guide loaded successfully");
      return this.personalityGuide;
    } catch (error) {
      logger.error("Failed to load Zenyatta personality guide:", error);
      // Fallback personality if file not found
      this.personalityGuide = `
        Zenyatta is a wise omnic monk who speaks calmly and philosophically.
        He finds deeper meaning in all things and speaks with compassion and wisdom.
        He uses phrases like "Experience tranquility" and references harmony and balance.
      `;
      return this.personalityGuide;
    }
  }

  /**
   * Analyzes a quote and generates contextual Zenyatta commentary
   */
  static async generateQuoteCommentary(quote: EnrichedQuote): Promise<string> {
    try {
      const personalityGuide = await this.loadPersonalityGuide();
      
      logger.info(`Generating Zenyatta commentary for quote: "${quote.parsedQuote.substring(0, 50)}..."`);

      const systemPrompt = `You are Zenyatta, the omnic monk from Overwatch. Use this personality guide:

${personalityGuide}

Generate a SHORT (3-10 words) contextual introduction that you would say before reading someone's quote aloud. 

Key guidelines:
- Keep it concise - maximum 10 words
- Stay in character as the wise, calm omnic monk
- Create a snappy introduction that flows naturally into the quote
- Don't repeat the quote content, just introduce it
- Use Zenyatta's simple, direct style
- Examples: "Wisdom flows...", "The heart speaks...", "Truth emerges...", "From chaos, clarity..."

The introduction should be like a brief meditation before the quote.`;

      const userPrompt = `Quote to introduce: "${quote.parsedQuote}"
Speaker: ${quote.speaker || quote.poster.displayName}
Context: ${quote.isQuoted ? "Structured quote" : "Casual message"}
Original message: "${quote.content}"

Generate Zenyatta's contextual introduction:`;

      const commentary = await OpenAIService.generateChatCompletion([
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ], {
        temperature: 0.6,
        maxTokens: 30,
      });

      // Clean up the response and ensure it doesn't end with punctuation that would clash
      let cleanCommentary = commentary.trim();
      if (cleanCommentary.endsWith('.') || cleanCommentary.endsWith('!') || cleanCommentary.endsWith('?')) {
        cleanCommentary = cleanCommentary.slice(0, -1);
      }

      logger.info(`Generated Zenyatta commentary: "${cleanCommentary}"`);
      return cleanCommentary;
    } catch (error) {
      logger.error("Error generating Zenyatta commentary:", error);
      
      // Fallback to simple contextual introductions if AI fails
      const fallbacks = [
        "Wisdom flows",
        "Truth emerges",  
        "The heart speaks",
        "From silence",
        "Light reveals"
      ];
      
      const fallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      logger.info(`Using fallback commentary: "${fallback}"`);
      return fallback;
    }
  }

  /**
   * Creates complete TTS text with Zenyatta commentary + quote
   */
  static async createEnhancedQuoteTTS(quote: EnrichedQuote): Promise<string> {
    try {
      const commentary = await this.generateQuoteCommentary(quote);
      const quoteText = quote.isQuoted ? quote.parsedQuote : quote.content;
      
      // Create natural flow between commentary and quote
      const enhancedText = `${commentary}... ${quoteText}`;
      
      logger.info(`Enhanced quote TTS created: "${enhancedText.substring(0, 100)}..."`);
      return enhancedText;
    } catch (error) {
      logger.error("Error creating enhanced quote TTS:", error);
      // Fallback to original quote if enhancement fails
      return quote.isQuoted ? quote.parsedQuote : quote.content;
    }
  }

  /**
   * Generates philosophical response to a topic
   */
  static async generatePhilosophicalResponse(topic: string): Promise<string> {
    try {
      const personalityGuide = await this.loadPersonalityGuide();
      
      const systemPrompt = `You are Zenyatta, the omnic monk. Use this personality guide:

${personalityGuide}

Respond to topics with Zenyatta's wisdom and philosophy. Keep responses concise (1-3 sentences) and true to character.`;

      const userPrompt = `Topic: ${topic}

How would Zenyatta respond?`;

      const response = await OpenAIService.generateChatCompletion([
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ], {
        temperature: 0.8,
        maxTokens: 200,
      });

      return response.trim();
    } catch (error) {
      logger.error("Error generating philosophical response:", error);
      return "Experience tranquility. The path forward becomes clear through patient contemplation.";
    }
  }

  /**
   * Health check for personality service
   */
  static async healthCheck(): Promise<boolean> {
    try {
      const guide = await this.loadPersonalityGuide();
      return guide.length > 100; // Basic validation
    } catch (error) {
      logger.error("Zenyatta service health check failed:", error);
      return false;
    }
  }
}

// Export convenience methods
export const {
  generateQuoteCommentary,
  createEnhancedQuoteTTS,
  generatePhilosophicalResponse,
  healthCheck: zenyattaHealthCheck
} = ZenyattaService;