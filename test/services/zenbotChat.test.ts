import { describe, it, expect } from "vitest";
import {
  chatErrorLine,
  extractMood,
  isUnusableReply,
} from "../../src/services/zenbotChat";
import {
  recordRename,
  renameWaitMinutes,
} from "../../src/actions/management/channelManagementAction";

describe("isUnusableReply", () => {
  it.each([
    "",
    "[gong]",
    "  [pause] [gong] ",
    "[mood:playful]",
    "(no response)",
    'roll_dice success: 🎲 2d20 roll for "Beat a 30": **18, 5**',
    "set_voice_mood success: weary. Provide your final response with full Zenbot personality",
  ])("rejects: %s", (reply) => {
    expect(isUnusableReply(reply)).toBe(true);
  });

  it.each([
    "Tails. Another round. [pause] [gong] Shuffle the cards.",
    "An 8. Fittingly average.",
    "[gong] Pineapple is acceptable. Barely.",
    "[mood:wise] Sleep. It's free.",
  ])("accepts: %s", (reply) => {
    expect(isUnusableReply(reply)).toBe(false);
  });
});

describe("extractMood", () => {
  it("takes the mood tag out of the reply", () => {
    expect(extractMood("[mood:playful] Oh, you again.")).toEqual({
      text: "Oh, you again.",
      mood: "playful",
    });
  });

  it("ignores unknown moods but still strips the tag", () => {
    expect(extractMood("[mood:weary] Fine.")).toEqual({
      text: "Fine.",
      mood: undefined,
    });
  });

  it("first valid mood wins, case-insensitive", () => {
    expect(extractMood("[Mood: CALM] Breathe. [mood:intense]")).toEqual({
      text: "Breathe.",
      mood: "calm",
    });
  });

  it("leaves replies without a tag alone", () => {
    expect(extractMood("Heads.")).toEqual({ text: "Heads.", mood: undefined });
  });
});

describe("chatErrorLine", () => {
  it("explains rate limits instead of claiming breakage", () => {
    expect(chatErrorLine(new Error("[429 Too Many Requests] quota"))).toMatch(
      /rate limit/,
    );
    expect(chatErrorLine(new Error("Circuit breaker open for gemini"))).toMatch(
      /rate limit/,
    );
    expect(chatErrorLine(new Error("boom"))).toMatch(/broke/);
  });
});

describe("channel rename limit", () => {
  it("allows two renames per channel, then asks to wait", () => {
    expect(renameWaitMinutes("chan-a")).toBe(0);
    recordRename("chan-a");
    recordRename("chan-a");
    expect(renameWaitMinutes("chan-a")).toBeGreaterThanOrEqual(9);
    expect(renameWaitMinutes("chan-b")).toBe(0);
  });
});
