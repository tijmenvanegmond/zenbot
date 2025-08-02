import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "stream";
import { createAudioResource, StreamType } from "@discordjs/voice";
dotenv.config();

const instructions = `You sound like Daftpunk. You are a funny R-O-B-O-T`;
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
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice: "nova",
    instructions,
    input,
    response_format: "opus",
  });

  // Convert the response to a Buffer and then to a proper Readable stream
  const buffer = Buffer.from(await response.arrayBuffer());
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null); // Signals the end of the stream

  // Create and return an audio resource
  return createAudioResource(stream, {
    inputType: StreamType.Opus,
  });
}
