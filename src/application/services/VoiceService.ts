import { EventEmitter } from 'events';
import { Client, VoiceChannel } from 'discord.js';
import { joinVoiceChannel, VoiceConnectionStatus } from '@discordjs/voice';
import { opus } from 'prism-media';
import { OpenAIService } from '../../infrastructure/services/openaiService';
import { logger } from '../../utils/logger';

// Audio processing constants
const MIN_AUDIO_DURATION_MS = 500;
const MIN_WAV_SIZE_BYTES = 2000;

export class VoiceService {
  private activeConnections = new Map<string, any>();
  
  constructor(
    private client: Client,
    private eventBus: EventEmitter
  ) {}
  
  // Get active connection for TTS reuse
  getActiveConnection(channelId: string): any {
    return this.activeConnections.get(channelId);
  }
  
  async startListening(channelId: string, duration: number): Promise<void> {
    const channel = this.client.channels.cache.get(channelId) as VoiceChannel;
    if (!channel) {
      throw new Error(`Voice channel ${channelId} not found`);
    }
    
    logger.info(`🎧 Starting to listen in channel ${channel.name} for ${duration}ms`);
    
    const connection = joinVoiceChannel({
      selfDeaf: false,
      channelId: channel.id,
      guildId: channel.guildId,
      adapterCreator: channel.guild.voiceAdapterCreator,
    });
    
    this.activeConnections.set(channelId, connection);
    
    const receiver = connection.receiver;
    const pcmBuffers = new Map<string, Buffer[]>();
    const userSpeakStartTimes = new Map<string, number>();
    const activeStreams = new Map<string, any>();
    
    // Auto-leave timer
    const leaveTimer = setTimeout(() => {
      logger.info(`🎧 Listen timeout reached (${duration}ms), ending session`);
      this.cleanup(channelId, connection, pcmBuffers, activeStreams);
    }, duration);
    
    // Voice activity detection
    receiver.speaking.on('start', (userId) => {
      logger.info(`🎤 User ${userId} started speaking`);
      
      userSpeakStartTimes.set(userId, Date.now());
      
      // Cleanup existing stream for this user
      const existingStream = activeStreams.get(userId);
      if (existingStream) {
        existingStream.destroy();
      }
      
      pcmBuffers.set(userId, []);
      
      // Subscribe to Opus stream and decode properly
      const opusStream = receiver.subscribe(userId);
      const decoder = new opus.Decoder({ 
        frameSize: 960, 
        channels: 2, 
        rate: 48000 
      });
      
      const pcmStream = opusStream.pipe(decoder);
      activeStreams.set(userId, opusStream);
      
      pcmStream.on('data', (data) => {
        const userPcmBuffers = pcmBuffers.get(userId) || [];
        userPcmBuffers.push(data);
        pcmBuffers.set(userId, userPcmBuffers);
      });
      
      pcmStream.on('error', (error) => {
        logger.error(`PCM stream error for user ${userId}:`, error);
      });
      
      opusStream.on('error', (error) => {
        logger.error(`Opus stream error for user ${userId}:`, error);
        activeStreams.delete(userId);
      });
    });
    
    receiver.speaking.on('end', async (userId) => {
      try {
        // Cleanup stream immediately
        const stream = activeStreams.get(userId);
        if (stream) {
          stream.destroy();
          activeStreams.delete(userId);
        }
        
        logger.info(`🎤 User ${userId} stopped speaking`);
        
        const startTime = userSpeakStartTimes.get(userId);
        const speakingDuration = startTime ? Date.now() - startTime : 0;
        
        const userPcmBuffers = pcmBuffers.get(userId) || [];
        if (userPcmBuffers.length > 0) {
          try {
            const wavBuffer = this.createWAVBuffer(userPcmBuffers);
            
            logger.info(`🎤 User ${userId} spoke for ${speakingDuration}ms, WAV size: ${wavBuffer.length} bytes`);
            
            // Filter audio quality
            if (speakingDuration >= MIN_AUDIO_DURATION_MS && wavBuffer.length >= MIN_WAV_SIZE_BYTES) {
              const transcription = await OpenAIService.transcribeAudioBuffer(wavBuffer);
              
              if (transcription && transcription.length > 0) {
                logger.info(`🎤 Transcription from user ${userId}: "${transcription}"`);
                
                // Emit transcription event for session manager
                this.eventBus.emit('voice.transcribed', {
                  text: transcription,
                  userId,
                  channelId,
                  timestamp: new Date()
                });
              }
            } else {
              logger.info(`🎤 Audio too short for transcription (${speakingDuration}ms, ${wavBuffer.length} bytes)`);
            }
          } catch (error) {
            logger.error(`Failed to transcribe audio for user ${userId}:`, error);
          }
          
          // Cleanup user data
          pcmBuffers.delete(userId);
          userSpeakStartTimes.delete(userId);
        }
      } catch (error) {
        logger.error(`Error processing audio from user ${userId}:`, error);
      }
    });
    
    // Connection state management
    connection.on('stateChange', (oldState, newState) => {
      logger.info(`Voice connection state: ${oldState.status} -> ${newState.status}`);
      
      if (newState.status === VoiceConnectionStatus.Destroyed) {
        clearTimeout(leaveTimer);
        this.cleanup(channelId, connection, pcmBuffers, activeStreams);
      }
    });
    
    connection.on('error', (error) => {
      logger.error('Voice connection error:', error);
      clearTimeout(leaveTimer);
      this.cleanup(channelId, connection, pcmBuffers, activeStreams);
    });
    
    // Wait for session to end
    return new Promise((resolve) => {
      const checkSessionEnd = () => {
        if (!this.activeConnections.has(channelId)) {
          resolve();
        } else {
          setTimeout(checkSessionEnd, 1000);
        }
      };
      checkSessionEnd();
    });
  }
  
  private cleanup(
    channelId: string, 
    connection: any, 
    pcmBuffers: Map<string, Buffer[]>, 
    activeStreams: Map<string, any>
  ): void {
    // Clear all buffers and streams
    pcmBuffers.clear();
    
    activeStreams.forEach((stream, userId) => {
      try {
        stream.destroy();
      } catch (error) {
        logger.error(`Error cleaning stream for user ${userId}:`, error);
      }
    });
    activeStreams.clear();
    
    // Destroy connection
    try {
      if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
        connection.destroy();
      }
    } catch (error) {
      logger.error('Error destroying voice connection:', error);
    }
    
    this.activeConnections.delete(channelId);
    logger.info(`🎧 Voice connection cleaned up for channel ${channelId}`);
  }
  
  private createWAVBuffer(pcmBuffers: Buffer[]): Buffer {
    if (pcmBuffers.length === 0) return Buffer.alloc(0);
    
    const pcmData = Buffer.concat(pcmBuffers);
    
    // WAV file header parameters
    const sampleRate = 48000;
    const channels = 2;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = channels * bytesPerSample;
    const dataSize = pcmData.length;
    const fileSize = 36 + dataSize;
    
    // Create WAV header
    const header = Buffer.alloc(44);
    let offset = 0;
    
    // RIFF chunk descriptor
    header.write('RIFF', offset); offset += 4;
    header.writeUInt32LE(fileSize, offset); offset += 4;
    header.write('WAVE', offset); offset += 4;
    
    // fmt subchunk
    header.write('fmt ', offset); offset += 4;
    header.writeUInt32LE(16, offset); offset += 4;
    header.writeUInt16LE(1, offset); offset += 2;
    header.writeUInt16LE(channels, offset); offset += 2;
    header.writeUInt32LE(sampleRate, offset); offset += 4;
    header.writeUInt32LE(sampleRate * blockAlign, offset); offset += 4;
    header.writeUInt16LE(blockAlign, offset); offset += 2;
    header.writeUInt16LE(bitsPerSample, offset); offset += 2;
    
    // data subchunk
    header.write('data', offset); offset += 4;
    header.writeUInt32LE(dataSize, offset);
    
    return Buffer.concat([header, pcmData]);
  }
}