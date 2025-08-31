import { VoiceChannel } from "discord.js";
import { 
  AudioResource, 
  createAudioResource, 
  StreamType,
  createAudioPlayer,
  joinVoiceChannel,
  VoiceConnection,
  AudioPlayer
} from "@discordjs/voice";
import { Readable } from "stream";
import https from "https";
import http from "http";
import { logger } from "../utils/logger";
import { OpenAIService } from "./openaiService";
import { VoiceLineData, VoiceLineCategories, AdviceContext, API_CONFIG } from "../types";
import adviceList from "../voice/zenVoiceLines.json";


// ===== VOICE SERVICE CLASS =====
export class VoiceService {
  // Voice line data
  static readonly VoiceLineDataCollection: VoiceLineData[] = adviceList.legacy.data;
  static readonly VoiceLineCategories: VoiceLineCategories = adviceList.categories;

  // ===== TTS METHODS =====
  
  /**
   * Creates TTS stream with Zenyatta-style voice
   */
  static async createTTSStream(input: string): Promise<AudioResource> {
    try {
      const buffer = await OpenAIService.createTTSStream(input);
      
      const stream = new Readable();
      stream.push(buffer);
      stream.push(null);

      const resource = createAudioResource(stream, {
        inputType: StreamType.Arbitrary,
      });
      
      logger.info(`Created audio resource successfully`);
      return resource;
    } catch (error) {
      logger.error("Error creating TTS stream:", error);
      throw error;
    }
  }

  /**
   * Legacy file-based TTS (for compatibility)
   */
  static async createTTSFile(
    input: string,
    output = "./output.opus",
  ): Promise<void> {
    const buffer = await OpenAIService.createLegacyTTS(input);
    const fs = await import("node:fs");
    const path = await import("node:path");
    const speechFile = path.resolve(output);
    await fs.promises.writeFile(speechFile, buffer as any);
  }

  // ===== VOICE LINE METHODS =====

  /**
   * Gets random voice line from a category
   */
  static getRandomVoiceLineFromCategory(category: VoiceLineData[]): VoiceLineData {
    return category[Math.floor(Math.random() * category.length)];
  }

  /**
   * Gets contextual advice based on type
   */
  static getContextualAdvice(
    context?: AdviceContext
  ): VoiceLineData {
    switch (context) {
      case 'greeting':
        return this.getRandomVoiceLineFromCategory(this.VoiceLineCategories.greetings);
      case 'philosophical':
        return this.getRandomVoiceLineFromCategory(this.VoiceLineCategories.philosophical);
      case 'harmony':
        return this.getRandomVoiceLineFromCategory(this.VoiceLineCategories.orbOfHarmony);
      case 'discord':
        return this.getRandomVoiceLineFromCategory(this.VoiceLineCategories.orbOfDiscord);
      case 'transcendence':
        return this.getRandomVoiceLineFromCategory(this.VoiceLineCategories.transcendence);
      default:
        return this.getRandomVoiceLineFromCategory(this.VoiceLineCategories.philosophical);
    }
  }

  /**
   * Creates audio resource from voice line with TTS fallback
   */
  static async createVoiceLineResource(voiceLine: VoiceLineData): Promise<AudioResource> {
    logger.info(`Processing voice line: "${voiceLine.text}", voiceUri: ${voiceLine.voiceUri ? 'available' : 'null'}`);
    
    // Try to use the actual voice line file if available
    if (voiceLine.voiceUri) {
      try {
        logger.info(`Attempting to play voice line from: ${voiceLine.voiceUri}`);
        
        // Fetch the audio file from the URL
        const audioBuffer = await new Promise<Buffer>((resolve, reject) => {
          const client = voiceLine.voiceUri!.startsWith('https:') ? https : http;
          const request = client.get(voiceLine.voiceUri!, (response) => {
            if (response.statusCode === 200) {
              const chunks: Buffer[] = [];
              response.on('data', (chunk) => chunks.push(chunk));
              response.on('end', () => resolve(Buffer.concat(chunks)));
            } else {
              reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
            }
          });
          request.on('error', reject);
          request.setTimeout(API_CONFIG.REQUEST_TIMEOUT, () => {
            request.destroy();
            reject(new Error('Request timeout'));
          });
        });
        
        // Create a readable stream from the buffer
        const audioStream = new Readable({
          read() {
            this.push(audioBuffer);
            this.push(null);
          }
        });
        
        const resource = createAudioResource(audioStream, {
          inputType: StreamType.Arbitrary,
        });
        logger.info(`Successfully created audio resource from voice line file`);
        return resource;
      } catch (error) {
        logger.warn(`Error fetching voice line file: ${error}, falling back to TTS`);
      }
    }
    
    // Fallback to TTS if no voiceUri or if file fetch failed
    logger.info(`Using TTS fallback for voice line: "${voiceLine.text}"`);
    return await this.createTTSStream(voiceLine.text);
  }

  // ===== VOICE CHANNEL PLAYBACK METHODS =====

  /**
   * Plays audio resource in voice channel with proper connection management
   */
  static async playResourceInChannel(
    voiceChannel: VoiceChannel,
    resource: AudioResource,
  ): Promise<void> {
    try {
      logger.info(`Attempting to join voice channel: ${voiceChannel.name}`);
      const connection: VoiceConnection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      });

      logger.info(`Creating audio player for resource`);
      const audioPlayer: AudioPlayer = createAudioPlayer();

      logger.info(`Starting audio playback`);
      audioPlayer.play(resource);
      const subscription = connection.subscribe(audioPlayer);
      
      logger.info(`Audio player state: ${audioPlayer.state.status}`);

      audioPlayer.on("stateChange", (oldState, newState) => {
        logger.info(`Audio player state changed: ${oldState.status} -> ${newState.status}`);
        if (newState.status === "idle") {
          if (subscription) subscription.unsubscribe();
          connection.disconnect();
          connection.destroy();
          logger.info(`Zenbot left voice channel`);
        }
      });

      audioPlayer.on("error", (error) => {
        logger.error(`Error in audio player:`, error);
        if (subscription) subscription.unsubscribe();
        connection.disconnect();
        connection.destroy();
      });
      
      connection.on("stateChange", (oldState, newState) => {
        logger.info(`Voice connection state: ${oldState.status} -> ${newState.status}`);
      });
      
      connection.on("error", (error) => {
        logger.error(`Voice connection error:`, error);
      });
      
    } catch (error) {
      logger.error("Error in playResourceInChannel:", error);
      throw error;
    }
  }

  /**
   * Plays TTS directly in voice channel
   */
  static async playTTSInChannel(channel: VoiceChannel, text: string): Promise<void> {
    try {
      const resource = await this.createTTSStream(text);
      await this.playResourceInChannel(channel, resource);
      logger.info(`TTS played in channel ${channel.name}: "${text}"`);
    } catch (error) {
      logger.error("Error playing TTS in voice channel:", error);
      throw error;
    }
  }

  /**
   * Plays voice line in channel with intelligent fallback
   */
  static async playVoiceLineInChannel(
    channel: VoiceChannel, 
    voiceLine: VoiceLineData
  ): Promise<void> {
    try {
      const resource = await this.createVoiceLineResource(voiceLine);
      await this.playResourceInChannel(channel, resource);
      logger.info(`Voice line played in channel ${channel.name}: "${voiceLine.text}"`);
    } catch (error) {
      logger.error("Error playing voice line in voice channel:", error);
      throw error;
    }
  }
}

// ===== CONVENIENCE EXPORTS =====
export const {
  createTTSStream,
  createTTSFile,
  getRandomVoiceLineFromCategory,
  getContextualAdvice,
  createVoiceLineResource,
  playResourceInChannel,
  playTTSInChannel,
  playVoiceLineInChannel,
  VoiceLineDataCollection
} = VoiceService;

