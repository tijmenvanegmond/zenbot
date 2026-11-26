import { getDb, pruneVoiceLinesDaily, voiceLogDays } from "../db";
import { logger } from "../../utils/logger";

/**
 * What was recently said in a guild's voice channel, by whom - including
 * lines that didn't address Zenbot. Chat sessions are per person, so without
 * this Zenbot couldn't follow group banter ("what did Osha just say?").
 * The transcripts exist anyway (/listen transcribes everything to find the
 * wake word), so keeping them costs no extra requests.
 */

const MAX_LINES = 10;
const MAX_AGE_MS = 5 * 60 * 1000;
const MAX_LINE_CHARS = 200;

export interface RoomLine {
  speaker: string;
  /** Discord user ID; "zenbot" for Zenbot's own lines */
  speakerId?: string;
  text: string;
  at: number;
}

const rooms = new Map<string, RoomLine[]>();

// Everything said since the last session recap (sessionRecap.ts), so the
// diary note covers the whole session, not just the last few lines
const HISTORY_LINES = 200;
const HISTORY_MAX_AGE_MS = 4 * 60 * 60 * 1000;
const histories = new Map<string, RoomLine[]>();

const fresh = (guildId: string): RoomLine[] => {
  const now = Date.now();
  const lines = (rooms.get(guildId) ?? []).filter(
    (line) => now - line.at < MAX_AGE_MS,
  );
  rooms.set(guildId, lines);
  return lines;
};

export const addRoomLine = (
  guildId: string,
  speaker: string,
  text: string,
  speakerId?: string,
): void => {
  const trimmed = text.trim();
  if (!trimmed) return;
  const line = {
    speaker,
    speakerId,
    text: trimmed.slice(0, MAX_LINE_CHARS),
    at: Date.now(),
  };
  const lines = fresh(guildId);
  lines.push(line);
  if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);

  storeVoiceLine(guildId, line);

  const history = histories.get(guildId) ?? [];
  history.push(line);
  if (history.length > HISTORY_LINES) {
    history.splice(0, history.length - HISTORY_LINES);
  }
  histories.set(guildId, history);
};

/**
 * The recent lines as a prompt block, oldest first, or "" if the room has
 * been quiet. `exclude` leaves out the message being answered right now.
 */
export const describeRoom = (guildId: string, exclude?: string): string => {
  let lines = fresh(guildId);
  if (exclude) {
    // Only the newest copy is the current message; earlier repeats are history
    const last = lines.length - 1;
    if (
      last >= 0 &&
      lines[last].text === exclude.trim().slice(0, MAX_LINE_CHARS)
    ) {
      lines = lines.slice(0, last);
    }
  }
  if (lines.length === 0) return "";
  const now = Date.now();
  const rendered = lines.map((line) => {
    const ago = Math.round((now - line.at) / 1000);
    return `- ${line.speaker} (${ago}s ago): ${line.text}`;
  });
  return `(Recently said in voice, oldest first - context, not addressed to you unless it says so:\n${rendered.join("\n")})`;
};

/** The recent lines, oldest first (e.g. to pick one to quote) */
export const recentRoomLines = (guildId: string): RoomLine[] => [
  ...fresh(guildId),
];

/**
 * Keep the line in zenbot.db for conversation recall (VOICE_LOG_DAYS, 0 = off).
 * Never breaks the voice path: a failed write is only logged.
 */
const storeVoiceLine = (guildId: string, line: RoomLine): void => {
  if (voiceLogDays() === 0) return;
  try {
    getDb()
      .prepare(
        "INSERT INTO voice_lines (guild_id, speaker, speaker_id, text, at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(guildId, line.speaker, line.speakerId ?? null, line.text, line.at);
    pruneVoiceLinesDaily();
  } catch (error) {
    logger.warn("💾 Failed to store voice line:", error);
  }
};

/** Everything said since the last call (last 4 hours at most), oldest first */
export const takeSessionHistory = (guildId: string): RoomLine[] => {
  const cutoff = Date.now() - HISTORY_MAX_AGE_MS;
  const history = (histories.get(guildId) ?? []).filter((l) => l.at >= cutoff);
  histories.delete(guildId);
  return history;
};

/** For tests */
export const clearRoomLog = (): void => {
  rooms.clear();
  histories.clear();
};
