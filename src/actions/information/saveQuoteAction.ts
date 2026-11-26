import { MessageFlags } from "discord.js";
import {
  ZenAction,
  ActionContext,
  ActionParameters,
  ActionResult,
} from "../actionTypes";
import { findQuoteChannel } from "../../services/quoteService";
import { findMemberByName } from "../../services/people";
import { RoomLine, recentRoomLines } from "../../services/voice/voiceRoomLog";
import { logger } from "../../utils/logger";

/**
 * "Zenbot, quote that!" - saves something said in voice to the quotes
 * channel. The line always comes from the voice room log, never from the
 * AI's words, so Zenbot can't put a made-up quote in someone's mouth.
 */

// Saved per guild, so "quote that" twice doesn't post the line twice
const saved = new Set<string>();

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

/** "Zenbot (you)" / "Osha (typed)" -> "Zenbot" / "Osha" */
export const quoteSpeakerName = (line: RoomLine): string =>
  line.speakerId === "zenbot"
    ? "Zenbot"
    : line.speaker.replace(/\s*\((typed|you)\)$/, "");

/**
 * Which line to quote, newest first:
 * - never the request itself ("Zenbot, quote that")
 * - `speaker` narrows to one person (case-insensitive, partial), or
 *   `speakerId` when the name was resolved to a member (aliases like "nem")
 * - `about` narrows to a line containing those words
 * - with neither, prefer someone other than the requester
 */
export const pickQuoteLine = (
  lines: RoomLine[],
  requesterId: string,
  speaker?: string,
  about?: string,
  speakerId?: string,
): RoomLine | undefined => {
  const candidates = lines
    .filter(
      (line) =>
        !(line.speakerId === requesterId && /\bquote\b/i.test(line.text)),
    )
    .reverse();

  const wantSpeaker = speaker && normalize(speaker);
  const wantWords = about ? normalize(about).split(" ").filter(Boolean) : [];

  const matches = candidates.filter((line) => {
    if (speakerId) {
      if (line.speakerId !== speakerId) return false;
    } else if (
      wantSpeaker &&
      !normalize(quoteSpeakerName(line)).includes(wantSpeaker)
    ) {
      return false;
    }
    if (wantWords.length > 0) {
      const text = normalize(line.text);
      return wantWords.every((word) => text.includes(word));
    }
    return true;
  });

  if (wantSpeaker || wantWords.length > 0) return matches[0];
  return matches.find((line) => line.speakerId !== requesterId) ?? matches[0];
};

export class SaveQuoteAction implements ZenAction {
  name = "save_quote";
  description = "Save something said in voice to the quotes channel";
  category = "information" as const;

  permissions = {
    allowedSources: ["ai"],
  };

  schema = {
    name: "save_quote",
    description:
      'Save a line someone recently said in voice to the server\'s quotes channel ("quote that!", "that\'s going in the quotes"). The exact words come from what was heard - you only say which line.',
    parameters: {
      type: "object" as const,
      properties: {
        speaker: {
          type: "string" as const,
          description:
            "Who said it, as named in the recent voice lines. Leave out for the most recent thing someone else said",
        },
        about: {
          type: "string" as const,
          description:
            'A few words from the line, to pick a specific one (e.g. "pizza"). Leave out for their latest line',
        },
      },
      required: [] as string[],
    },
  };

  async execute(
    context: ActionContext,
    parameters: ActionParameters,
  ): Promise<ActionResult> {
    const guild = context.interaction?.guild;
    if (!guild || !context.guild) {
      return {
        success: false,
        error: "Not in a server",
        shouldRespond: true,
        responseText: "Quotes only work in a server.",
      };
    }

    // "Quote nem": the room log says "The worst of us", so resolve the name
    const speakerMember = parameters.speaker
      ? await findMemberByName(
          guild,
          parameters.speaker,
          context.voiceChannel?.members.values(),
        )
      : null;
    const line = pickQuoteLine(
      recentRoomLines(context.guild.id),
      context.user.id,
      parameters.speaker,
      parameters.about,
      // Zenbot's own lines are logged as "zenbot", not its account ID
      speakerMember?.id === guild.members.me?.id ? "zenbot" : speakerMember?.id,
    );
    if (!line) {
      return {
        success: false,
        error:
          "No matching line was said in voice in the last 5 minutes - nothing saved",
        shouldRespond: true,
        responseText: "I didn't hear anything like that to quote.",
      };
    }

    const channel = findQuoteChannel(guild);
    if (!channel) {
      return {
        success: false,
        error:
          'No quotes channel (a text channel with "quotes" in its name) - nothing saved',
        shouldRespond: true,
        responseText: "There's no quotes channel to save it to.",
      };
    }

    const speaker = quoteSpeakerName(line);
    const key = `${context.guild.id}:${normalize(line.text)}`;
    if (saved.has(key)) {
      return {
        success: false,
        error: `Already saved: ${speaker}: "${line.text}"`,
        shouldRespond: true,
        responseText: "That one's already in the quotes.",
      };
    }

    // One line in the format the quote parser reads back: Name: "text"
    const content = `${speaker}: "${line.text.replace(/"/g, "'")}"`;
    try {
      await channel.send({
        content,
        flags: MessageFlags.SuppressNotifications,
        allowedMentions: { parse: [] },
      });
    } catch (error) {
      logger.error("📜 Failed to save quote:", error);
      return {
        success: false,
        error: `Could not post in #${channel.name} (missing permission?) - nothing saved`,
        shouldRespond: true,
        responseText: `I couldn't post in #${channel.name}.`,
      };
    }

    saved.add(key);
    logger.info(
      `📜 ${context.user.username} saved a quote to #${channel.name}: ${content}`,
    );
    return {
      success: true,
      message: "Quote saved",
      data: { speaker, text: line.text, channel: channel.name },
      shouldRespond: true,
      responseText: `Saved to #${channel.name}: ${content}`,
    };
  }
}
