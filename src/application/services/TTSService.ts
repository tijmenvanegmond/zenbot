import { Client, VoiceChannel } from 'discord.js';
import { playInVoiceChannel } from '../../infrastructure/voice/playInVoiceChannel';
import { OpenAIService } from '../../infrastructure/services/openaiService';
import { logger } from '../../utils/logger';

export class TTSService {
  constructor(
    private client: Client,
    private voiceService?: any // VoiceService for connection reuse
  ) {}
  
  async playInChannel(text: string, channelId: string): Promise<void> {
    try {
      logger.info(`🔊 Playing TTS in channel ${channelId}: "${text}"`);
      
      const channel = this.client.channels.cache.get(channelId) as VoiceChannel;
      if (!channel) {
        throw new Error(`Voice channel ${channelId} not found`);
      }
      
      // Generate TTS audio
      const audioBuffer = await OpenAIService.createTTSStream(text);
      
      // Check if we have an active connection to reuse
      const activeConnection = this.voiceService?.getActiveConnection(channelId);
      if (activeConnection) {
        logger.info(`🔊 Reusing active voice connection for TTS`);
        await this.playOnExistingConnection(activeConnection, audioBuffer);
      } else {
        logger.info(`🔊 Creating new connection for TTS (no active session)`);
        // Play in voice channel (will create and cleanup its own connection)
        await playInVoiceChannel(channel, audioBuffer);
      }
      
      logger.info(`🔊 TTS playback completed for: "${text}"`);
    } catch (error) {
      logger.error(`Error playing TTS in channel ${channelId}:`, error);
      throw error;
    }
  }

  private async playOnExistingConnection(connection: any, audioBuffer: Buffer): Promise<void> {
    const { createAudioPlayer, createAudioResource, StreamType } = await import('@discordjs/voice');
    const { Readable } = await import('stream');
    
    // Create a readable stream from the buffer
    const stream = Readable.from(audioBuffer);
    
    // Create audio resource for Discord.js voice
    const resource = createAudioResource(stream, {
      inputType: StreamType.Arbitrary,
    });
    
    // Create audio player
    const audioPlayer = createAudioPlayer();
    
    // Play the audio on the existing connection
    audioPlayer.play(resource);
    const subscription = connection.subscribe(audioPlayer);
    
    // Wait for playback to complete without destroying the connection
    return new Promise((resolve, reject) => {
      audioPlayer.on('stateChange', (oldState, newState) => {
        logger.info(`TTS player state: ${oldState.status} -> ${newState.status}`);
        if (newState.status === 'idle') {
          // Only unsubscribe, don't destroy the connection
          if (subscription) {
            subscription.unsubscribe();
          }
          resolve();
        }
      });
      
      audioPlayer.on('error', (error) => {
        logger.error(`TTS player error:`, error);
        if (subscription) {
          subscription.unsubscribe();
        }
        reject(error);
      });
    });
  }
}