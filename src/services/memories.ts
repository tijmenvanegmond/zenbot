import { randomUUID } from "crypto";
import { Guild, GuildMember } from "discord.js";
import { getDb } from "./db";
import { getAliases, namesFor, preferredName } from "./people";

/**
 * Zenbot's notes about people and the server: "Osha hates pineapple pizza",
 * "game night ended in a three-way dice feud". People teach them ("remember
 * that..."), Zenbot jots down things it overhears, and a voice session gets a
 * diary note when something noteworthy happened (sessionRecap.ts). Stored in
 * zenbot.db with a full-text index, so recall can go by topic.
 */

/** `about` for notes about the server rather than one person */
export const SERVER = "server";
/** `about` for notes about Zenbot itself */
export const ZENBOT = "zenbot";

export interface Memory {
  id: string;
  /** Discord user ID, SERVER or ZENBOT */
  about: string;
  text: string;
  /** Who it came from: their name then, or "Zenbot" */
  by: string;
  /** Their user ID, or ZENBOT */
  byId: string;
  /** Zenbot noted it from what it heard, nobody asked: treat as hearsay */
  overheard?: boolean;
  at: number;
}

const MAX_PER_SUBJECT = 15;
const MAX_SERVER = 30;
const MAX_CHARS = 200;
/** Notes per chat request, and how many of the speaker's are guaranteed */
const RECALL_BUDGET = 10;
const SPEAKER_GUARANTEED = 2;
/** Below this score a note stays out of the conversation */
const MIN_SCORE = 1;

interface MemoryRow {
  id: string;
  about: string;
  text: string;
  by_name: string;
  by_id: string;
  overheard: number;
  at: number;
}

const toMemory = (row: MemoryRow): Memory => ({
  id: row.id,
  about: row.about,
  text: row.text,
  by: row.by_name,
  byId: row.by_id,
  overheard: row.overheard === 1 || undefined,
  at: row.at,
});

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

/** Notes about one subject, newest first */
export const memoriesAbout = (guildId: string, about: string): Memory[] =>
  (
    getDb()
      .prepare(
        "SELECT * FROM memories WHERE guild_id = ? AND about = ? ORDER BY at DESC",
      )
      .all(guildId, about) as unknown as MemoryRow[]
  ).map(toMemory);

/**
 * Save a note. The same note again just refreshes it. When a subject is full
 * the oldest note goes. Returns null for an empty or overlong note.
 */
export const addMemory = async (
  guildId: string,
  memory: Omit<Memory, "id" | "at">,
): Promise<Memory | null> => {
  const text = memory.text.trim().replace(/\s+/g, " ");
  if (!text || text.length > MAX_CHARS) return null;
  const db = getDb();
  const now = Date.now();

  const existing = memoriesAbout(guildId, memory.about).find(
    (m) => normalize(m.text) === normalize(text),
  );
  if (existing) {
    db.prepare("UPDATE memories SET at = ? WHERE id = ?").run(now, existing.id);
    return { ...existing, at: now };
  }

  const saved: Memory = { ...memory, text, id: randomUUID(), at: now };
  db.prepare(
    "INSERT INTO memories (id, guild_id, about, text, by_name, by_id, overheard, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    saved.id,
    guildId,
    saved.about,
    saved.text,
    saved.by,
    saved.byId,
    saved.overheard ? 1 : 0,
    saved.at,
  );

  const limit = memory.about === SERVER ? MAX_SERVER : MAX_PER_SUBJECT;
  db.prepare(
    `DELETE FROM memories WHERE guild_id = ? AND about = ? AND id NOT IN (
      SELECT id FROM memories WHERE guild_id = ? AND about = ?
      ORDER BY at DESC LIMIT ?
    )`,
  ).run(guildId, memory.about, guildId, memory.about, limit);
  return saved;
};

/**
 * Who may delete a note: anyone, for notes about themselves, the server or
 * Zenbot; otherwise only whoever taught it.
 */
export const mayForget = (memory: Memory, requesterId: string): boolean =>
  memory.about === requesterId ||
  memory.about === SERVER ||
  memory.about === ZENBOT ||
  memory.byId === requesterId;

/**
 * Delete notes about a subject that contain all words of `match` (or all of
 * them without one), as far as the requester may. Reports what was removed
 * and how many matching notes they weren't allowed to touch.
 */
export const forgetMemories = async (
  guildId: string,
  about: string,
  requesterId: string,
  match?: string,
): Promise<{ removed: Memory[]; notAllowed: number }> => {
  const words = match ? normalize(match).split(" ").filter(Boolean) : [];
  const matching = memoriesAbout(guildId, about).filter((m) => {
    const text = normalize(m.text);
    return words.every((word) => text.includes(word));
  });
  const removed = matching.filter((m) => mayForget(m, requesterId));
  const remove = getDb().prepare("DELETE FROM memories WHERE id = ?");
  for (const m of removed) remove.run(m.id);
  return { removed, notAllowed: matching.length - removed.length };
};

// ===== RECALL =====

// Too common to say anything about the topic
const STOPWORDS = new Set(
  "the and for are but not you your yours with this that what when where which who whom why how was were will would can could should have has had did does doing just like about from into they them their there then than also any all some been being its it's our out over very much more most such only own same too here zenbot hey yeah okay yes".split(
    " ",
  ),
);

/**
 * An FTS5 query for the topic words in `text`: "pizza" OR "hungry". The index
 * is stemmed (porter), so "pizzas" finds "pizza". null when nothing is left.
 */
export const topicQuery = (text: string): string | null => {
  const words = [
    ...new Set(
      normalize(text)
        .split(" ")
        .filter((w) => w.length >= 3 && !STOPWORDS.has(w)),
    ),
  ].slice(0, 16);
  return words.length > 0 ? words.map((w) => `"${w}"`).join(" OR ") : null;
};

/** Notes whose words match the topic, best first (bm25) */
const topicMatches = (guildId: string, text: string): Memory[] => {
  const query = topicQuery(text);
  if (!query) return [];
  try {
    return (
      getDb()
        .prepare(
          `SELECT m.* FROM memories_fts
           JOIN memories m ON m.rowid = memories_fts.rowid
           WHERE memories_fts MATCH ? AND m.guild_id = ?
           ORDER BY bm25(memories_fts) LIMIT 20`,
        )
        .all(query, guildId) as unknown as MemoryRow[]
    ).map(toMemory);
  } catch {
    return []; // a query FTS5 can't parse just means no topic matches
  }
};

/** Whether `text` mentions `name` as a whole word */
const mentions = (text: string, name: string) =>
  new RegExp(
    `(^|[^\\p{L}])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}])`,
    "iu",
  ).test(text);

const daysOld = (at: number, now: number) => (now - at) / 86_400_000;

const age = (at: number, now: number): string => {
  const days = Math.floor(daysOld(at, now));
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 60) return `${days} days ago`;
  return `${Math.round(days / 30)} months ago`;
};

const source = (m: Memory) =>
  m.byId === ZENBOT
    ? "you noticed"
    : m.overheard
      ? `you overheard ${m.by}`
      : `${m.by} told you`;

/** How to name a subject in the prompt; null if we can't name them */
const subjectLabel = (
  guildId: string,
  about: string,
  guild: Guild | undefined,
  known: Map<string, GuildMember>,
): string | null => {
  if (about === SERVER) return "The server";
  if (about === ZENBOT) return "You";
  const member = known.get(about) ?? guild?.members?.cache?.get(about);
  if (member) return preferredName(member);
  return getAliases(guildId, about)[0] ?? null;
};

/**
 * Pick the notes worth having in a chat request, within RECALL_BUDGET:
 *
 * - topic: notes matching the words of the conversation (full-text search)
 * - who: notes about the speaker, people in voice, people named in it
 * - age: newer is better; "overheard" notes rank a little lower
 *
 * The speaker's best two are always in. A note needs MIN_SCORE to be shown,
 * so old unrelated notes stay out instead of padding the prompt.
 */
export const recallMemories = (
  guildId: string,
  present: GuildMember[],
  text = "",
  now = Date.now(),
): Memory[] => {
  const speakerId = present[0]?.id;
  const presentIds = new Set(present.map((m) => m.id));
  const guild = present[0]?.guild;

  // Named in the conversation: "what does Osha hate?" while Osha isn't here
  const subjects = getDb()
    .prepare(
      "SELECT DISTINCT about FROM memories WHERE guild_id = ? AND about NOT IN (?, ?)",
    )
    .all(guildId, SERVER, ZENBOT) as { about: string }[];
  const namedIds = new Set<string>();
  for (const { about } of subjects) {
    if (presentIds.has(about)) continue;
    const member = guild?.members?.cache?.get(about);
    const names = member ? namesFor(member) : getAliases(guildId, about);
    if (names.some((name) => mentions(text, name))) namedIds.add(about);
  }

  const topic = topicMatches(guildId, text);
  const candidates = new Map<string, Memory>();
  for (const m of [
    ...topic,
    ...[...presentIds, ...namedIds].flatMap((id) => memoriesAbout(guildId, id)),
    ...memoriesAbout(guildId, ZENBOT),
    ...memoriesAbout(guildId, SERVER).slice(0, 10),
  ]) {
    candidates.set(m.id, m);
  }

  const score = (m: Memory): number => {
    const rank = topic.findIndex((t) => t.id === m.id);
    const topical = rank >= 0 ? 3 + (1 - rank / topic.length) : 0;
    const who =
      m.about === speakerId
        ? 3
        : namedIds.has(m.about)
          ? 2.5
          : presentIds.has(m.about)
            ? 2
            : m.about === ZENBOT
              ? 1
              : 0.5;
    const days = daysOld(m.at, now);
    const fresh = days < 7 ? 1 : days < 30 ? 0.5 : 0;
    return topical + who + fresh - (m.overheard ? 0.5 : 0);
  };

  const ranked = [...candidates.values()]
    .map((m) => ({ m, s: score(m) }))
    .filter(({ s }) => s >= MIN_SCORE)
    .sort((a, b) => b.s - a.s);

  const picked = ranked
    .filter(({ m }) => m.about === speakerId)
    .slice(0, SPEAKER_GUARANTEED);
  for (const entry of ranked) {
    if (picked.length >= RECALL_BUDGET) break;
    if (!picked.includes(entry)) picked.push(entry);
  }
  return picked.map(({ m }) => m);
};

/**
 * The recalled notes as a prompt block, grouped by who they're about, or ""
 * when Zenbot knows nothing relevant.
 */
export const describeMemories = (
  guildId: string,
  present: GuildMember[],
  text = "",
  now = Date.now(),
): string => {
  const known = new Map(present.map((m) => [m.id, m]));
  const groups = new Map<string, string[]>();
  for (const m of recallMemories(guildId, present, text, now)) {
    const label = subjectLabel(guildId, m.about, present[0]?.guild, known);
    if (!label) continue;
    const notes = groups.get(label) ?? [];
    notes.push(`${m.text} (${source(m)}, ${age(m.at, now)})`);
    groups.set(label, notes);
  }
  if (groups.size === 0) return "";
  const lines = [...groups].map(
    ([label, notes]) =>
      `- ${label === "You" ? "About you" : label === "The server" ? "The server" : `About ${label}`}: ${notes.join("; ")}`,
  );
  return `(Your notes - things you remember. Bring one up when it fits; never recite the list. "Overheard" notes may be mis-transcribed, so treat them as hearsay:\n${lines.join("\n")})`;
};
