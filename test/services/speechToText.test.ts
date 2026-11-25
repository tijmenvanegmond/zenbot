import { describe, it, expect } from "vitest";
import {
  MIN_SPEECH_LEVEL_DB,
  speechLevelDb,
  toMono16k,
} from "../../src/services/speechToText";
import { WAKE_WORD } from "../../src/actions/voice/listenControlAction";

// 16-bit PCM WAV, like /listen builds from Discord audio
const makeWav = (
  rate: number,
  channels: number,
  frames: number[][],
): Buffer => {
  const data = Buffer.alloc(frames.length * channels * 2);
  frames.forEach((frame, i) =>
    frame.forEach((sample, c) =>
      data.writeInt16LE(sample, (i * channels + c) * 2),
    ),
  );
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
};

describe("toMono16k", () => {
  it("downmixes 48kHz stereo to 16kHz mono, averaging samples", () => {
    // 6 stereo frames -> 2 mono samples (3 frames each, both channels averaged)
    const wav = makeWav(48000, 2, [
      [100, 300],
      [100, 300],
      [100, 300],
      [-200, -400],
      [-200, -400],
      [-200, -400],
    ]);
    const out = toMono16k(wav);

    expect(out.readUInt16LE(22)).toBe(1); // mono
    expect(out.readUInt32LE(24)).toBe(16000);
    expect(out.readUInt32LE(40)).toBe(4); // 2 samples * 2 bytes
    expect(out.readInt16LE(44)).toBe(200);
    expect(out.readInt16LE(46)).toBe(-300);
  });

  it("passes through audio it can't convert cleanly", () => {
    const wav = makeWav(22050, 1, [[1], [2], [3]]);
    expect(toMono16k(wav)).toBe(wav);
    const notWav = Buffer.from("not a wav file at all, just some bytes....");
    expect(toMono16k(notWav)).toBe(notWav);
  });
});

describe("speechLevelDb", () => {
  const pcmOf = (samples: number[]) => {
    const pcm = Buffer.alloc(samples.length * 2);
    samples.forEach((s, i) => pcm.writeInt16LE(s, i * 2));
    return pcm;
  };

  it("measures full scale as ~0 dBFS and silence as -Infinity", () => {
    expect(speechLevelDb(pcmOf([32767, -32768]))).toBeCloseTo(0, 1);
    expect(speechLevelDb(pcmOf([0, 0, 0]))).toBe(-Infinity);
    expect(speechLevelDb(Buffer.alloc(0))).toBe(-Infinity);
  });

  it("puts speech above the gate and faint hiss below it", () => {
    // ~-20 dBFS (3277 = 10% of full scale) vs ~-60 dBFS
    expect(speechLevelDb(pcmOf([3277, -3277]))).toBeCloseTo(-20, 0);
    expect(speechLevelDb(pcmOf([3277, -3277]))).toBeGreaterThan(
      MIN_SPEECH_LEVEL_DB,
    );
    expect(speechLevelDb(pcmOf([33, -33]))).toBeLessThan(MIN_SPEECH_LEVEL_DB);
  });
});

describe("WAKE_WORD", () => {
  it.each([
    "Hey Zenbot, roll a d20",
    "zen bot what's up",
    "Hey ZennBot",
    "Zen-bot?",
    "Xenbot, hi",
    "Zenyatta?",
    // Real mishearings from a /listen session
    "Tim Bolts, can you rename Maki?",
    "Then Bolt",
    "tim-bolt quota",
    "Zen bolts, please leave.",
    "Sim bot, roll a dice",
  ])("wakes on: %s", (text) => {
    expect(WAKE_WORD.test(text)).toBe(true);
  });

  it.each([
    "zenith of my career",
    "frozen pizza",
    "Kitzen bot",
    "them both are wrong",
    "time boxes",
    "Tim, both of you",
    "the bolts are loose",
  ])(
    "ignores: %s",
    (text) => {
      expect(WAKE_WORD.test(text)).toBe(false);
    },
  );
});
