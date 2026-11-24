import { GoogleGenerativeAI } from "@google/generative-ai";
import { FAST_GEMINI_MODEL } from "./ai/providers/geminiProvider";
import { OpenAIService } from "./openaiService";
import { logger } from "../utils/logger";

/**
 * Speech-to-text for /listen. Gemini (free tier, the key Zenbot already uses)
 * first; OpenAI Whisper only if there is no Gemini key.
 */

const NO_SPEECH = "[no speech]";
const TARGET_RATE = 16000;

const TRANSCRIBE_PROMPT = `Transcribe the speech in this audio exactly, in the language spoken. The people are talking to a bot named Zenbot - spell it "Zenbot". Reply with only the transcript - no quotes, labels or commentary. If there is no intelligible speech, reply with exactly: ${NO_SPEECH}`;

let gemini: GoogleGenerativeAI | null = null;

export const transcribeSpeech = async (wav: Buffer): Promise<string> => {
  const googleKey = process.env.GOOGLE_AI_API_KEY;
  if (googleKey) {
    gemini ??= new GoogleGenerativeAI(googleKey);
    const model = gemini.getGenerativeModel({ model: FAST_GEMINI_MODEL });
    const audio = toMono16k(wav);

    const result = await model.generateContent([
      {
        inlineData: { mimeType: "audio/wav", data: audio.toString("base64") },
      },
      { text: TRANSCRIBE_PROMPT },
    ]);
    const text = result.response.text().trim();
    logger.debug(
      `🎤 Gemini transcription (${wav.length} -> ${audio.length} bytes): "${text}"`,
    );
    return text === NO_SPEECH || text.includes(NO_SPEECH) ? "" : text;
  }

  if (process.env.OPENAI_API_KEY) {
    return OpenAIService.transcribeAudioBuffer(wav);
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
