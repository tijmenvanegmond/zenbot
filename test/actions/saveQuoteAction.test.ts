import { describe, it, expect } from "vitest";
import {
  pickQuoteLine,
  quoteSpeakerName,
} from "../../src/actions/information/saveQuoteAction";
import { RoomLine } from "../../src/services/voice/voiceRoomLog";

const line = (speaker: string, speakerId: string, text: string): RoomLine => ({
  speaker,
  speakerId,
  text,
  at: Date.now(),
});

const room = [
  line("Osha", "osha", "pelicans are just big seagulls"),
  line("Murloc", "murloc", "that's the dumbest thing I've heard today"),
  line("Zenbot (you)", "zenbot", "Pelicans would be offended."),
  line("Osha", "osha", "I'm getting pizza"),
  line("Tijmen", "me", "Zenbot, quote that!"),
];

describe("pickQuoteLine", () => {
  it("takes the latest line by someone else, skipping the request", () => {
    expect(pickQuoteLine(room, "me")?.text).toBe("I'm getting pizza");
  });

  it("narrows by speaker and by words", () => {
    expect(pickQuoteLine(room, "me", "murloc")?.text).toMatch(/dumbest/);
    expect(pickQuoteLine(room, "me", "Osha", "seagulls")?.text).toMatch(
      /pelicans/,
    );
    expect(pickQuoteLine(room, "me", "zenbot")?.speakerId).toBe("zenbot");
  });

  it("finds nothing rather than guessing", () => {
    expect(pickQuoteLine(room, "me", "Bob")).toBeUndefined();
    expect(pickQuoteLine(room, "me", undefined, "spaceship")).toBeUndefined();
    expect(pickQuoteLine([], "me")).toBeUndefined();
  });

  it("can quote the requester's own line if that's all there is", () => {
    const solo = [line("Tijmen", "me", "I am a genius")];
    expect(pickQuoteLine(solo, "me")?.text).toBe("I am a genius");
  });
});

describe("quoteSpeakerName", () => {
  it("drops the room log labels", () => {
    expect(quoteSpeakerName(room[2])).toBe("Zenbot");
    expect(quoteSpeakerName(line("Osha (typed)", "osha", "x"))).toBe("Osha");
  });
});
