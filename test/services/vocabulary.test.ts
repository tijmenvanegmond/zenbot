import { describe, it, expect } from "vitest";
import { fixKnownMishearings } from "../../src/services/voice/vocabulary";

describe("fixKnownMishearings", () => {
  it.each([
    ["Tim Bolts, can you rename Maki?", "Zenbot, can you rename Maki?"],
    ["Then Bolt", "Zenbot"],
    ["tim-bolt quota", "Zenbot quota"],
    ["Zen bolts, please leave.", "Zenbot, please leave."],
    ["hey zen bot", "hey Zenbot"],
    ["ZennBot?", "Zenbot?"],
  ])("%s -> %s", (heard, fixed) => {
    expect(fixKnownMishearings(heard)).toBe(fixed);
  });

  it.each([
    "zen and the art of motorcycle maintenance",
    "them both are wrong",
    "the bolts are loose",
    "Zenyatta is the best support",
  ])("leaves alone: %s", (text) => {
    expect(fixKnownMishearings(text)).toBe(text);
  });
});
