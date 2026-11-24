import { describe, it, expect } from "vitest";
import { isUnusableReply } from "../../src/services/zenbotChat";

describe("isUnusableReply", () => {
  it.each([
    "",
    "[gong]",
    "  [pause] [gong] ",
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
  ])("accepts: %s", (reply) => {
    expect(isUnusableReply(reply)).toBe(false);
  });
});
