import { logger } from "../utils/logger";
import { OpenAIService } from "./openaiService";
import { RemarkResult, RemarkOptions } from "../types";

/**
 * Service for generating AI-powered remarks (compliments and insults)
 * Handles both positive and negative remarks with humor and personality
 */
export class RemarkService {

  /**
   * Generates a funny, lighthearted compliment about a subject
   */
  static async generatePraise(subject: string = "a discord user"): Promise<string> {
    return OpenAIService.generateCompliment(subject);
  }

  /**
   * Generates a funny, lighthearted insult about a subject
   */
  static async generateInsult(subject: string = "a discord user"): Promise<string> {
    return OpenAIService.generateInsult(subject);
  }

  /**
   * Generates a contextual remark based on positivity flag
   */
  static async generateRemark(
    subject?: string, 
    isPositive: boolean = Math.random() > 0.5
  ): Promise<RemarkResult> {
    const targetSubject = subject || "someone";
    const text = isPositive 
      ? await this.generatePraise(targetSubject)
      : await this.generateInsult(targetSubject);
    
    return { text, isPositive };
  }
}

// ===== CONVENIENCE EXPORTS =====
export const {
  generatePraise,
  generateInsult,
  generateRemark
} = RemarkService;

// Legacy exports for backward compatibility
export const getPraise = RemarkService.generatePraise;
export const getInsult = RemarkService.generateInsult;