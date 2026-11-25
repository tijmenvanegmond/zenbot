import { GuildMember, TextBasedChannel, VoiceBasedChannel } from "discord.js";
import { ZenbotService, MinimalInteractionContext } from "./zenbotService";
import { UnifiedVoiceService } from "./voice/UnifiedVoiceService";
import { stripStageDirections, toSpeakableText } from "../utils/speechText";
import { ActionService } from "./actionService";
import { logger } from "../utils/logger";

/**
 * Free conversation with Zenbot, shared by @Zenbot chat (typed) and /listen
 * (spoken). The AI decides when to use tools: pull a quote, roll dice, pick
 * its voice mood, rename the channel.
 *
 * The reply shown is the reply that gets spoken - the AI's own speak/voice
 * tools are excluded so the two can't diverge.
 */

// Tools that would speak, move the bot, or are too heavy for a chat reply
const EXCLUDED_TOOLS = [
  "speak",
  "voice_channel_control",
  "listen_control",
  "stop_all",
  "conference",
];

export const VOICE_MOODS = ["calm", "wise", "playful", "intense"] as const;
export type VoiceMood = (typeof VOICE_MOODS)[number];

const PAUSE_MARKER = /\s*\[pause(?::[\d.]+)?\]\s*/gi;
const GONG_MARKER = /\s*\[gong\]\s*/gi;
// The voice mood rides along in the reply as [mood:playful]. It used to be a
// tool, which cost a whole extra Gemini round on nearly every message.
const MOOD_MARKER = /\s*\[mood:\s*([a-z]+)\s*\]\s*/gi;

/** Pull the [mood:x] tag out of a reply: the first valid mood wins */
export const extractMood = (
  text: string,
): { text: string; mood?: VoiceMood } => {
  let mood: VoiceMood | undefined;
  const cleaned = text.replace(MOOD_MARKER, (_, name: string) => {
    const lower = name.toLowerCase() as VoiceMood;
    if (!mood && VOICE_MOODS.includes(lower)) mood = lower;
    return " ";
  });
  return { text: cleaned.trim(), mood };
};

/**
 * No real words (empty, only [gong]/[pause], "(no response)"), or leaked
 * internals: tool summaries like "roll_dice success: ..." or the
 * function-calling wrap-up instruction
 */
export const isUnusableReply = (text: string): boolean => {
  const words = text
    .replace(/\[(pause(?::[\d.]+)?|gong|mood:\s*[a-z]+\s*)\]/gi, "")
    .replace(/\(no response\)/gi, "")
    .trim();
  return (
    words.length === 0 ||
    /\b[a-z]+_[a-z_]+ (success|failed)\b/i.test(text) ||
    /Provide your final response/i.test(text)
  );
};

const allToolNames = (): string[] =>
  ActionService.getInstance()
    .getFunctionDefinitions()
    .map((fn) => fn.name);

/** One gong per reply - it's a punchline, not a soundtrack */
const limitGongs = (text: string): string => {
  let seen = false;
  return text.replace(/\[gong\]/gi, () => {
    if (seen) return "";
    seen = true;
    return "[gong]";
  });
};

const GUIDE = `(Chat guide - not from the user: reply in 1-3 short sentences. If they are in voice chat, your reply is read aloud, and you may put [pause] where a dramatic pause helps. You also own a temple gong: you may add [gong] inside your sentence-reply, right before a verdict or result, for ceremony. It decorates a reply, it is never the reply: always say the actual answer in words. Use it rarely. No stage directions like *chuckles* or _sighs_. To choose how your voice sounds, start the reply with one of [mood:calm] [mood:wise] [mood:playful] [mood:intense] - optional, and never a tool call. Use your tools only when they fit: read_channel_quote to bring up something a friend actually said, roll_dice for random decisions - never invent a roll, channel_management with action "rename" to really rename their voice channel (suggest_name only lists ideas), rename_user to give someone a new nickname (only when asked; them or someone in their voice channel, by name). Never claim you did something - renamed, rolled, changed - unless a tool result in this conversation says it succeeded; if it failed or you didn't do it, say so. Don't describe the tools.)`;

const SPOKEN_INPUT_NOTE =
  "(They said this out loud in voice chat; it was transcribed automatically, so expect transcription errors.)";

export interface ChatRequest {
  member: GuildMember;
  text: string;
  /** Where the conversation happens; tools like read_channel_quote use its guild */
  channel: TextBasedChannel | VoiceBasedChannel;
  /** The message was spoken (/listen) rather than typed */
  spokenInput?: boolean;
}

export interface ChatReply {
  /** For Discord: pause markers and stage directions removed */
  display: string;
  /** For TTS: markdown removed, pause markers kept */
  speech: string;
  mood?: VoiceMood;
}

/** What to say when getChatReply throws: rate limits are normal on the free tier, not breakage */
export const chatErrorLine = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return /429|quota|too many requests|circuit breaker/i.test(message)
    ? "Too many questions at once - even enlightenment has a rate limit. Give me a minute."
    : "Something in my head just broke. Try that again.";
};

export const isChatAvailable = (): boolean =>
  ZenbotService.getInstance().isAIEnabled();

/** Throws if the AI call fails - callers decide how to apologise */
export const getChatReply = async ({
  member,
  text,
  channel,
  spokenInput = false,
}: ChatRequest): Promise<ChatReply> => {
  // Shaped like an interaction so the action context (voice channel, guild,
  // channels) resolves the same way it does for slash commands
  const chatContext = {
    user: {
      id: member.id,
      username: member.user.username,
      displayName: member.displayName,
    },
    member,
    guild: member.guild,
    channel,
    client: member.client,
  } as unknown as MinimalInteractionContext;

  const message = [
    text,
    "",
    ...(spokenInput ? [SPOKEN_INPUT_NOTE] : []),
    describeVoice(member),
    GUIDE,
  ].join("\n");

  const zenbot = ZenbotService.getInstance();
  const commandContext = { commandName: spokenInput ? "voice_chat" : "chat" };
  let response = await zenbot.converse(
    chatContext,
    message,
    commandContext,
    "zenbot-default",
    EXCLUDED_TOOLS,
  );

  // The free-tier model sometimes answers a tool round with nothing, only a
  // [gong], or parrots tool summaries from its history. Retry once without
  // tools: the tool results are already in the session, so it can still use
  // the real roll/quote.
  if (isUnusableReply(response.text)) {
    logger.warn(
      `💬 Unusable reply "${response.text.substring(0, 80)}", retrying without tools`,
    );
    response = await zenbot.converse(
      chatContext,
      "(Your last reply was empty or garbled. Answer my previous message now, in words, in 1-3 short sentences. Use any results you already got.)",
      commandContext,
      "zenbot-default",
      allToolNames(),
    );
  }
  const { text: replyText, mood } = extractMood(
    isUnusableReply(response.text) ? "..." : response.text,
  );
  const reply = limitGongs(replyText);

  return {
    display:
      stripStageDirections(
        reply.replace(PAUSE_MARKER, " ").replace(GONG_MARKER, " 🔔 "),
        { keepItalics: true },
      )
        .replace(/\s+/g, " ")
        .trim() || "...",
    speech: toSpeakableText(reply),
    mood,
  };
};

/** Speak text in Zenbot's voice, in the mood the AI picked (if any) */
export const speakReply = (
  voiceChannel: VoiceBasedChannel,
  speech: string,
  mood: VoiceMood | undefined,
  activityType: string,
): Promise<unknown> =>
  UnifiedVoiceService.getInstance().speak({
    text: speech,
    profile: mood ? `piper-zen-${mood}` : "piper-zen",
    voiceChannel: voiceChannel as any,
    activityType,
  });

/**
 * Who is actually in the member's voice channel. Without this the AI only
 * saw the text channel and answered "who's here?" about the wrong room.
 */
const describeVoice = (member: GuildMember): string => {
  const voice = member.voice?.channel;
  if (!voice) {
    return "(Voice: they are not in a voice channel; your reply is text only.)";
  }
  const names = voice.members.map((m) =>
    m.id === member.client.user?.id ? "you (Zenbot)" : m.displayName,
  );
  return `(Voice: they are in voice channel "${voice.name}" with: ${names.join(", ")}.)`;
};
