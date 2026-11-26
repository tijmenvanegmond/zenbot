import { describe, it, expect, beforeAll, beforeEach } from "vitest";

// zenbot.db lives in the per-worker temp dir from test/setup/globals.ts
let memories: typeof import("../../src/services/memories");
let db: typeof import("../../src/services/db");
beforeAll(async () => {
  memories = await import("../../src/services/memories");
  db = await import("../../src/services/db");
});
beforeEach(() => db.resetDb());

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
  it("saves notes, newest first, without duplicates", async () => {
    await memories.addMemory("g1", note("u2", "hates pineapple pizza"));
    await memories.addMemory("g1", note("u2", "owns three cats"));
    await memories.addMemory("g1", note("u2", "Hates pineapple pizza!"));

    const about = memories.memoriesAbout("g1", "u2").map((m) => m.text);
    expect(about).toHaveLength(2);
    expect(about).toContain("owns three cats");
    db.closeDb();
    expect(memories.memoriesAbout("g1", "u2")).toHaveLength(2);
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

describe("recall", () => {
  const DAY = 86_400_000;

  it("brings up a note by topic, even about someone absent and unnamed", async () => {
    const osha = member("u2", "Osha");
    const nem = member("u1", "Nem", [osha]);
    await memories.addMemory("g1", note("u2", "hates pineapple pizza"));

    // Stemmed: "pizzas" finds "pizza"
    expect(
      memories.describeMemories("g1", [nem], "should we order pizzas tonight?"),
    ).toContain("About Osha: hates pineapple pizza");
    expect(memories.describeMemories("g1", [nem], "nice weather")).toBe("");
  });

  it("keeps old unrelated notes out, but recalls them on topic", async () => {
    const nem = member("u1", "Nem");
    const later = Date.now() + 90 * DAY;
    await memories.addMemory(
      "g1",
      note(
        memories.SERVER,
        "the great dice feud of spring",
        "zenbot",
        "Zenbot",
      ),
    );

    expect(memories.recallMemories("g1", [nem], "hello", later)).toEqual([]);
    expect(
      memories.recallMemories("g1", [nem], "roll the dice", later),
    ).toHaveLength(1);
  });

  it("always includes the speaker's best notes, within the budget", async () => {
    const nem = member("u1", "Nem");
    for (let i = 0; i < 12; i++) {
      await memories.addMemory(
        "g1",
        note(memories.SERVER, `raid night number ${i}`, "zenbot", "Zenbot"),
      );
    }
    await memories.addMemory("g1", note("u1", "blames the dice"));

    const recalled = memories.recallMemories("g1", [nem], "raid tonight");
    expect(recalled).toHaveLength(10);
    expect(recalled.map((m) => m.text)).toContain("blames the dice");
  });

  it("builds a safe full-text query from free text", () => {
    expect(memories.topicQuery('the "pizza" OR (hungry)')).toBe(
      '"pizza" OR "hungry"',
    );
    expect(memories.topicQuery("hey zenbot, the and")).toBeNull();
  });
});
