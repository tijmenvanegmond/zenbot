import {
  ZenAction,
  ActionContext,
  ActionParameters,
  ActionResult,
} from "../actionTypes";
import { VoiceSessionManager } from "../../services/voiceSessionManager";
import { joinVoiceChannel, VoiceConnectionStatus } from "@discordjs/voice";
import { logger } from "../../utils/logger";
import { OpenAIService } from "../../services/openaiService";
import { ZenyattaAssistantService } from "../../services/zenyattaAssistantService";
import { ActionService } from "../../services/actionService";
import { opus } from "prism-media";

// Audio processing constants - Adjusted for real speech patterns
const MIN_AUDIO_DURATION_MS = 500; // Minimum 500ms - realistic for short speech
const MIN_WAV_SIZE_BYTES = 2000; // Much lower threshold - 2KB minimum for real speech

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

  logger.info(
    `🎤 Creating WAV from properly decoded Opus: ${pcmData.length} PCM bytes -> ${bitsPerSample}-bit, ${channels} channels, ${sampleRate}Hz`,
  );

  // Create WAV header
  const header = Buffer.alloc(44);
  let offset = 0;

  // RIFF chunk descriptor
  header.write("RIFF", offset);
  offset += 4;
  header.writeUInt32LE(fileSize, offset);
  offset += 4;
  header.write("WAVE", offset);
  offset += 4;

  // fmt subchunk
  header.write("fmt ", offset);
  offset += 4;
  header.writeUInt32LE(16, offset);
  offset += 4; // Subchunk size
  header.writeUInt16LE(1, offset);
  offset += 2; // Audio format (PCM)
  header.writeUInt16LE(channels, offset);
  offset += 2; // Number of channels
  header.writeUInt32LE(sampleRate, offset);
  offset += 4; // Sample rate
  header.writeUInt32LE(sampleRate * blockAlign, offset);
  offset += 4; // Byte rate
  header.writeUInt16LE(blockAlign, offset);
  offset += 2; // Block align
  header.writeUInt16LE(bitsPerSample, offset);
  offset += 2; // Bits per sample

  // data subchunk
  header.write("data", offset);
  offset += 4;
  header.writeUInt32LE(dataSize, offset);

  // Combine header + PCM data
  return Buffer.concat([header, pcmData]);
}

/**
 * Process voice commands from transcribed speech using Zenyatta AI and action system
 */
async function processVoiceCommand(
  userId: string,
  transcription: string,
  context: ActionContext,
): Promise<void> {
  try {
    logger.info(
      `🎤 Processing voice input from user ${userId}: "${transcription}"`,
    );

    if (!context.voiceChannel) {
      logger.warn(
        "🎤 No voice channel in context for voice command processing",
      );
      return;
    }

    // Get the Zenyatta assistant for intelligent conversation
    const zenyatta = ZenyattaAssistantService.getInstance();

    // Create a mock interaction object for the assistant to use
    const mockInteraction = {
      user: {
        id: userId,
        username: `VoiceUser_${userId.slice(-4)}`, // Use last 4 chars for readable username
      },
      guild: context.guild
        ? {
            name: context.guild.name,
            id: context.guild.id,
          }
        : undefined,
      guildId: context.guild?.id,
      member: {
        voice: {
          channel: context.voiceChannel, // User is in voice channel
        },
      },
      options: {
        get: (key: string) => null,
      },
    } as any;

    // Use the assistant to have a natural conversation with the voice input
    const response = await zenyatta.converse(mockInteraction, transcription);

    // Always use voice response since this is a voice interaction
    const voiceText = response.voiceText || response.text;

    logger.info(
      `🎤 AI responding to voice input: "${voiceText.substring(0, 100)}..." (mood: ${response.mood})`,
    );

    // Use action system to play TTS response
    const actionService = ActionService.getInstance();
    await actionService.executeFromVoice(
      userId,
      context.guild!.id,
      context.voiceChannel,
      "enhanced_tts",
      {
        text: voiceText,
        activity_type: "voice-response",
        voice_style: "normal",
      },
    );
  } catch (error) {
    logger.error(
      `🎤 Error processing voice command from user ${userId}:`,
      error,
    );

    // Fallback response in case of AI failure
    if (context.voiceChannel && context.guild) {
      const actionService = ActionService.getInstance();
      await actionService.executeFromVoice(
        userId,
        context.guild.id,
        context.voiceChannel,
        "enhanced_tts",
        {
          text: "I sense a disturbance in my consciousness. Please try speaking again, and we shall find harmony.",
          activity_type: "voice-error",
          voice_style: "normal",
        },
      );
    }
  }
}

export class ListenControlAction implements ZenAction {
  name = "listen_control";
  description =
    "Start or stop listening to voice channel for transcription and AI responses";
  category = "voice" as const;

  permissions = {
    requiresVoiceChannel: true,
    allowedSources: ["command", "voice", "api", "ai"],
  };

  schema = {
    name: "listen_control",
    description:
      "Control voice listening sessions - start listening to transcribe speech and respond with AI",
    parameters: {
      type: "object" as const,
      properties: {
        action: {
          type: "string" as const,
          description: "The listening action to perform",
          enum: ["start", "stop", "status"],
        },
        duration_minutes: {
          type: "number" as const,
          description: "How long to listen in minutes (1-60, default: 1)",
        },
      },
      required: ["action"],
    },
  };

  async execute(
    context: ActionContext,
    parameters: ActionParameters,
  ): Promise<ActionResult> {
    try {
      const { action, duration_minutes = 1 } = parameters;

      if (!context.voiceChannel || !context.guild) {
        return {
          success: false,
          error: "Voice channel and guild context required",
          shouldRespond: true,
          responseText: "I need to be in a voice channel to start listening",
        };
      }

      const sessionManager = VoiceSessionManager.getInstance();

      switch (action) {
        case "start": {
          // Validate duration
          const duration = Math.max(1, Math.min(60, duration_minutes));
          const timeoutMs = duration * 60 * 1000;

          // Check if already listening
          const existingSession = sessionManager.getSession(context.guild.id);
          if (existingSession?.activeActivities.has("listen")) {
            return {
              success: false,
              message: "Already listening",
              shouldRespond: true,
              responseText: "I am already listening to the voice channel",
            };
          }

          // Start listening session
          logger.info(
            `🎭 Starting listen session for ${duration} minutes via action`,
          );

          // Create voice connection if needed
          let connection;
          if (existingSession) {
            connection = existingSession.connection;
          } else {
            connection = joinVoiceChannel({
              selfDeaf: false,
              channelId: context.voiceChannel.id,
              guildId: context.guild.id,
              adapterCreator: context.voiceChannel.guild.voiceAdapterCreator,
            });
          }

          // Register the listen session
          await sessionManager.registerSession(
            context.guild.id,
            context.voiceChannel.id,
            connection,
            "listen",
          );

          // Set up timeout to end listening
          setTimeout(async () => {
            logger.info(
              `🎭 Listen timeout reached (${duration}m), ending listen session via action`,
            );
            await sessionManager.endActivity(context.guild!.id, "listen");
          }, timeoutMs);

          // Set up voice listening with transcription and AI processing
          this.setupVoiceListening(connection, context);
          logger.info(
            `🎭 Voice listening with AI processing enabled for ${duration} minutes`,
          );

          return {
            success: true,
            message: `Started listening for ${duration} minutes`,
            data: { duration, channel: context.voiceChannel.name },
            shouldRespond: true,
            responseText: `I am now listening to ${context.voiceChannel.name} for ${duration} minute${duration === 1 ? "" : "s"}. Speak to me and I will respond!`,
          };
        }

        case "stop": {
          const session = sessionManager.getSession(context.guild.id);
          if (session?.activeActivities.has("listen")) {
            await sessionManager.endActivity(context.guild!.id, "listen");
            logger.info(`🎭 Listen session stopped via action`);
            return {
              success: true,
              message: "Stopped listening",
              shouldRespond: true,
              responseText: "I have stopped listening to the voice channel",
            };
          } else {
            return {
              success: false,
              message: "Not currently listening",
              shouldRespond: true,
              responseText: "I am not currently listening to any voice channel",
            };
          }
        }

        case "status": {
          const session = sessionManager.getSession(context.guild.id);
          if (session?.activeActivities.has("listen")) {
            const activities = Array.from(session.activeActivities);
            return {
              success: true,
              message: "Currently listening",
              data: {
                listening: true,
                activities,
                channel: context.voiceChannel.name,
              },
              shouldRespond: true,
              responseText: `I am currently listening to ${context.voiceChannel.name} with activities: ${activities.join(", ")}`,
            };
          } else {
            return {
              success: true,
              message: "Not listening",
              data: { listening: false },
              shouldRespond: true,
              responseText: "I am not currently listening to any voice channel",
            };
          }
        }

        default:
          return {
            success: false,
            error: `Unknown listen action: ${action}`,
            shouldRespond: true,
            responseText: `I don't understand the listen action "${action}". Available actions are: start, stop, status.`,
          };
      }
    } catch (error) {
      logger.error("🎭 Listen control action failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        shouldRespond: true,
        responseText:
          "I encountered an issue with voice listening control. Please try again.",
      };
    }
  }

  /**
   * Set up voice listening with transcription and AI processing
   */
  private setupVoiceListening(connection: any, context: ActionContext): void {
    const receiver = connection.receiver;

    const pcmBuffers = new Map<string, Buffer[]>(); // Store PCM data per user
    const userSpeakStartTimes = new Map<string, number>(); // Track speaking duration
    const activeStreams = new Map<string, any>(); // Track active audio streams per user

    receiver.speaking.on("start", (userId: string) => {
      logger.info(`🎤 User ${userId} started speaking`);

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

      // Subscribe to user's OPUS stream and decode it properly
      const opusStream = receiver.subscribe(userId);

      // Create Opus decoder with proper settings
      const decoder = new opus.Decoder({
        frameSize: 960,
        channels: 2,
        rate: 48000,
      });

      // Pipe Opus stream through decoder to get proper PCM
      const pcmStream = opusStream.pipe(decoder);
      activeStreams.set(userId, opusStream);

      pcmStream.on("data", (data: Buffer) => {
        // Store properly decoded PCM data
        const userPcmBuffers = pcmBuffers.get(userId) || [];
        userPcmBuffers.push(data);
        pcmBuffers.set(userId, userPcmBuffers);
      });

      pcmStream.on("error", (error: any) => {
        logger.error(`🎤 PCM stream error for user ${userId}:`, error);
      });

      opusStream.on("error", (error: any) => {
        logger.error(`🎤 Opus stream error for user ${userId}:`, error);
        activeStreams.delete(userId);
      });
    });

    receiver.speaking.on("end", async (userId: string) => {
      try {
        // Stop and cleanup the stream immediately to prevent race conditions
        const stream = activeStreams.get(userId);
        if (stream) {
          stream.destroy();
          activeStreams.delete(userId);
          logger.info(`🎤 Cleaned up audio stream for user ${userId}`);
        }

        logger.info(`🎤 User ${userId} stopped speaking`);

        // Check speaking duration
        const startTime = userSpeakStartTimes.get(userId);
        const speakingDuration = startTime ? Date.now() - startTime : 0;

        // Get PCM data for this user and convert to WAV
        const userPcmBuffers = pcmBuffers.get(userId) || [];
        if (userPcmBuffers.length > 0) {
          try {
            // Convert PCM to WAV buffer
            const wavBuffer = createWAVBuffer(userPcmBuffers);

            logger.info(
              `🎤 User ${userId} spoke for ${speakingDuration}ms, WAV size: ${wavBuffer.length} bytes`,
            );

            // Filter out audio that's too short for reliable transcription
            if (
              speakingDuration >= MIN_AUDIO_DURATION_MS &&
              wavBuffer.length >= MIN_WAV_SIZE_BYTES
            ) {
              // Transcribe using the WAV buffer directly
              const transcription =
                await OpenAIService.transcribeAudioBuffer(wavBuffer);
              if (transcription && transcription.length > 0) {
                logger.info(
                  `🎤 Transcription from user ${userId}: "${transcription}"`,
                );

                // Process voice commands using action system
                await processVoiceCommand(userId, transcription, context);
              } else {
                logger.info(
                  `🎤 No speech detected in audio from user ${userId}`,
                );
              }
            } else {
              logger.info(
                `🎤 Audio too short for transcription from user ${userId} (${speakingDuration}ms, ${wavBuffer.length} bytes)`,
              );
            }
          } catch (transcriptionError) {
            logger.error(
              `🎤 Failed to transcribe audio for user ${userId}:`,
              transcriptionError,
            );
          }

          // Clean up PCM buffers and timing for this user
          pcmBuffers.delete(userId);
          userSpeakStartTimes.delete(userId);
        } else {
          logger.info(`🎤 No PCM data recorded for user ${userId}`);
        }
      } catch (error) {
        logger.error(`🎤 Error processing audio from user ${userId}:`, error);
      }
    });

    // Cleanup resources when connection ends
    connection.on("stateChange", (oldState: any, newState: any) => {
      if (newState.status === VoiceConnectionStatus.Destroyed) {
        // Critical: Clear all buffers and streams to prevent memory leaks
        pcmBuffers.clear();
        userSpeakStartTimes.clear();
        // Cleanup all active streams
        activeStreams.forEach((stream, userId) => {
          try {
            stream.destroy();
            logger.info(`🎤 Force-cleaned stream for user ${userId}`);
          } catch (error) {
            logger.error(`🎤 Error cleaning stream for user ${userId}:`, error);
          }
        });
        activeStreams.clear();
        logger.info(
          `🎤 Voice connection destroyed, cleaned up listen session and all resources`,
        );
      }
    });
  }

  validate(parameters: ActionParameters): boolean {
    const validActions = ["start", "stop", "status"];
    if (!parameters.action || !validActions.includes(parameters.action)) {
      return false;
    }

    if (parameters.duration_minutes !== undefined) {
      return (
        typeof parameters.duration_minutes === "number" &&
        parameters.duration_minutes >= 1 &&
        parameters.duration_minutes <= 60
      );
    }

    return true;
  }
}
