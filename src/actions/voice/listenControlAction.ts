import {
  ZenAction,
  ActionContext,
  ActionParameters,
  ActionResult,
} from "../actionTypes";
import { VoiceSessionManager } from "../../services/voiceSessionManager";
import {
  getVoiceConnection,
  joinVoiceChannel,
  VoiceConnectionStatus,
} from "@discordjs/voice";
import { TextBasedChannel, VoiceBasedChannel } from "discord.js";
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
import { SPEECH_HINTS, WAKE_WORD } from "../../services/voice/vocabulary";
import { preferredName } from "../../services/people";
import { addRoomLine } from "../../services/voice/voiceRoomLog";
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
// Nobody talks to Zenbot in 30s monologues; longer is an open mic or music
const MAX_UTTERANCE_MS = 30000;

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
// The name's many misspellings live in services/voice/vocabulary.ts
export { WAKE_WORD };

// One reply at a time per guild: overlapping replies talk over each other
const replyInFlight = new Set<string>();

/** Where heard speech is answered: the voice channel, and a text channel for the log */
export interface ListenTarget {
  guildId: string;
  voiceChannel: VoiceBasedChannel;
  textChannel?: TextBasedChannel;
}

/**
 * Answer something said in voice: same conversation as @Zenbot chat (real
 * names, tools, voice mood; spoken text == posted text). Posts what was heard
 * and the reply in the channel /listen was started from.
 */
async function respondToSpeech(
  userId: string,
  transcription: string,
  target: ListenTarget,
): Promise<void> {
  const { guildId, voiceChannel, textChannel } = target;

  const member =
    voiceChannel.members.get(userId) ??
    (await voiceChannel.guild.members.fetch(userId).catch(() => null));
  if (!member || member.user.bot) return;

  // Everything heard goes in the room log, addressed to Zenbot or not, so it
  // can follow the conversation around a question
  addRoomLine(guildId, preferredName(member), transcription, member.id);

  const named = WAKE_WORD.test(transcription);
  const humans = voiceChannel.members.filter((m) => !m.user.bot).size;
  if (humans > 1 && !named) {
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

  if (replyInFlight.has(guildId)) {
    logger.info(
      `🎤 Skipping "${transcription}" from ${member.displayName}: still answering`,
    );
    return;
  }
  replyInFlight.add(guildId);

  try {
    logger.info(`🎤 ${member.displayName} (voice): "${transcription}"`);
    const reply = await getChatReply({
      member,
      text: transcription,
      channel: textChannel ?? voiceChannel,
      spokenInput: true,
      unaddressed: !named,
    });

    if (reply.silent) {
      logger.info(`🎤 Zenbot lets "${transcription}" pass in silence`);
      return;
    }
    addRoomLine(guildId, "Zenbot (you)", reply.display, "zenbot");

    // They said it out loud, so no need to repeat the trigger in voice
    await speakReply(voiceChannel, reply.speech, reply.mood, "voice-response");

    if (textChannel && "send" in textChannel) {
      await textChannel
        .send(
          `🎤 **${preferredName(member)}:** ${transcription}\n🧘 ${reply.display}`.slice(
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
    if (reply.leaveVoice) await leaveVoice(guildId);
  } catch (error) {
    logger.error(`🎤 Voice reply to ${member.displayName} failed:`, error);
    await speakReply(
      voiceChannel,
      chatErrorLine(error),
      undefined,
      "voice-error",
    ).catch(() => undefined);
  } finally {
    replyInFlight.delete(guildId);
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
          this.setupVoiceListening(connection, {
            guildId: context.guild.id,
            voiceChannel: context.voiceChannel,
            textChannel: context.interaction?.channel ?? undefined,
          });
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
  setupVoiceListening(connection: any, target: ListenTarget): void {
    // Once per connection: /listen after an @Zenbot follow-up (or the other
    // way round) would otherwise answer everything twice. The listeners end
    // with the connection, when Zenbot leaves.
    if (connection.__zenbotListening) return;
    connection.__zenbotListening = true;
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
    const guildId = target.guildId;

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
            } else if (speakingDuration > MAX_UTTERANCE_MS) {
              // An open mic or music: a 100s, 19MB upload once took ~70s
              // and tipped Gemini into rate limiting for everyone
              logger.info(
                `🎤 Ignoring ${Math.round(speakingDuration / 1000)}s from user ${userId}: too long for one remark (open mic or music?)`,
              );
            } else if (
              speakingDuration >= MIN_AUDIO_DURATION_MS &&
              wavBuffer.length >= MIN_WAV_SIZE_BYTES
            ) {
              // Transcribe using the WAV buffer directly
              // Opt-in word list only: hinted names also get "heard" in
              // clicks (see vocabulary.ts), so voice members aren't added
              const transcription = await transcribeSpeech(
                wavBuffer,
                SPEECH_HINTS,
              );
              if (transcription && transcription.length > 0) {
                logger.info(
                  `🎤 Transcription from user ${userId}: "${transcription}"`,
                );

                // Process voice commands using action system
                await respondToSpeech(userId, transcription, target);
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

/**
 * After an @Zenbot reply is spoken in voice, keep listening on that same
 * connection until Zenbot idles out (AudioManager's 1-minute timer), so people
 * can answer out loud. Unlike /listen it doesn't hold Zenbot in the channel;
 * every spoken reply resets the idle timer, so a conversation keeps it there.
 */
export const listenWhileInVoice = (target: ListenTarget): void => {
  const connection = getVoiceConnection(target.guildId);
  if (
    !connection ||
    connection.state.status === VoiceConnectionStatus.Destroyed
  ) {
    return;
  }
  if (!(connection as any).__zenbotListening) {
    logger.info(
      `🎤 Listening in ${target.voiceChannel.name} until Zenbot leaves (follow-up to chat)`,
    );
  }
  new ListenControlAction().setupVoiceListening(connection, target);
};
