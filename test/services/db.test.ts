import { describe, it, expect, beforeEach } from "vitest";
import { writeFileSync, existsSync } from "fs";
import path from "path";
import { getDb, resetDb, pruneVoiceLines } from "../../src/services/db";
import { getAliases } from "../../src/services/people";
import { memoriesAbout } from "../../src/services/memories";
import {
  addRoomLine,
  clearRoomLog,
} from "../../src/services/voice/voiceRoomLog";

// ZENBOT_DATA_DIR is a per-worker temp dir (test/setup/globals.ts)
const dataDir = process.env.ZENBOT_DATA_DIR!;

beforeEach(() => {
  resetDb();
  clearRoomLog();
});

describe("zenbot.db", () => {
  it("imports the old JSON stores once, then renames them", () => {
    writeFileSync(
      path.join(dataDir, "aliases.json"),
      JSON.stringify({ g1: { u1: ["Nem", "Nemmy"] } }),
    );
    writeFileSync(
      path.join(dataDir, "memories.json"),
      JSON.stringify({
        g1: [
          {
            id: "m1",
            about: "u2",
            text: "hates pineapple pizza",
            by: "Nem",
            byId: "u1",
            at: 1,
          },
        ],
      }),
    );

    expect(getAliases("g1", "u1")).toEqual(["Nem", "Nemmy"]);
    expect(memoriesAbout("g1", "u2").map((m) => m.text)).toEqual([
      "hates pineapple pizza",
    ]);
    expect(existsSync(path.join(dataDir, "aliases.json"))).toBe(false);
    expect(existsSync(path.join(dataDir, "aliases.json.migrated"))).toBe(true);
  });

  it("stores voice lines and prunes ones past VOICE_LOG_DAYS", () => {
    addRoomLine("g1", "Osha", "the raid starts at nine", "u2");
    const count = () =>
      (
        getDb().prepare("SELECT COUNT(*) AS n FROM voice_lines").get() as {
          n: number;
        }
      ).n;
    expect(count()).toBe(1);

    // Searchable by (stemmed) topic for conversation recall
    const hit = getDb()
      .prepare(
        "SELECT v.speaker FROM voice_lines_fts JOIN voice_lines v ON v.id = voice_lines_fts.rowid WHERE voice_lines_fts MATCH ?",
      )
      .get('"raids"') as { speaker: string };
    expect(hit.speaker).toBe("Osha");

    getDb().prepare("UPDATE voice_lines SET at = 0").run();
    pruneVoiceLines();
    expect(count()).toBe(0);
  });
});
