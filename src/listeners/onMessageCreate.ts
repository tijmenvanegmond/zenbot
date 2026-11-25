import { Client, Message } from "discord.js";
import {
  chatErrorLine,
  getChatReply,
  isChatAvailable,
  speakReply,
} from "../services/zenbotChat";
import { toSpeakableText } from "../utils/speechText";
import { logger } from "../utils/logger";

/**
 * @Zenbot chat: mention the bot to talk to it. See services/zenbotChat.ts
 * for the conversation itself (tools, voice mood, text == speech).
 */

const COOLDOWN_MS = 5000;
const lastChatAt = new Map<string, number>();

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
  const member = message.member;

  if (!text) {
    await message.reply("You summoned me. With nothing. Bold.");
    return;
  }
  if (!member) return;
  if (!isChatAvailable()) {
    await message.reply(
      "My conversational mind is offline. Try /advice or /quote.",
    );
    return;
  }

  const now = Date.now();
  if (now - (lastChatAt.get(member.id) ?? 0) < COOLDOWN_MS) {
    await message.react("⏳").catch(() => undefined);
    return;
  }
  lastChatAt.set(member.id, now);

  logger.info(
    `💬 ${member.user.username} @Zenbot: "${text.substring(0, 100)}"`,
  );
  if ("sendTyping" in message.channel) {
    await message.channel.sendTyping().catch(() => undefined);
  }

  let reply;
  try {
    reply = await getChatReply({ member, text, channel: message.channel });
  } catch (error) {
    logger.error("💬 Chat reply failed:", error);
    await message.reply(chatErrorLine(error));
    return;
  }

  await message.reply(reply.display.slice(0, 2000));

  const voiceChannel = member.voice?.channel;
  if (voiceChannel) {
    // People in voice can't see the message, so say what triggered the reply
    const verb = /\?\s*$/.test(text) ? "asks" : "says";
    const trigger = `${member.displayName} ${verb}:[pause:0.4] ${toSpeakableText(text, 200)}`;
    speakReply(
      voiceChannel,
      `${trigger}[pause:0.8] ${reply.speech}`,
      reply.mood,
      "chat",
    ).catch((error) => logger.error("💬 Failed to speak chat reply:", error));
  }

  logger.info(
    `💬 Zenbot -> ${member.user.username}${reply.mood ? ` [${reply.mood}]` : ""}${voiceChannel ? " (spoken)" : ""}: "${reply.display.substring(0, 120)}"`,
  );
}
