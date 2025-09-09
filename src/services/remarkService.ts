import { logger } from "../utils/logger";
import { UnifiedZenyattaService } from "./unifiedZenyattaService";
import { RemarkResult, RemarkOptions } from "../types";
import { CommandInteraction } from "discord.js";

/**
 * Service for generating AI-powered remarks (compliments and insults)
 * Now uses the unified AI abstraction layer with conversation memory and provider flexibility
 */
export class RemarkService {
  /**
   * Generates a funny, lighthearted compliment about a subject using unified Zenyatta service with conversation memory
   */
  static async generatePraise(
    interaction: CommandInteraction,
    subject: string = "a discord user",
  ): Promise<string> {
    const zenyatta = UnifiedZenyattaService.getInstance();
    logger.info(`🧘 RemarkService using unified compliment generation for: ${subject}`);
    
    const result = await zenyatta.generateRemark(interaction, subject, true);
    return result.text;
  }

  /**
   * Generates a funny, lighthearted insult about a subject using unified Zenyatta service with conversation memory  
   */
  static async generateInsult(
    interaction: CommandInteraction,
    subject: string = "a discord user",
  ): Promise<string> {
    const zenyatta = UnifiedZenyattaService.getInstance();
    logger.info(`🧘 RemarkService using unified critique generation for: ${subject}`);
    
    const result = await zenyatta.generateRemark(interaction, subject, false);
    return result.text;
  }

  /**
   * Generates a contextual remark based on positivity flag using unified Zenyatta service with conversation memory
   */
  static async generateRemark(
    interaction: CommandInteraction,
    subject?: string,
    isPositive: boolean = Math.random() > 0.5,
  ): Promise<RemarkResult> {
    const zenyatta = UnifiedZenyattaService.getInstance();
    logger.info(`🧘 RemarkService using unified remark generation (${isPositive ? 'positive' : 'negative'}) for: ${subject}`);
    
    return zenyatta.generateRemark(interaction, subject, isPositive);
  }
}

// ===== CONVENIENCE EXPORTS =====
export const { generatePraise, generateInsult, generateRemark } = RemarkService;

// Legacy exports for backward compatibility - now require interaction parameter
export const getPraise = RemarkService.generatePraise;
export const getInsult = RemarkService.generateInsult;
