import { GoogleGenerativeAI } from "@google/generative-ai";
import { FAST_GEMINI_MODEL } from "./ai/providers/geminiProvider";
import { OpenAIService } from "./openaiService";
import { logger } from "../utils/logger";
import { fixKnownMishearings } from "./voice/vocabulary";

/**
 * Speech-to-text for /listen. Gemini (free tier, the key Zenbot already uses)
 * first; OpenAI Whisper only if there is no Gemini key.
 */

const NO_SPEECH = "[no speech]";
const TARGET_RATE = 16000;

// No hint about the bot's name. With one, the model writes "Zenbot" for
// breaths and clicks (tested: 0.6s of noise at -42 dBFS -> "Zenbot"), even
// when told to only write it when said. Without it the name comes out
// misheard ("Tim Bolts", "Then Bolt") - WAKE_WORD matches those instead.
const TRANSCRIBE_PROMPT = `Transcribe the speech in this audio exactly, in the language spoken. Only write words that are clearly spoken - never guess. Reply with only the transcript - no quotes, labels or commentary. If there is no clear speech (silence, breathing, noise, a cough, a click), reply with exactly: ${NO_SPEECH}`;

const hintLine = (hints: string[]): string => {
  const unique = [...new Set(hints.map((h) => h.trim()).filter(Boolean))];
  return unique.length > 0
    ? `
Names that may come up - if one is clearly said, spell it like this: ${unique.join(", ")}.`
    : "";
};

/** Below this RMS level (dBFS) an utterance is breath or background, not speech */
export const MIN_SPEECH_LEVEL_DB = -50;

/**
 * Loudness of 16-bit PCM (any channel layout) in dBFS: 0 is full scale,
 * normal speech in Discord sits around -30 to -15, silence below -60.
 */
export const speechLevelDb = (pcm: Buffer): number => {
  const samples = Math.floor(pcm.length / 2);
  if (samples === 0) return -Infinity;
  let sumSquares = 0;
  for (let i = 0; i < samples; i++) {
    const s = pcm.readInt16LE(i * 2) / 32768;
    sumSquares += s * s;
  }
  const rms = Math.sqrt(sumSquares / samples);
  return rms === 0 ? -Infinity : 20 * Math.log10(rms);
};

let gemini: GoogleGenerativeAI | null = null;

/**
 * `hints`: names and words to spell correctly if they're said (see
 * vocabulary.ts - never the wake word). Known mishearings are fixed after.
 */
export const transcribeSpeech = async (
  wav: Buffer,
  hints: string[] = [],
): Promise<string> => {
  const googleKey = process.env.GOOGLE_AI_API_KEY;
  if (googleKey) {
    gemini ??= new GoogleGenerativeAI(googleKey);
    const model = gemini.getGenerativeModel({ model: FAST_GEMINI_MODEL });
    const audio = toMono16k(wav);

    const result = await model.generateContent([
      {
        inlineData: { mimeType: "audio/wav", data: audio.toString("base64") },
      },
      { text: TRANSCRIBE_PROMPT + hintLine(hints) },
    ]);
    const text = result.response.text().trim();
    logger.debug(
      `🎤 Gemini transcription (${wav.length} -> ${audio.length} bytes): "${text}"`,
    );
    return text === NO_SPEECH || text.includes(NO_SPEECH)
      ? ""
      : fixKnownMishearings(text);
  }

  if (process.env.OPENAI_API_KEY) {
    return fixKnownMishearings(await OpenAIService.transcribeAudioBuffer(wav));
  }

  throw new Error(
    "No speech-to-text available: set GOOGLE_AI_API_KEY (or OPENAI_API_KEY)",
  );
};

/**
 * Discord audio arrives as 48kHz stereo 16-bit PCM. Speech needs far less:
 * mono 16kHz is 6x smaller, so uploads are faster and cheaper. Handles plain
 * 44-byte-header PCM WAVs (what /listen produces); anything else passes
 * through untouched.
 */
export const toMono16k = (wav: Buffer): Buffer => {
  if (wav.length < 44 || wav.toString("ascii", 0, 4) !== "RIFF") return wav;
  const channels = wav.readUInt16LE(22);
  const rate = wav.readUInt32LE(24);
  const bits = wav.readUInt16LE(34);
  if (bits !== 16 || rate % TARGET_RATE !== 0) return wav;

  const step = rate / TARGET_RATE;
  const frameBytes = channels * 2;
  const frames = Math.floor((wav.length - 44) / frameBytes);
  const outFrames = Math.floor(frames / step);
  const pcm = Buffer.alloc(outFrames * 2);

  for (let i = 0; i < outFrames; i++) {
    // Average the `step` frames (and channels) this sample covers
    let sum = 0;
    for (let s = 0; s < step; s++) {
      const frame = 44 + (i * step + s) * frameBytes;
      for (let c = 0; c < channels; c++) {
        sum += wav.readInt16LE(frame + c * 2);
      }
    }
    pcm.writeInt16LE(Math.round(sum / (step * channels)), i * 2);
  }

  return Buffer.concat([wavHeader(pcm.length, TARGET_RATE), pcm]);
};

const wavHeader = (dataSize: number, rate: number): Buffer => {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36, "ascii");
  header.writeUInt32LE(dataSize, 40);
  return header;
};
