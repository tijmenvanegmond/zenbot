import { VoiceChannel } from "discord.js";
import { AudioResource } from "@discordjs/voice";

/**
 * Voice request parameters
 */
export interface VoiceRequest {
  text: string;
  profile?: string; // Voice profile (e.g., 'zenbot-sardonic', 'en+m2:pitch=55')
  voiceChannel?: VoiceChannel; // Channel to play in (optional - if not provided, just creates audio)
  activityType?: string; // Activity type for session management
  interruptExisting?: boolean; // Whether to interrupt current audio
}

/**
 * Voice operation result
 */
export interface VoiceResult {
  success: boolean;
  audioResource?: AudioResource;
  config?: VoiceConfig;
  duration: number;
  provider?: string;
  error?: string;
}

/**
 * Voice configuration for a profile
 */
export interface VoiceConfig {
  provider: "system" | "espeak" | "piper";

  // System TTS settings (Windows/macOS)
  system?: {
    voice: string;
    speed: number;
  };

  // eSpeak-NG settings
  espeak?: {
    variant: string; // e.g., 'en+m2'
    pitch: number; // 0-99
    amplitude: number; // 0-200
    speed: number; // WPM
    wordGap: number; // ms between words
    capitalEmphasis: number; // 0-40
    punctuation: boolean;
    ssml: boolean;
  };

  // Piper TTS settings
  piper?: {
    voice: string; // e.g., 'en_US-lessac-medium', 'en_GB-alan-medium'
    speed: number; // 0.5 - 2.0 (multiplier)
    speaker?: number; // Optional speaker ID for multi-speaker models
  };

}

/**
 * Voice provider interface
 */
export interface VoiceProvider {
  name: string;
  isAvailable(): boolean;
  createAudio(text: string, config: VoiceConfig): Promise<AudioResource>;
  test?(text: string): Promise<{ success: boolean; audioSize: number }>;
}

/**
 * Audio playback options
 */
export interface PlaybackOptions {
  activityType: string;
  interruptExisting: boolean;
}

/**
 * Provider status information
 */
export interface ProviderStatus {
  name: string;
  available: boolean;
  platform?: string;
  features: string[];
  error?: string;
}
