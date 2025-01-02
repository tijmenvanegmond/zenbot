import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
dotenv.config();

export async function turnTextIntoSpeechBuffer(
  input: string,
  output = "./output.opus"
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
