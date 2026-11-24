import { Client, Message, VoiceChannel } from "discord.js";
import {
  ZenbotService,
  MinimalInteractionContext,
} from "../services/zenbotService";
import { UnifiedVoiceService } from "../services/voice/UnifiedVoiceService";
import { takeVoiceMood } from "../services/voice/voiceMoodStore";
import { stripStageDirections, toSpeakableText } from "../utils/speechText";
import { logger } from "../utils/logger";

/**
 * @Zenbot chat: free conversation where the AI decides when to use tools
 * (pull a quote, roll dice, pick its voice mood, rename the channel).
 *
 * The reply shown in chat is the reply that gets spoken - the AI's own
 * speak/voice tools are excluded here so the two can't diverge.
 */

// Tools that would speak, move the bot, or are too heavy for a chat reply
const EXCLUDED_TOOLS = [
  "speak",
  "voice_channel_control",
  "listen_control",
  "stop_all",
  "conference",
  "rename_user",
];

const COOLDOWN_MS = 5000;
const lastChatAt = new Map<string, number>();

const PAUSE_MARKER = /\s*\[pause(?::[\d.]+)?\]\s*/gi;

const CHAT_GUIDE = `(Chat guide - not from the user: reply in 1-3 short sentences. If they are in voice chat, your reply is read aloud, and you may put [pause] where a dramatic pause helps. No stage directions like *chuckles* or _sighs_. Use your tools when they fit: set_voice_mood to choose how you sound, read_channel_quote to bring up something a friend actually said, roll_dice for random decisions - never invent a roll. Don't describe the tools or say you used them.)`;

export default (client: Client): void => {
  client.on("messageCreate", async (message: Message) => {
    try {
      if (message.author.bot || !message.guild || !client.user) return;
      if (!message.mentions.users.has(client.user.id)) return;

      await handleChat(client, message);
    } catch (err) {
      logger.error("Unhandled error in messageCreate listener:", err);
    }
  });
};

async function handleChat(client: Client, message: Message): Promise<void> {
  const text = message.content
    .replace(new RegExp(`<@!?${client.user!.id}>`, "g"), "")
    .trim();

  const zenbot = ZenbotService.getInstance();
  if (!text) {
    await message.reply("You summoned me. With nothing. Bold.");
    return;
  }
  if (!zenbot.isAIEnabled()) {
    await message.reply(
      "My conversational mind is offline. Try /advice or /quote.",
    );
    return;
  }

  const now = Date.now();
  if (now - (lastChatAt.get(message.author.id) ?? 0) < COOLDOWN_MS) {
    await message.react("⏳").catch(() => undefined);
    return;
  }
  lastChatAt.set(message.author.id, now);

  logger.info(
    `💬 ${message.author.username} @Zenbot: "${text.substring(0, 100)}"`,
  );
  if ("sendTyping" in message.channel) {
    await message.channel.sendTyping().catch(() => undefined);
  }

  // Shaped like an interaction so the action context (voice channel, guild,
  // channels) resolves the same way it does for slash commands
  const member = message.member;
  const chatContext = {
    user: {
      id: message.author.id,
      username: message.author.username,
      displayName: member?.displayName || message.author.username,
    },
    member,
    guild: message.guild,
    channel: message.channel,
    client,
  } as unknown as MinimalInteractionContext;

  let reply: string;
  try {
    const response = await zenbot.converse(
      chatContext,
      `${text}\n\n${describeVoice(message)}\n${CHAT_GUIDE}`,
      { commandName: "chat" },
      "zenbot-default",
      EXCLUDED_TOOLS,
    );
    reply = response.text;
  } catch (error) {
    logger.error("💬 Chat reply failed:", error);
    await message.reply("Something in my head just broke. Ask again.");
    return;
  }

  const display = stripStageDirections(reply.replace(PAUSE_MARKER, " "), {
    keepItalics: true,
  })
    .replace(/\s+/g, " ")
    .trim();
  await message.reply(display.slice(0, 2000) || "...");

  const voiceChannel = member?.voice?.channel;
  const mood = takeVoiceMood(message.author.id);
  if (voiceChannel && voiceChannel.isVoiceBased()) {
    // People in voice can't see the message, so say what triggered the reply
    const askerName = member?.displayName || message.author.username;
    const verb = /\?\s*$/.test(text) ? "asks" : "says";
    const trigger = `${askerName} ${verb}:[pause:0.4] ${toSpeakableText(text, 200)}`;
    UnifiedVoiceService.getInstance()
      .speak({
        text: `${trigger}[pause:0.8] ${toSpeakableText(reply)}`,
        profile: mood ? `piper-zen-${mood}` : "piper-zen",
        voiceChannel: voiceChannel as VoiceChannel,
        activityType: "chat",
      })
      .catch((error) => logger.error("💬 Failed to speak chat reply:", error));
  }

  logger.info(
    `💬 Zenbot -> ${message.author.username}${mood ? ` [${mood}]` : ""}${voiceChannel ? " (spoken)" : ""}: "${display.substring(0, 120)}"`,
  );
}

/**
 * Who is actually in the author's voice channel. Without this the AI only
 * saw the text channel and answered "who's here?" about the wrong room.
 */
function describeVoice(message: Message): string {
  const channel = message.member?.voice?.channel;
  if (!channel) {
    return "(Voice: they are not in a voice channel; your reply is text only.)";
  }
  const names = channel.members.map((m) =>
    m.id === message.client.user?.id ? "you (Zenbot)" : m.displayName,
  );
  return `(Voice: they are in voice channel "${channel.name}" with: ${names.join(", ")}.)`;
}
