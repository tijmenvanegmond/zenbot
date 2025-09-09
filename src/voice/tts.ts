import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "stream";
import { createAudioResource, StreamType } from "@discordjs/voice";
import { logger } from "../utils/logger";
import { ZenbotService } from "../services/zenbotService";
dotenv.config();

export async function turnTextIntoSpeechBuffer(
  input: string,
  output = "./output.opus",
) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.audio.speech.create({
    model: "tts-1",
    voice: "nova",
    input,
    response_format: "opus",
  });

  const buffer = Buffer.from(await response.arrayBuffer());

  const speechFile = path.resolve(output);
  await fs.promises.writeFile(speechFile, buffer as any);
}

export async function createTTSStream(input: string) {
  logger.info(`Creating TTS for text: "${input}"`);
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const response = await client.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "echo",
      input,
      instructions:
        "Speak as Zenyatta, the wise omnic monk. Be calm, serene, and philosophical. Use natural pauses and speak with tranquil wisdom.",
      response_format: "mp3",
    });

    // Convert the response to a Buffer and then to a proper Readable stream
    const buffer = Buffer.from(await response.arrayBuffer());
    logger.info(`TTS buffer size: ${buffer.length} bytes`);

    if (buffer.length === 0) {
      throw new Error("TTS response buffer is empty");
    }

    const stream = new Readable();
    stream.push(buffer);
    stream.push(null); // Signals the end of the stream

    // Create and return an audio resource
    const resource = createAudioResource(stream, {
      inputType: StreamType.Arbitrary,
    });

    logger.info(`Created audio resource successfully`);
    return resource;
  } catch (error) {
    logger.error("Error creating TTS stream:", error);
    throw error;
  }
}
