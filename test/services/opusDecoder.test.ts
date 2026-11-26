import { describe, it, expect, vi } from "vitest";

// The suite mocks @discordjs/voice, not the codecs - use the real ones here
vi.unmock("@discordjs/opus");

import { OpusDecoder } from "../../src/services/voice/opusDecoder";

const { OpusEncoder } = require("@discordjs/opus");

describe("OpusDecoder", () => {
  it("decodes a 20ms Opus packet to 48kHz stereo 16-bit PCM", () => {
    const encoder = new OpusEncoder(48000, 2);
    const packet = encoder.encode(Buffer.alloc(960 * 2 * 2));

    const pcm = new OpusDecoder().decode(packet);

    expect(pcm).not.toBeNull();
    expect(pcm!.length).toBe(960 * 2 * 2);
  });

  it("never throws on garbage (e.g. still-encrypted) packets", () => {
    const decoder = new OpusDecoder();
    const garbage = [
      Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9]),
      Buffer.alloc(0),
      Buffer.alloc(4000, 0xff),
    ];

    for (const packet of garbage) {
      expect(() => decoder.decode(packet)).not.toThrow();
    }

    // and keeps decoding real packets afterwards
    const encoder = new OpusEncoder(48000, 2);
    expect(decoder.decode(encoder.encode(Buffer.alloc(3840)))).not.toBeNull();
  });
});
