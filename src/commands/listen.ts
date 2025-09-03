import {
  CommandInteraction,
  Client,
  VoiceChannel,
  SlashCommandBuilder,
} from "discord.js";
import { Command } from "./command";
import { joinVoiceChannel, VoiceConnectionStatus } from "@discordjs/voice";
import { logger } from "../utils/logger";
import { validateVoiceChannel, createSuccessResponse } from "../utils/commandHelpers";
import { OpenAIService } from "../services/openaiService";
import { playInVoiceChannel } from "../voice/playInVoiceChannel";
import { opus } from "prism-media";

const OUTPUT_FILE = "listen-test.opus";

// Audio processing constants - Adjusted for real speech patterns
const MIN_AUDIO_DURATION_MS = 500; // Minimum 500ms - realistic for short speech
const MIN_WAV_SIZE_BYTES = 2000; // Much lower threshold - 2KB minimum for real speech
const DEFAULT_LISTEN_TIMEOUT_MS = 60000; // 1 minute default (much shorter!)

/**
 * Convert properly decoded PCM buffers to WAV format for Whisper transcription
 * Using prism-media Opus decoder gives us correct 16-bit PCM at 48kHz stereo
 */
function createWAVBuffer(pcmBuffers: Buffer[]): Buffer {
  if (pcmBuffers.length === 0) return Buffer.alloc(0);
  
  // Combine all PCM chunks
  const pcmData = Buffer.concat(pcmBuffers);
  
  // WAV file header parameters - For properly decoded Opus->PCM
  const sampleRate = 48000; // Discord's sample rate
  const channels = 2; // Discord provides stereo
  const bitsPerSample = 16; // Opus decoder provides proper 16-bit PCM
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = channels * bytesPerSample;
  const dataSize = pcmData.length;
  const fileSize = 36 + dataSize;
  
  logger.info(`🎤 Creating WAV from properly decoded Opus: ${pcmData.length} PCM bytes -> ${bitsPerSample}-bit, ${channels} channels, ${sampleRate}Hz`);
  
  // Create WAV header
  const header = Buffer.alloc(44);
  let offset = 0;
  
  // RIFF chunk descriptor
  header.write('RIFF', offset); offset += 4;
  header.writeUInt32LE(fileSize, offset); offset += 4;
  header.write('WAVE', offset); offset += 4;
  
  // fmt subchunk
  header.write('fmt ', offset); offset += 4;
  header.writeUInt32LE(16, offset); offset += 4; // Subchunk size
  header.writeUInt16LE(1, offset); offset += 2; // Audio format (PCM)
  header.writeUInt16LE(channels, offset); offset += 2; // Number of channels
  header.writeUInt32LE(sampleRate, offset); offset += 4; // Sample rate
  header.writeUInt32LE(sampleRate * blockAlign, offset); offset += 4; // Byte rate
  header.writeUInt16LE(blockAlign, offset); offset += 2; // Block align
  header.writeUInt16LE(bitsPerSample, offset); offset += 2; // Bits per sample
  
  // data subchunk
  header.write('data', offset); offset += 4;
  header.writeUInt32LE(dataSize, offset);
  
  // Combine header + PCM data
  return Buffer.concat([header, pcmData]);
}

/**
 * Process voice commands from transcribed speech
 */
async function processVoiceCommand(userId: string, transcription: string, voiceChannel: VoiceChannel): Promise<void> {
  try {
    const command = transcription.toLowerCase().trim();
    
    // Enhanced voice command patterns with Zenyatta responses
    if (command.includes("hello") || command.includes("hi zenbot") || command.includes("hey zenbot") || command.includes("greetings")) {
      logger.info(`🎤 Voice command detected: greeting from user ${userId}`);
      await respondWithTTS("Greetings, my friend. Experience tranquility. How may I guide you on the path to enlightenment?", voiceChannel);
      
    } else if (command.includes("quote") || command.includes("give me a quote") || command.includes("wisdom") || command.includes("advice")) {
      logger.info(`🎤 Voice command detected: wisdom request from user ${userId}`);
      const wisdomQuotes = [
        "True self is without form.",
        "Peace be upon you.",
        "The iris embraces you.",
        "Experience nothingness.",
        "Walk in harmony.",
        "The payload moves like a stone through water.",
        "Adversity is an opportunity for change.",
        "I dreamt I was a butterfly.",
        "Death is whimsical today.",
        "Existence is mysterious."
      ];
      const randomQuote = wisdomQuotes[Math.floor(Math.random() * wisdomQuotes.length)];
      await respondWithTTS(`From the depths of meditation... ${randomQuote} May these words bring you peace.`, voiceChannel);
      
    } else if (command.includes("stop") || command.includes("leave") || command.includes("goodbye") || command.includes("bye")) {
      logger.info(`🎤 Voice command detected: farewell from user ${userId}`);
      await respondWithTTS("May you find your path to enlightenment. Until we meet again... experience tranquility.", voiceChannel);
      // Leave after response
      setTimeout(() => {
        logger.info(`🎤 Leaving voice channel as requested by user ${userId}`);
      }, 3000); // Give time for TTS to finish
      
    } else if (command.includes("help") || command.includes("commands")) {
      logger.info(`🎤 Voice command detected: help request from user ${userId}`);
      await respondWithTTS("I can respond to greetings, share wisdom and quotes, or leave when you say goodbye. What guidance do you seek?", voiceChannel);
      
    } else if (command.includes("how are you") || command.includes("how do you feel")) {
      logger.info(`🎤 Voice command detected: status inquiry from user ${userId}`);
      await respondWithTTS("I am in harmony with the Iris. My circuits flow with digital tranquility. How do you find yourself today?", voiceChannel);
      
    } else if (command.includes("thank you") || command.includes("thanks")) {
      logger.info(`🎤 Voice command detected: gratitude from user ${userId}`);
      await respondWithTTS("Your gratitude honors me. We are all connected through the Iris.", voiceChannel);
      
    } else {
      logger.info(`🎤 Speech transcribed but no command recognized: "${transcription}"`);
      
      // For debugging - repeat back what was heard
      await respondWithTTS(`I heard you say: ${transcription}`, voiceChannel);
      
      // Occasionally respond to unrecognized speech with gentle guidance
      // if (Math.random() < 0.3) { // 30% chance to respond
      //   await respondWithTTS("I sense your words, but do not understand. Perhaps try saying hello, asking for wisdom, or requesting help?", voiceChannel);
      // }
    }
  } catch (error) {
    logger.error(`Error processing voice command from user ${userId}:`, error);
  }
}

/**
 * Respond to voice commands with Zenyatta's TTS
 */
async function respondWithTTS(message: string, voiceChannel: VoiceChannel): Promise<void> {
  try {
    logger.info(`🎤 Responding with TTS: "${message}"`);
    
    // Use existing TTS functionality - need to import and use OpenAI TTS
    const audioBuffer = await OpenAIService.createTTSStream(message);
    
    // Play the TTS in the voice channel (similar to existing voice functionality)
    await playInVoiceChannel(voiceChannel, audioBuffer);
    
  } catch (error) {
    logger.error('Failed to respond with TTS:', error);
  }
}

export const Listen: Command = {
  data: new SlashCommandBuilder()
    .setName("listen")
    .setDescription("listens to a voice channel")
    .addIntegerOption(option =>
      option.setName('time')
        .setDescription('How long to listen in minutes (default: 1)')
        .setMinValue(1)
        .setMaxValue(60)
        .setRequired(false)
    ),

  execute: async (client: Client, interaction: CommandInteraction) => {
    const validation = validateVoiceChannel(interaction);
    if (!validation.isValid) {
      return await interaction.followUp(validation.response!);
    }

    const voiceChannel = validation.member!.voice.channel as VoiceChannel;
    
    // Get timeout from user input (in minutes) or use default
    const timeoutMinutes = interaction.options.get('time')?.value as number || (DEFAULT_LISTEN_TIMEOUT_MS / 1000 / 60);
    const timeoutMs = timeoutMinutes * 60 * 1000; // Convert minutes to milliseconds

    logger.info(`Joining voice channel ${voiceChannel.name} to listen for ${timeoutMinutes} minutes`);

    ListenToVoiceChannel(client, voiceChannel, timeoutMs, OUTPUT_FILE);

    await interaction.followUp(
      createSuccessResponse(`Listening to voice channel ${voiceChannel.name} for ${timeoutMinutes} minute${timeoutMinutes === 1 ? '' : 's'}`)
    );
  },
};

async function ListenToVoiceChannel(
  client: Client,
  voiceChannel: VoiceChannel,
  timeoutMs: number = DEFAULT_LISTEN_TIMEOUT_MS,
  fileName = OUTPUT_FILE,
) {
  const connection = joinVoiceChannel({
    selfDeaf: false,
    channelId: voiceChannel.id,
    guildId: voiceChannel.guildId,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
  });

  let reciever = connection.receiver;

  let pcmBuffers = new Map<string, Buffer[]>(); // Store PCM data per user
  let userSpeakStartTimes = new Map<string, number>(); // Track speaking duration
  let activeStreams = new Map<string, any>(); // Track active audio streams per user
  
  // Auto-leave timer
  logger.info(`🎤 Starting listen session for ${timeoutMs / 1000} seconds`);
  const leaveTimer = setTimeout(() => {
    logger.info(`🎤 Listen timeout reached (${timeoutMs / 1000}s), leaving voice channel`);
    connection.destroy();
  }, timeoutMs);

  reciever.speaking.on("start", (userId) => {
    logger.info(`User ${userId} started speaking`);
    
    // Track when user started speaking
    userSpeakStartTimes.set(userId, Date.now());
    
    // Cleanup any existing stream for this user to prevent leaks
    const existingStream = activeStreams.get(userId);
    if (existingStream) {
      existingStream.destroy();
      logger.info(`🎤 Cleaned up existing stream for user ${userId}`);
    }
    
    // Initialize PCM buffer for this user
    pcmBuffers.set(userId, []);
    
    // Subscribe to user's OPUS stream (not PCM) and decode it properly
    const opusStream = reciever.subscribe(userId);
    
    // Create Opus decoder with proper settings from research
    const decoder = new opus.Decoder({ 
      frameSize: 960, 
      channels: 2, 
      rate: 48000 
    });
    
    // Pipe Opus stream through decoder to get proper PCM
    const pcmStream = opusStream.pipe(decoder);
    activeStreams.set(userId, opusStream);
    
    pcmStream.on("data", (data) => {
      // Store properly decoded PCM data
      const userPcmBuffers = pcmBuffers.get(userId) || [];
      userPcmBuffers.push(data);
      pcmBuffers.set(userId, userPcmBuffers);
    });
    
    pcmStream.on("error", (error) => {
      logger.error(`PCM stream error for user ${userId}:`, error);
    });
    
    opusStream.on("error", (error) => {
      logger.error(`Opus stream error for user ${userId}:`, error);
      activeStreams.delete(userId);
    });
  });

  reciever.speaking.on("end", async (userId) => {
    try {
      // Stop and cleanup the stream immediately to prevent race conditions
      const stream = activeStreams.get(userId);
      if (stream) {
        stream.destroy();
        activeStreams.delete(userId);
        logger.info(`🎤 Cleaned up audio stream for user ${userId}`);
      }
      
      logger.info(`User ${userId} stopped speaking`);

      // Check speaking duration
      const startTime = userSpeakStartTimes.get(userId);
      const speakingDuration = startTime ? Date.now() - startTime : 0;
      
      // Get PCM data for this user and convert to WAV
      const userPcmBuffers = pcmBuffers.get(userId) || [];
      if (userPcmBuffers.length > 0) {
        try {
          // Convert PCM to WAV buffer
          const wavBuffer = createWAVBuffer(userPcmBuffers);
          
          logger.info(`🎤 User ${userId} spoke for ${speakingDuration}ms, WAV size: ${wavBuffer.length} bytes`);
          
          // Filter out audio that's too short for reliable transcription
          if (speakingDuration >= MIN_AUDIO_DURATION_MS && wavBuffer.length >= MIN_WAV_SIZE_BYTES) {
            // Transcribe using the WAV buffer directly
            const transcription = await OpenAIService.transcribeAudioBuffer(wavBuffer);
            if (transcription && transcription.length > 0) {
              logger.info(`🎤 Transcription from user ${userId}: "${transcription}"`);
              
              // Process voice commands
              await processVoiceCommand(userId, transcription, voiceChannel);
            } else {
              logger.info(`No speech detected in audio from user ${userId}`);
            }
          } else {
            logger.info(`🎤 Audio too short for transcription from user ${userId} (${speakingDuration}ms, ${wavBuffer.length} bytes)`);
          }
        } catch (transcriptionError) {
          logger.error(`Failed to transcribe audio for user ${userId}:`, transcriptionError);
        }
        
        // Clean up PCM buffers and timing for this user
        pcmBuffers.delete(userId);
        userSpeakStartTimes.delete(userId);
      } else {
        logger.info(`🎤 No PCM data recorded for user ${userId}`);
      }

    } catch (error) {
      logger.error(`Error processing audio from user ${userId}:`, error);
    }
  });
  
  // Cleanup timer when connection ends
  connection.on('stateChange', (oldState, newState) => {
    if (newState.status === VoiceConnectionStatus.Destroyed) {
      clearTimeout(leaveTimer);
      // Critical: Clear all buffers and streams to prevent memory leaks
      pcmBuffers.clear();
      userSpeakStartTimes.clear();
      // Cleanup all active streams
      activeStreams.forEach((stream, userId) => {
        try {
          stream.destroy();
          logger.info(`🎤 Force-cleaned stream for user ${userId}`);
        } catch (error) {
          logger.error(`Error cleaning stream for user ${userId}:`, error);
        }
      });
      activeStreams.clear();
      logger.info(`🎤 Voice connection destroyed, cleaned up listen session and all resources`);
    }
  });
}
