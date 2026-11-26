import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync, readFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// Notes are written to disk: point the store at a temp dir before loading
const dataDir = mkdtempSync(path.join(tmpdir(), "zenbot-memories-"));
process.env.ZENBOT_DATA_DIR = dataDir;

let memories: typeof import("../../src/services/memories");
let people: typeof import("../../src/services/people");
beforeAll(async () => {
  memories = await import("../../src/services/memories");
  people = await import("../../src/services/people");
});
beforeEach(() => {
  memories.resetMemories();
  people.resetAliasCache();
});

const member = (id: string, name: string, cache: any[] = []) =>
  ({
    id,
    guild: {
      id: "g1",
      members: { cache: new Map(cache.map((m) => [m.id, m])) },
    },
    displayName: name,
    nickname: null,
    user: { username: name.toLowerCase(), globalName: null },
  }) as any;

const note = (about: string, text: string, byId = "u1", by = "Nem") => ({
  about,
  text,
  by,
  byId,
});

describe("memories", () => {
  it("saves notes to disk, newest first, without duplicates", async () => {
    await memories.addMemory("g1", note("u2", "hates pineapple pizza"));
    await memories.addMemory("g1", note("u2", "owns three cats"));
    await memories.addMemory("g1", note("u2", "Hates pineapple pizza!"));

    const about = memories.memoriesAbout("g1", "u2").map((m) => m.text);
    expect(about).toHaveLength(2);
    expect(about).toContain("owns three cats");
    const onDisk = JSON.parse(
      readFileSync(path.join(dataDir, "memories.json"), "utf8"),
    );
    expect(onDisk.g1).toHaveLength(2);
  });

  it("rejects empty and overlong notes, and drops the oldest when full", async () => {
    expect(await memories.addMemory("g1", note("u2", "  "))).toBeNull();
    expect(
      await memories.addMemory("g1", note("u2", "x".repeat(201))),
    ).toBeNull();

    for (let i = 0; i < 16; i++) {
      await memories.addMemory("g1", note("u2", `fact number ${i}`));
    }
    const texts = memories.memoriesAbout("g1", "u2").map((m) => m.text);
    expect(texts).toHaveLength(15);
  });

  it("only lets the subject or the teacher forget a note about someone", async () => {
    await memories.addMemory("g1", note("u2", "hates pizza", "u1"));
    await memories.addMemory("g1", note("u2", "loves dice", "u3", "Murloc"));

    // u1 taught "hates pizza" but not "loves dice"
    const byNem = await memories.forgetMemories("g1", "u2", "u1");
    expect(byNem.removed.map((m) => m.text)).toEqual(["hates pizza"]);
    expect(byNem.notAllowed).toBe(1);

    // Osha (u2) can wipe anything about themselves
    const byOsha = await memories.forgetMemories("g1", "u2", "u2", "dice");
    expect(byOsha.removed.map((m) => m.text)).toEqual(["loves dice"]);
    expect(memories.memoriesAbout("g1", "u2")).toEqual([]);
  });

  it("lets anyone forget server notes", async () => {
    await memories.addMemory(
      "g1",
      note(memories.SERVER, "game night ended in a feud", "zenbot", "Zenbot"),
    );
    const result = await memories.forgetMemories(
      "g1",
      memories.SERVER,
      "u9",
      "feud",
    );
    expect(result.removed).toHaveLength(1);
  });

  it("describes notes about people present, people named, and the server", async () => {
    const osha = member("u2", "Osha");
    const nem = member("u1", "Nem", [osha]);
    await memories.addMemory("g1", note("u1", "blames the dice"));
    await memories.addMemory("g1", note("u2", "hates pineapple pizza"));
    await memories.addMemory("g1", {
      ...note(
        memories.SERVER,
        "Tuesday's raid was a disaster",
        "zenbot",
        "Zenbot",
      ),
      overheard: true,
    });

    const alone = memories.describeMemories("g1", [nem], "hello");
    expect(alone).toContain("About Nem: blames the dice (Nem told you, today)");
    expect(alone).toContain(
      "The server: Tuesday's raid was a disaster (you noticed",
    );
    expect(alone).not.toContain("pizza");

    // Osha isn't here, but the message is about them
    const asked = memories.describeMemories(
      "g1",
      [nem],
      "what does Osha hate?",
    );
    expect(asked).toContain("About Osha: hates pineapple pizza");
  });

  it("says nothing when it knows nothing", () => {
    expect(memories.describeMemories("g1", [member("u1", "Nem")])).toBe("");
  });
});
