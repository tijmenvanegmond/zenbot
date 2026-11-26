import { existsSync, mkdirSync, readFileSync, renameSync, rmSync } from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import { logger } from "../utils/logger";

/**
 * Zenbot's long-term memory: one SQLite file, data/zenbot.db
 * (ZENBOT_DATA_DIR; docker-compose mounts ./data so it survives rebuilds).
 * Built into Node - no native dependency, no database server.
 *
 * - aliases: names people go by (people.ts)
 * - memories: notes about people, the server and Zenbot (memories.ts)
 * - voice_lines: what was said in voice, kept VOICE_LOG_DAYS, for
 *   conversation recall
 * memories and voice_lines have full-text indexes (FTS5, stemmed), so recall
 * can search by topic.
 */

export type Database = DatabaseSync;

const dataDir = () =>
  process.env.ZENBOT_DATA_DIR || path.join(process.cwd(), "data");

/** Days of voice transcript to keep; 0 stores none */
export const voiceLogDays = (): number => {
  const days = Number(process.env.VOICE_LOG_DAYS ?? 30);
  return Number.isFinite(days) && days >= 0 ? days : 30;
};

/** Each entry upgrades the schema by one version (PRAGMA user_version) */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE aliases (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    alias TEXT NOT NULL COLLATE NOCASE,
    added_at INTEGER NOT NULL,
    PRIMARY KEY (guild_id, user_id, alias)
  );

  CREATE TABLE memories (
    id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    about TEXT NOT NULL,
    text TEXT NOT NULL,
    by_name TEXT NOT NULL,
    by_id TEXT NOT NULL,
    overheard INTEGER NOT NULL DEFAULT 0,
    at INTEGER NOT NULL
  );
  CREATE INDEX memories_subject ON memories (guild_id, about, at);
  CREATE VIRTUAL TABLE memories_fts USING fts5 (
    text, content = 'memories', content_rowid = 'rowid',
    tokenize = 'porter unicode61'
  );
  CREATE TRIGGER memories_ai AFTER INSERT ON memories BEGIN
    INSERT INTO memories_fts (rowid, text) VALUES (new.rowid, new.text);
  END;
  CREATE TRIGGER memories_ad AFTER DELETE ON memories BEGIN
    INSERT INTO memories_fts (memories_fts, rowid, text)
      VALUES ('delete', old.rowid, old.text);
  END;
  CREATE TRIGGER memories_au AFTER UPDATE OF text ON memories BEGIN
    INSERT INTO memories_fts (memories_fts, rowid, text)
      VALUES ('delete', old.rowid, old.text);
    INSERT INTO memories_fts (rowid, text) VALUES (new.rowid, new.text);
  END;

  CREATE TABLE voice_lines (
    id INTEGER PRIMARY KEY,
    guild_id TEXT NOT NULL,
    speaker TEXT NOT NULL,
    speaker_id TEXT,
    text TEXT NOT NULL,
    at INTEGER NOT NULL
  );
  CREATE INDEX voice_lines_time ON voice_lines (guild_id, at);
  CREATE VIRTUAL TABLE voice_lines_fts USING fts5 (
    text, content = 'voice_lines', content_rowid = 'id',
    tokenize = 'porter unicode61'
  );
  CREATE TRIGGER voice_lines_ai AFTER INSERT ON voice_lines BEGIN
    INSERT INTO voice_lines_fts (rowid, text) VALUES (new.id, new.text);
  END;
  CREATE TRIGGER voice_lines_ad AFTER DELETE ON voice_lines BEGIN
    INSERT INTO voice_lines_fts (voice_lines_fts, rowid, text)
      VALUES ('delete', old.id, old.text);
  END;
  `,
];

/** Before SQLite: aliases.json / memories.json. Imported once, then renamed. */
const importJsonStores = (db: Database, dir: string) => {
  const aliasFile = path.join(dir, "aliases.json");
  if (existsSync(aliasFile)) {
    const data = JSON.parse(readFileSync(aliasFile, "utf8")) as Record<
      string,
      Record<string, string[]>
    >;
    const insert = db.prepare(
      "INSERT OR IGNORE INTO aliases (guild_id, user_id, alias, added_at) VALUES (?, ?, ?, ?)",
    );
    const now = Date.now();
    for (const [guildId, users] of Object.entries(data)) {
      for (const [userId, aliases] of Object.entries(users)) {
        // Preferred first in the file; newest wins in the table
        aliases.forEach((alias, i) =>
          insert.run(guildId, userId, alias, now - i),
        );
      }
    }
    renameSync(aliasFile, `${aliasFile}.migrated`);
    logger.info("💾 Imported aliases.json into zenbot.db");
  }

  const memoryFile = path.join(dir, "memories.json");
  if (existsSync(memoryFile)) {
    const data = JSON.parse(readFileSync(memoryFile, "utf8")) as Record<
      string,
      {
        id: string;
        about: string;
        text: string;
        by: string;
        byId: string;
        overheard?: boolean;
        at: number;
      }[]
    >;
    const insert = db.prepare(
      "INSERT OR IGNORE INTO memories (id, guild_id, about, text, by_name, by_id, overheard, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (const [guildId, memories] of Object.entries(data)) {
      for (const m of memories) {
        insert.run(
          m.id,
          guildId,
          m.about,
          m.text,
          m.by,
          m.byId,
          m.overheard ? 1 : 0,
          m.at,
        );
      }
    }
    renameSync(memoryFile, `${memoryFile}.migrated`);
    logger.info("💾 Imported memories.json into zenbot.db");
  }
};

const migrate = (db: Database, dir: string | null) => {
  const { user_version: version } = db.prepare("PRAGMA user_version").get() as {
    user_version: number;
  };
  for (let v = version; v < MIGRATIONS.length; v++) {
    db.exec("BEGIN");
    try {
      db.exec(MIGRATIONS[v]);
      if (v === 0 && dir) importJsonStores(db, dir);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
};

/** Drop voice transcript older than VOICE_LOG_DAYS */
export const pruneVoiceLines = (db: Database = getDb()): void => {
  const cutoff = Date.now() - voiceLogDays() * 86_400_000;
  const { changes } = db
    .prepare("DELETE FROM voice_lines WHERE at < ?")
    .run(cutoff);
  if (Number(changes) > 0) {
    logger.info(
      `💾 Pruned ${changes} voice lines older than ${voiceLogDays()} days`,
    );
  }
};

let lastPrune = 0;

/** Prune at most once a day - called on every stored voice line */
export const pruneVoiceLinesDaily = (): void => {
  if (Date.now() - lastPrune < 86_400_000) return;
  lastPrune = Date.now();
  pruneVoiceLines();
};

let db: Database | null = null;

export const getDb = (): Database => {
  if (db) return db;
  const dir = dataDir();
  mkdirSync(dir, { recursive: true });
  db = new DatabaseSync(path.join(dir, "zenbot.db"));
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 2000;");
  migrate(db, dir);
  pruneVoiceLines(db);
  return db;
};

/** Close the file; the next getDb() opens it again */
export const closeDb = (): void => {
  db?.close();
  db = null;
};

/** For tests: a fresh, empty database */
export const resetDb = (): void => {
  closeDb();
  const file = path.join(dataDir(), "zenbot.db");
  for (const suffix of ["", "-wal", "-shm"]) {
    rmSync(`${file}${suffix}`, { force: true });
  }
};
