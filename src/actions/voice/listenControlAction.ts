import {
  ZenAction,
  ActionContext,
  ActionParameters,
  ActionResult,
} from "../actionTypes";
import { VoiceSessionManager } from "../../services/voiceSessionManager";
import { joinVoiceChannel, VoiceConnectionStatus } from "@discordjs/voice";
import { logger } from "../../utils/logger";
import {
  chatErrorLine,
  getChatReply,
  isChatAvailable,
  leaveVoice,
  speakReply,
} from "../../services/zenbotChat";
import {
  MIN_SPEECH_LEVEL_DB,
  speechLevelDb,
  transcribeSpeech,
} from "../../services/speechToText";
import { OpusDecoder } from "../../services/voice/opusDecoder";
import { AudioManager } from "../../services/voice/AudioManager";
import { AudioPlayerStatus } from "@discordjs/voice";

// Audio processing constants - Adjusted for real speech patterns
const MIN_AUDIO_DURATION_MS = 500; // Minimum 500ms - realistic for short speech
const MIN_WAV_SIZE_BYTES = 2000; // Much lower threshold - 2KB minimum for real speech
// A short blip that starts while Zenbot talks is almost always its own voice
// leaking back through someone's mic. Longer speech over it is a real
// interruption and still counts.
const ECHO_MAX_MS = 1500;

const isBotSpeaking = (guildId: string): boolean =>
  AudioManager.getInstance().getSession(guildId)?.player.state.status ===
  AudioPlayerStatus.Playing;

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

// Zenbot only answers when addressed - unless it's the only one listening.
// Transcription spells the name many ways ("Zenbot", "Zen bot", "ZennBot",
// "Xenbot", "Zenyatta").
export const WAKE_WORD = /\b[zx]en+[\s-]?(bot|yatta)?\b/i;

// One reply at a time per guild: overlapping replies talk over each other
const replyInFlight = new Set<string>();

/**
 * Answer something said in voice: same conversation as @Zenbot chat (real
 * names, tools, voice mood; spoken text == posted text). Posts what was heard
 * and the reply in the channel /listen was started from.
 */
async function respondToSpeech(
  userId: string,
  transcription: string,
  context: ActionContext,
): Promise<void> {
  const voiceChannel = context.voiceChannel;
  if (!voiceChannel || !context.guild) return;

  const member =
    voiceChannel.members.get(userId) ??
    (await voiceChannel.guild.members.fetch(userId).catch(() => null));
  if (!member || member.user.bot) return;

  const humans = voiceChannel.members.filter((m) => !m.user.bot).size;
  if (humans > 1 && !WAKE_WORD.test(transcription)) {
    logger.debug(
      `🎤 Ignoring "${transcription}" from ${member.displayName} (no wake word)`,
    );
    return;
  }

  if (!isChatAvailable()) {
    await speakReply(
      voiceChannel,
      "My conversational mind is offline. Try the slash commands.",
      undefined,
      "voice-response",
    );
    return;
  }

  if (replyInFlight.has(context.guild.id)) {
    logger.info(
      `🎤 Skipping "${transcription}" from ${member.displayName}: still answering`,
    );
    return;
  }
  replyInFlight.add(context.guild.id);

  const textChannel = context.interaction?.channel;
  try {
    logger.info(`🎤 ${member.displayName} (voice): "${transcription}"`);
    const reply = await getChatReply({
      member,
      text: transcription,
      channel: textChannel ?? voiceChannel,
      spokenInput: true,
    });

    // They said it out loud, so no need to repeat the trigger in voice
    await speakReply(voiceChannel, reply.speech, reply.mood, "voice-response");

    if (textChannel && "send" in textChannel) {
      await textChannel
        .send(
          `🎤 **${member.displayName}:** ${transcription}\n🧘 ${reply.display}`.slice(
            0,
            2000,
          ),
        )
        .catch(() => undefined);
    }
    logger.info(
      `🎤 Zenbot -> ${member.displayName}${reply.mood ? ` [${reply.mood}]` : ""}: "${reply.display.substring(0, 120)}"`,
    );
    // Asked to leave: after the goodbye, which also ends this listen session
    if (reply.leaveVoice) await leaveVoice(context.guild.id);
  } catch (error) {
    logger.error(`🎤 Voice reply to ${member.displayName} failed:`, error);
    await speakReply(
      voiceChannel,
      chatErrorLine(error),
      undefined,
      "voice-error",
    ).catch(() => undefined);
  } finally {
    replyInFlight.delete(context.guild.id);
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

    // Incoming audio is end-to-end encrypted (DAVE). Surface the library's
    // decrypt messages: if they keep failing, packets reach the decoder still
    // encrypted and transcription only ever hears noise.
    if (!connection.__zenbotDaveDebug) {
      connection.__zenbotDaveDebug = true;
      connection.on("debug", (message: string) => {
        if (/decrypt|dave/i.test(message)) {
          logger.info(`🎤 Voice E2EE: ${message}`);
        }
      });
    }

    const pcmBuffers = new Map<string, Buffer[]>(); // Store PCM data per user
    const userSpeakStartTimes = new Map<string, number>(); // Track speaking duration
    const activeStreams = new Map<string, any>(); // Track active audio streams per user
    const startedOverBot = new Set<string>(); // Began while Zenbot was talking
    const guildId = context.guild?.id ?? "";

    receiver.speaking.on("start", (userId: string) => {
      logger.info(`🎤 User ${userId} started speaking`);

      // Track when user started speaking
      userSpeakStartTimes.set(userId, Date.now());
      if (isBotSpeaking(guildId)) startedOverBot.add(userId);
      else startedOverBot.delete(userId);

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

      activeStreams.set(userId, opusStream);

      // Decode packet by packet. Piping into a decoder stream let one bad
      // packet (e.g. still DAVE-encrypted while the E2EE session warms up)
      // kill the whole utterance: "memory access out of bounds", no PCM.
      const decoder = new OpusDecoder();
      opusStream.on("data", (packet: Buffer) => {
        const pcm = decoder.decode(packet);
        if (!pcm) return;
        const userPcmBuffers = pcmBuffers.get(userId) || [];
        userPcmBuffers.push(pcm);
        pcmBuffers.set(userId, userPcmBuffers);
      });
      opusStream.once("close", () => decoder.logSummary(userId));

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

            const level = speechLevelDb(wavBuffer.subarray(44));
            logger.info(
              `🎤 User ${userId} spoke for ${speakingDuration}ms, WAV size: ${wavBuffer.length} bytes, level ${level.toFixed(1)} dBFS`,
            );

            const echo =
              startedOverBot.has(userId) && speakingDuration < ECHO_MAX_MS;

            // Filter out audio that's too short for reliable transcription
            if (echo) {
              logger.info(
                `🎤 Ignoring ${speakingDuration}ms from user ${userId}: started while Zenbot was talking (likely echo)`,
              );
            } else if (level < MIN_SPEECH_LEVEL_DB) {
              logger.info(
                `🎤 Ignoring ${speakingDuration}ms from user ${userId}: too quiet (${level.toFixed(1)} dBFS)`,
              );
            } else if (
              speakingDuration >= MIN_AUDIO_DURATION_MS &&
              wavBuffer.length >= MIN_WAV_SIZE_BYTES
            ) {
              // Transcribe using the WAV buffer directly
              const transcription = await transcribeSpeech(wavBuffer);
              if (transcription && transcription.length > 0) {
                logger.info(
                  `🎤 Transcription from user ${userId}: "${transcription}"`,
                );

                // Process voice commands using action system
                await respondToSpeech(userId, transcription, context);
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
