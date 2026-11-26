import { promises as fs, readFileSync } from "fs";
import path from "path";
import { Guild, GuildMember } from "discord.js";
import { logger } from "../utils/logger";

/**
 * People go by several names: "The worst of us" is also nemjit, or nem.
 * Discord knows some (display name, server nickname, global name, username);
 * the rest are aliases people teach Zenbot ("call me Nem"), stored per guild
 * in data/aliases.json so they survive restarts.
 */

const DATA_DIR =
  process.env.ZENBOT_DATA_DIR || path.join(process.cwd(), "data");
const ALIAS_FILE = path.join(DATA_DIR, "aliases.json");
const MAX_ALIASES = 5;
const MAX_ALIAS_CHARS = 32;

/** guildId -> userId -> aliases, preferred first */
type AliasStore = Record<string, Record<string, string[]>>;

let store: AliasStore | null = null;

const load = (): AliasStore => {
  if (store) return store;
  try {
    store = JSON.parse(readFileSync(ALIAS_FILE, "utf8")) as AliasStore;
  } catch {
    store = {};
  }
  return store;
};

const save = async (): Promise<void> => {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(ALIAS_FILE, JSON.stringify(load(), null, 2));
  } catch (error) {
    logger.error("👥 Failed to save aliases:", error);
  }
};

const same = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/** Nicknames people taught Zenbot, preferred first */
export const getAliases = (guildId: string, userId: string): string[] =>
  load()[guildId]?.[userId] ?? [];

/** Add an alias (it becomes the preferred name). Returns false if invalid. */
export const addAlias = async (
  guildId: string,
  userId: string,
  alias: string,
): Promise<boolean> => {
  const name = alias.trim().replace(/^@/, "");
  if (!name || name.length > MAX_ALIAS_CHARS) return false;
  const guild = (load()[guildId] ??= {});
  const current = (guild[userId] ?? []).filter((a) => !same(a, name));
  guild[userId] = [name, ...current].slice(0, MAX_ALIASES);
  await save();
  return true;
};

/** Remove an alias. Returns false if they didn't have it. */
export const removeAlias = async (
  guildId: string,
  userId: string,
  alias: string,
): Promise<boolean> => {
  const guild = load()[guildId];
  const current = guild?.[userId] ?? [];
  const next = current.filter((a) => !same(a, alias));
  if (next.length === current.length) return false;
  guild![userId] = next;
  await save();
  return true;
};

/** Every name someone goes by: preferred first, no duplicates */
export const namesFor = (member: GuildMember): string[] => {
  const names = [
    ...getAliases(member.guild.id, member.id),
    member.displayName,
    member.nickname,
    member.user.globalName,
    member.user.username,
  ].filter((n): n is string => !!n && n.trim().length > 0);
  return names.filter(
    (name, i) => names.findIndex((other) => same(other, name)) === i,
  );
};

/** What Zenbot should call them: their chosen alias, else display name */
export const preferredName = (member: GuildMember): string =>
  getAliases(member.guild.id, member.id)[0] ?? member.displayName;

/** "Nem (aka The worst of us, nemjit)" - for the AI's context */
export const describePerson = (member: GuildMember): string => {
  const [first, ...rest] = namesFor(member);
  return rest.length > 0 ? `${first} (aka ${rest.join(", ")})` : first;
};

/** Whether `name` is one of the names this member goes by */
export const goesBy = (member: GuildMember, name: string): boolean =>
  namesFor(member).some((n) => same(n, name.replace(/^@/, "")));

/**
 * Find someone by any of their names: the given candidates first (e.g. the
 * voice channel), then everyone cached in the server, then a Discord search.
 */
export const findMemberByName = async (
  guild: Guild,
  name: string,
  candidates: Iterable<GuildMember> = [],
): Promise<GuildMember | null> => {
  const target = name.trim().replace(/^@/, "");
  if (!target) return null;
  for (const member of candidates) {
    if (goesBy(member, target)) return member;
  }
  const cached = guild.members.cache.find((m) => goesBy(m, target));
  if (cached) return cached;

  // Aliases aren't searchable in Discord: map one back to a user ID first
  const aliased = Object.entries(load()[guild.id] ?? {}).find(([, aliases]) =>
    aliases.some((a) => same(a, target)),
  );
  if (aliased) {
    const member = await guild.members.fetch(aliased[0]).catch(() => null);
    if (member) return member;
  }

  const found = await guild.members
    .fetch({ query: target, limit: 5 })
    .catch(() => null);
  return found?.find((m) => goesBy(m, target)) ?? null;
};

/** For tests */
export const resetAliasCache = (data: AliasStore = {}): void => {
  store = data;
};
