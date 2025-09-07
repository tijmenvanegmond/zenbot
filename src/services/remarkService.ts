import { logger } from "../utils/logger";
import { ZenyattaAssistantService } from "./zenyattaAssistantService";
import { RemarkResult, RemarkOptions } from "../types";

/**
 * Service for generating AI-powered remarks (compliments and insults)
 * Now uses the consolidated Zenyatta Agent for consistent personality
 */
export class RemarkService {
  /**
   * Generates a funny, lighthearted compliment about a subject using Zenyatta's personality
   */
  static async generatePraise(
    subject: string = "a discord user",
  ): Promise<string> {
    const zenyatta = ZenyattaAssistantService.getInstance();
    return zenyatta.generateCompliment(subject);
  }

  /**
   * Generates a funny, lighthearted insult about a subject using Zenyatta's personality
   */
  static async generateInsult(
    subject: string = "a discord user",
  ): Promise<string> {
    const zenyatta = ZenyattaAssistantService.getInstance();
    return zenyatta.generateInsult(subject);
  }

  /**
   * Generates a contextual remark based on positivity flag using Zenyatta's personality
   */
  static async generateRemark(
    subject?: string,
    isPositive: boolean = Math.random() > 0.5,
  ): Promise<RemarkResult> {
    const zenyatta = ZenyattaAssistantService.getInstance();
    return zenyatta.generateRemark(subject, isPositive);
  }
}

// ===== CONVENIENCE EXPORTS =====
export const { generatePraise, generateInsult, generateRemark } = RemarkService;

// Legacy exports for backward compatibility
export const getPraise = RemarkService.generatePraise;
export const getInsult = RemarkService.generateInsult;
