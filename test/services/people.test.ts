import { describe, it, expect, beforeAll, beforeEach } from "vitest";

// zenbot.db lives in the per-worker temp dir from test/setup/globals.ts
let people: typeof import("../../src/services/people");
let db: typeof import("../../src/services/db");
beforeAll(async () => {
  people = await import("../../src/services/people");
  db = await import("../../src/services/db");
});
beforeEach(() => db.resetDb());

const member = (overrides: Record<string, any> = {}) =>
  ({
    id: "u1",
    guild: { id: "g1" },
    displayName: "The worst of us",
    nickname: "The worst of us",
    user: { username: "nemjit", globalName: "Nemjit" },
    ...overrides,
  }) as any;

describe("people", () => {
  it("knows every Discord name, without duplicates", () => {
    expect(people.namesFor(member())).toEqual(["The worst of us", "Nemjit"]);
    expect(people.describePerson(member())).toBe(
      "The worst of us (aka Nemjit)",
    );
  });

  it("an alias becomes the preferred name and is saved", async () => {
    await people.addAlias("g1", "u1", "Nem");
    expect(people.preferredName(member())).toBe("Nem");
    expect(people.describePerson(member())).toBe(
      "Nem (aka The worst of us, Nemjit)",
    );
    // Still there after reopening the database file
    db.closeDb();
    expect(people.getAliases("g1", "u1")).toEqual(["Nem"]);
  });

  it("recognises any name, case-insensitive", async () => {
    await people.addAlias("g1", "u1", "Nem");
    for (const name of ["nem", "NEMJIT", "the worst of us", "@nem"]) {
      expect(people.goesBy(member(), name)).toBe(true);
    }
    expect(people.goesBy(member(), "Osha")).toBe(false);
  });

  it("aliases are per server", async () => {
    await people.addAlias("g1", "u1", "Nem");
    expect(people.preferredName(member({ guild: { id: "g2" } }))).toBe(
      "The worst of us",
    );
  });

  it("re-adding moves an alias to the front; removing forgets it", async () => {
    await people.addAlias("g1", "u1", "Nem");
    await people.addAlias("g1", "u1", "Worst");
    await people.addAlias("g1", "u1", "nem");
    expect(people.getAliases("g1", "u1")).toEqual(["nem", "Worst"]);
    expect(await people.removeAlias("g1", "u1", "WORST")).toBe(true);
    expect(await people.removeAlias("g1", "u1", "Bob")).toBe(false);
    expect(people.getAliases("g1", "u1")).toEqual(["nem"]);
  });

  it("rejects empty and overlong aliases", async () => {
    expect(await people.addAlias("g1", "u1", "  ")).toBe(false);
    expect(await people.addAlias("g1", "u1", "x".repeat(33))).toBe(false);
  });

  it("finds a member by alias among candidates", async () => {
    await people.addAlias("g1", "u1", "Nem");
    const osha = member({
      id: "u2",
      displayName: "Osha",
      nickname: null,
      user: { username: "osha", globalName: null },
    });
    const guild = { id: "g1", members: { cache: { find: () => undefined } } };
    expect(
      (await people.findMemberByName(guild as any, "nem", [osha, member()]))
        ?.id,
    ).toBe("u1");
  });
});
