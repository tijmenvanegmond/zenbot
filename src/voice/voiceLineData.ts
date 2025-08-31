import adviceList from "./zenVoiceLines.json";
import { createAudioResource, AudioResource, StreamType } from "@discordjs/voice";
import { createTTSStream } from "./tts";
import { logger } from "../utils/logger";
import { Readable } from "stream";
import https from "https";
import http from "http";
import fs from "fs";
import path from "path";

export interface VoiceLineData {
  text: string;
  voiceUri: string | null;
  length: number;
}

export interface VoiceLineCategories {
  heroSelected: VoiceLineData[];
  setupPhase: VoiceLineData[];
  orbOfHarmony: VoiceLineData[];
  orbOfDiscord: VoiceLineData[];
  transcendence: VoiceLineData[];
  elimination: VoiceLineData[];
  philosophical: VoiceLineData[];
  greetings: VoiceLineData[];
  interactions: {
    genji: VoiceLineData[];
    ramattra: VoiceLineData[];
    symmetra: VoiceLineData[];
  };
  special: VoiceLineData[];
}

// Legacy collection for backward compatibility
export const VoiceLineDataCollection: VoiceLineData[] = adviceList.legacy.data;

// New categorized voice lines
export const VoiceLineCategories: VoiceLineCategories = adviceList.categories;

// Helper function to get random voice line from a category
export function getRandomVoiceLineFromCategory(category: VoiceLineData[]): VoiceLineData {
  return category[Math.floor(Math.random() * category.length)];
}

// Helper function to get contextual advice
export function getContextualAdvice(context?: 'greeting' | 'philosophical' | 'harmony' | 'discord' | 'transcendence'): VoiceLineData {
  switch (context) {
    case 'greeting':
      return getRandomVoiceLineFromCategory(VoiceLineCategories.greetings);
    case 'philosophical':
      return getRandomVoiceLineFromCategory(VoiceLineCategories.philosophical);
    case 'harmony':
      return getRandomVoiceLineFromCategory(VoiceLineCategories.orbOfHarmony);
    case 'discord':
      return getRandomVoiceLineFromCategory(VoiceLineCategories.orbOfDiscord);
    case 'transcendence':
      return getRandomVoiceLineFromCategory(VoiceLineCategories.transcendence);
    default:
      // Default to philosophical wisdom for general advice
      return getRandomVoiceLineFromCategory(VoiceLineCategories.philosophical);
  }
}

// Helper function to create audio resource from voice line (with TTS fallback)
export async function createVoiceLineResource(voiceLine: VoiceLineData): Promise<AudioResource> {
  logger.info(`Processing voice line: "${voiceLine.text}", voiceUri: ${voiceLine.voiceUri ? 'available' : 'null'}`);
  
  // Try to use the actual voice line file if available
  if (voiceLine.voiceUri) {
    try {
      logger.info(`Attempting to play voice line from: ${voiceLine.voiceUri}`);
      
      // Fetch the audio file from the URL using https module
      const audioBuffer = await new Promise<Buffer>((resolve, reject) => {
        const client = voiceLine.voiceUri!.startsWith('https:') ? https : http;
        const request = client.get(voiceLine.voiceUri!, (response) => {
          if (response.statusCode === 200) {
            const chunks: Buffer[] = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
          } else {
            reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          }
        });
        request.on('error', reject);
        request.setTimeout(10000, () => {
          request.destroy();
          reject(new Error('Request timeout'));
        });
      });
      
      // Create a readable stream from the buffer
      const audioStream = new Readable({
        read() {
          this.push(audioBuffer);
          this.push(null); // End the stream
        }
      });
      
      const resource = createAudioResource(audioStream, {
        inputType: StreamType.Arbitrary,
      });
      logger.info(`Successfully created audio resource from voice line file`);
      return resource;
    } catch (error) {
      logger.warn(`Error fetching voice line file: ${error}, falling back to TTS`);
    }
  }
  
  // Fallback to TTS if no voiceUri or if file fetch failed
  logger.info(`Using TTS fallback for voice line: "${voiceLine.text}"`);
  return await createTTSStream(voiceLine.text);
}
