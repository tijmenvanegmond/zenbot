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

interface RoomLine {
  speaker: string;
  text: string;
  at: number;
}

const rooms = new Map<string, RoomLine[]>();

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
): void => {
  const trimmed = text.trim();
  if (!trimmed) return;
  const lines = fresh(guildId);
  lines.push({
    speaker,
    text: trimmed.slice(0, MAX_LINE_CHARS),
    at: Date.now(),
  });
  if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
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
    if (last >= 0 && lines[last].text === exclude.trim().slice(0, MAX_LINE_CHARS)) {
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

/** For tests */
export const clearRoomLog = (): void => rooms.clear();
