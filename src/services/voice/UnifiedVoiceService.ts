import { VoiceChannel } from "discord.js";
import { AudioResource } from "@discordjs/voice";
import { VoiceConfig, VoiceRequest, VoiceResult } from "./types";
import { AudioManager } from "./AudioManager";
import { ProfileManager } from "./ProfileManager";
import { ProviderFactory } from "./providers/ProviderFactory";
import { logger } from "../../utils/logger";

/**
 * Unified Voice Service - Single entry point for all voice operations
 * Replaces VoiceService, LocalTTSService, LinuxVoiceService, SmartTtsService, VoiceManager
 */
export class UnifiedVoiceService {
  private static instance: UnifiedVoiceService;
  private audioManager: AudioManager;
  private profileManager: ProfileManager;
  private providerFactory: ProviderFactory;

  private constructor() {
    this.audioManager = AudioManager.getInstance();
    this.profileManager = ProfileManager.getInstance();
    this.providerFactory = ProviderFactory.getInstance();
  }

  static getInstance(): UnifiedVoiceService {
    if (!this.instance) {
      this.instance = new UnifiedVoiceService();
    }
    return this.instance;
  }

  /**
   * Main method: Speak text in voice channel
   * Replaces all TTS methods across the codebase
   */
  async speak(request: VoiceRequest): Promise<VoiceResult> {
    const startTime = Date.now();
    logger.info(
      `🎤 Voice request: "${request.text.substring(0, 50)}..." (profile: ${request.profile || "default"})`,
    );

    try {
      // Validate request
      this.validateRequest(request);

      // Get voice configuration
      const config = this.profileManager.getConfig(request.profile);
      logger.debug(`🎤 Using voice config:`, config);

      // Get TTS provider
      const provider = this.providerFactory.getProvider(config.provider);

      // Generate audio
      const audioResource = await provider.createAudio(request.text, config);

      // Play in voice channel if specified
      if (request.voiceChannel) {
        await this.audioManager.playAudio(request.voiceChannel, audioResource, {
          activityType: request.activityType || "tts",
          interruptExisting: request.interruptExisting || false,
        });
      }

      const duration = Date.now() - startTime;
      logger.info(`🎤 Voice request completed in ${duration}ms`);

      return {
        success: true,
        audioResource,
        config,
        duration,
        provider: config.provider,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`🎤 Voice request failed after ${duration}ms:`, error);

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        duration,
      };
    }
  }

  /**
   * Create audio without playing (for API use)
   */
  async createAudio(text: string, profile?: string): Promise<AudioResource> {
    const result = await this.speak({
      text,
      profile,
      // No voice channel = don't play, just create
    });

    if (!result.success || !result.audioResource) {
      throw new Error(result.error || "Failed to create audio");
    }

    return result.audioResource;
  }

  /**
   * Quick speak in voice channel (convenience method)
   */
  async speakInChannel(
    voiceChannel: VoiceChannel,
    text: string,
    profile?: string,
  ): Promise<void> {
    const result = await this.speak({
      text,
      profile,
      voiceChannel,
    });

    if (!result.success) {
      throw new Error(result.error || "Failed to speak in channel");
    }
  }

  /**
   * Get available voice profiles
   */
  getAvailableProfiles(): string[] {
    return this.profileManager.getAvailableProfiles();
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): string[] {
    return this.providerFactory.getAvailableProviders();
  }

  /**
   * Test voice configuration
   */
  async testVoice(
    profile?: string,
    testText: string = "Testing voice configuration",
  ): Promise<VoiceResult> {
    return this.speak({
      text: testText,
      profile,
    });
  }

  /**
   * Get service status and configuration
   */
  getStatus() {
    return {
      providers: this.providerFactory.getProviderStatus(),
      profiles: this.profileManager.getProfileSummary(),
      audio: this.audioManager.getStatus(),
    };
  }

  /**
   * Validate voice request
   */
  private validateRequest(request: VoiceRequest): void {
    if (
      !request.text ||
      typeof request.text !== "string" ||
      request.text.trim().length === 0
    ) {
      throw new Error("Text is required and must be a non-empty string");
    }

    if (request.text.length > 1000) {
      throw new Error("Text is too long (maximum 1000 characters)");
    }
  }

  /**
   * Stop all audio in guild
   */
  async stopAudio(guildId: string): Promise<void> {
    await this.audioManager.stopAudio(guildId);
  }

  /**
   * Join voice channel
   */
  async joinChannel(voiceChannel: VoiceChannel): Promise<void> {
    await this.audioManager.joinChannel(voiceChannel);
  }

  /**
   * Leave voice channel
   */
  async leaveChannel(guildId: string): Promise<void> {
    await this.audioManager.leaveChannel(guildId);
  }
}
