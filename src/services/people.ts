import { Guild, GuildMember } from "discord.js";
import { getDb } from "./db";

/**
 * People go by several names: "The worst of us" is also nemjit, or nem.
 * Discord knows some (display name, server nickname, global name, username);
 * the rest are aliases people teach Zenbot ("call me Nem"), stored per guild
 * in zenbot.db (db.ts). The newest alias is the preferred one.
 */

const MAX_ALIASES = 5;
const MAX_ALIAS_CHARS = 32;

const same = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/** Nicknames people taught Zenbot, preferred (newest) first */
export const getAliases = (guildId: string, userId: string): string[] =>
  (
    getDb()
      .prepare(
        "SELECT alias FROM aliases WHERE guild_id = ? AND user_id = ? ORDER BY added_at DESC",
      )
      .all(guildId, userId) as { alias: string }[]
  ).map((row) => row.alias);

/** Add an alias (it becomes the preferred name). Returns false if invalid. */
export const addAlias = async (
  guildId: string,
  userId: string,
  alias: string,
): Promise<boolean> => {
  const name = alias.trim().replace(/^@/, "");
  if (!name || name.length > MAX_ALIAS_CHARS) return false;
  const db = getDb();
  // Same alias again (any case): takes the new spelling and moves to the front
  db.prepare(
    "DELETE FROM aliases WHERE guild_id = ? AND user_id = ? AND alias = ?",
  ).run(guildId, userId, name);
  db.prepare(
    "INSERT INTO aliases (guild_id, user_id, alias, added_at) VALUES (?, ?, ?, ?)",
  ).run(guildId, userId, name, nextTimestamp(guildId, userId));
  // Keep the newest few
  db.prepare(
    `DELETE FROM aliases WHERE guild_id = ? AND user_id = ? AND alias NOT IN (
      SELECT alias FROM aliases WHERE guild_id = ? AND user_id = ?
      ORDER BY added_at DESC LIMIT ?
    )`,
  ).run(guildId, userId, guildId, userId, MAX_ALIASES);
  return true;
};

/** Now, but always after their latest alias (two in one millisecond) */
const nextTimestamp = (guildId: string, userId: string): number => {
  const { latest } = getDb()
    .prepare(
      "SELECT MAX(added_at) AS latest FROM aliases WHERE guild_id = ? AND user_id = ?",
    )
    .get(guildId, userId) as { latest: number | null };
  return Math.max(Date.now(), (latest ?? 0) + 1);
};

/** Remove an alias. Returns false if they didn't have it. */
export const removeAlias = async (
  guildId: string,
  userId: string,
  alias: string,
): Promise<boolean> => {
  const { changes } = getDb()
    .prepare(
      "DELETE FROM aliases WHERE guild_id = ? AND user_id = ? AND alias = ?",
    )
    .run(guildId, userId, alias.trim().replace(/^@/, ""));
  return Number(changes) > 0;
};

/** Whose alias this is in the guild, if anyone's (newest wins) */
export const aliasOwner = (guildId: string, alias: string): string | null =>
  (
    getDb()
      .prepare(
        "SELECT user_id FROM aliases WHERE guild_id = ? AND alias = ? ORDER BY added_at DESC LIMIT 1",
      )
      .get(guildId, alias.trim()) as { user_id: string } | undefined
  )?.user_id ?? null;

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
  const ownerId = aliasOwner(guild.id, target);
  if (ownerId) {
    const member = await guild.members.fetch(ownerId).catch(() => null);
    if (member) return member;
  }

  const found = await guild.members
    .fetch({ query: target, limit: 5 })
    .catch(() => null);
  return found?.find((m) => goesBy(m, target)) ?? null;
};
