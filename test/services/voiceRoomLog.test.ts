import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  addRoomLine,
  clearRoomLog,
  describeRoom,
} from "../../src/services/voice/voiceRoomLog";

describe("voiceRoomLog", () => {
  beforeEach(() => clearRoomLog());
  afterEach(() => vi.useRealTimers());

  it("is empty for a quiet room", () => {
    expect(describeRoom("g")).toBe("");
  });

  it("lists who said what, oldest first, leaving out the current message", () => {
    addRoomLine("g", "Osha", "I'm getting pizza");
    addRoomLine("g", "Tijmen", "Zenbot, what did Osha just say?");
    const room = describeRoom("g", "Zenbot, what did Osha just say?");
    expect(room).toContain("- Osha (0s ago): I'm getting pizza");
    expect(room).not.toContain("what did Osha");
  });

  it("keeps only the last 10 lines, per guild", () => {
    for (let i = 1; i <= 12; i++) addRoomLine("g", "A", `line ${i}`);
    addRoomLine("other", "B", "elsewhere");
    const room = describeRoom("g");
    expect(room).not.toContain("line 2\n");
    expect(room).toContain("line 3");
    expect(room).toContain("line 12");
    expect(room).not.toContain("elsewhere");
  });

  it("forgets lines after 5 minutes", () => {
    vi.useFakeTimers();
    addRoomLine("g", "Osha", "old news");
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(describeRoom("g")).toBe("");
  });
});

describe("session history", () => {
  it("keeps every line since the last recap, then starts over", async () => {
    const log = await import("../../src/services/voice/voiceRoomLog");
    log.clearRoomLog();
    for (let i = 0; i < 15; i++)
      log.addRoomLine("g9", "Osha", `line ${i}`, "u2");

    // The prompt log keeps 10; the session history keeps all of them
    expect(log.recentRoomLines("g9")).toHaveLength(10);
    const history = log.takeSessionHistory("g9");
    expect(history).toHaveLength(15);
    expect(history[0].text).toBe("line 0");
    expect(log.takeSessionHistory("g9")).toEqual([]);
  });
});
