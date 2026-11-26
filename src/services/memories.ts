import { randomUUID } from "crypto";
import { GuildMember } from "discord.js";
import { jsonStore } from "./dataStore";
import { namesFor, preferredName } from "./people";

/**
 * Zenbot's notes about people and the server: "Osha hates pineapple pizza",
 * "game night ended in a three-way dice feud". People teach them ("remember
 * that..."), Zenbot jots down things it overhears, and a voice session gets a
 * diary note when something noteworthy happened (sessionRecap.ts). Stored per
 * guild in data/memories.json.
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
/** How many notes per subject go into a chat request */
const SHOWN_PER_SUBJECT = 8;

const store = jsonStore<Record<string, Memory[]>>("memories.json", () => ({}));

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

const guildMemories = (guildId: string): Memory[] =>
  (store.load()[guildId] ??= []);

/** Notes about one subject, newest first */
export const memoriesAbout = (guildId: string, about: string): Memory[] =>
  guildMemories(guildId)
    .filter((m) => m.about === about)
    .sort((a, b) => b.at - a.at);

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

  const memories = guildMemories(guildId);
  const existing = memories.find(
    (m) => m.about === memory.about && normalize(m.text) === normalize(text),
  );
  if (existing) {
    existing.at = Date.now();
    await store.save();
    return existing;
  }

  const saved: Memory = { ...memory, text, id: randomUUID(), at: Date.now() };
  memories.push(saved);
  const limit = memory.about === SERVER ? MAX_SERVER : MAX_PER_SUBJECT;
  const oldest = memoriesAbout(guildId, memory.about).slice(limit);
  for (const old of oldest) memories.splice(memories.indexOf(old), 1);
  await store.save();
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
  if (removed.length > 0) {
    store.load()[guildId] = guildMemories(guildId).filter(
      (m) => !removed.includes(m),
    );
    await store.save();
  }
  return { removed, notAllowed: matching.length - removed.length };
};

const age = (at: number, now: number): string => {
  const days = Math.floor((now - at) / 86_400_000);
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

const render = (memories: Memory[], now: number) =>
  memories
    .slice(0, SHOWN_PER_SUBJECT)
    .map((m) => `${m.text} (${source(m)}, ${age(m.at, now)})`)
    .join("; ");

/** Whether `text` mentions `name` as a whole word */
const mentions = (text: string, name: string) =>
  new RegExp(
    `(^|[^\\p{L}])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}])`,
    "iu",
  ).test(text);

/**
 * The notes worth having in a chat request: about the people present (the
 * speaker, people in voice), anyone the message names, Zenbot itself, and the
 * server's latest. "" when Zenbot knows nothing relevant.
 */
export const describeMemories = (
  guildId: string,
  present: GuildMember[],
  text = "",
  now = Date.now(),
): string => {
  const lines: string[] = [];
  const shown = new Set<string>();

  const people = [...present];
  // "what does Osha hate?" while Osha isn't around
  const guild = present[0]?.guild;
  for (const memory of guildMemories(guildId)) {
    if (shown.has(memory.about) || [SERVER, ZENBOT].includes(memory.about)) {
      continue;
    }
    shown.add(memory.about);
    const member = guild?.members?.cache?.get(memory.about);
    if (
      member &&
      !people.some((p) => p.id === member.id) &&
      namesFor(member).some((name) => mentions(text, name))
    ) {
      people.push(member);
    }
  }

  for (const person of people) {
    const notes = memoriesAbout(guildId, person.id);
    if (notes.length > 0) {
      lines.push(`- About ${preferredName(person)}: ${render(notes, now)}`);
    }
  }
  const self = memoriesAbout(guildId, ZENBOT);
  if (self.length > 0) lines.push(`- About you: ${render(self, now)}`);
  const server = memoriesAbout(guildId, SERVER);
  if (server.length > 0) lines.push(`- The server: ${render(server, now)}`);

  if (lines.length === 0) return "";
  return `(Your notes - things you remember. Bring one up when it fits; never recite the list. "Overheard" notes may be mis-transcribed, so treat them as hearsay:\n${lines.join("\n")})`;
};

/** For tests */
export const resetMemories = (data: Record<string, Memory[]> = {}): void =>
  store.reset(data);
