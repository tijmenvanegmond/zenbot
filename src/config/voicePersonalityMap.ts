/**
 * Voice Personality Mapping
 * Maps Zenbot personalities to their corresponding voice profiles
 */

export interface PersonalityVoiceMapping {
  [personality: string]: string;
}

/**
 * Default voice profile mappings for each Zenbot personality
 */
export const PERSONALITY_VOICE_MAP: PersonalityVoiceMapping = {
  // Default Zenbot (sardonic omnic monk)
  "zenbot-default": "piper-omnic", // john @ 0.9x with omnic robot effect
  zenbot: "piper-omnic",
  default: "piper-john", // john @ 1.0x - balanced clean voice

  // Conference personalities
  "zenbot-philosopher": "piper-calm", // lessac @ 0.85x - slow, contemplative female
  "zenbot-critic": "piper-sharp", // ryan @ 0.9x - crisp, analytical
  "zenbot-optimist": "piper-energetic", // ryan @ 1.2x - bright energetic
  "zenbot-pessimist": "piper-deep", // joe @ 0.7x - heavy, foreboding
  "zenbot-chaos": "piper-fast", // amy @ 1.3x - chaotic speed
  "zenbot-wise": "piper-default", // john @ 0.75x - deep wisdom

  // Fallback for unknown personalities
  unknown: "piper-default",
};

/**
 * Get voice profile for a given personality with optional mood modifier
 * Format: "personality:mood" (e.g., "zenbot-sardonic:calm")
 */
export function getVoiceForPersonality(personality?: string): string {
  if (!personality) {
    return PERSONALITY_VOICE_MAP.default;
  }

  // Normalize personality name
  const normalized = personality.toLowerCase().trim();

  // Check for mood modifier (personality:mood format)
  if (normalized.includes(":")) {
    const [basePerson, mood] = normalized.split(":");

    // Try exact match for personality:mood
    if (PERSONALITY_VOICE_MAP[normalized]) {
      return PERSONALITY_VOICE_MAP[normalized];
    }

    // Try base personality with mood suffix
    const moodProfile = `${PERSONALITY_VOICE_MAP[basePerson]}-${mood}`;
    // Check if that profile exists (we'll validate this exists in ProfileManager)
    return moodProfile;
  }

  // Direct lookup
  if (PERSONALITY_VOICE_MAP[normalized]) {
    return PERSONALITY_VOICE_MAP[normalized];
  }

  // Fuzzy match - check if personality contains a known key
  for (const [key, voice] of Object.entries(PERSONALITY_VOICE_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return voice;
    }
  }

  // Default fallback
  return PERSONALITY_VOICE_MAP.unknown;
}

/**
 * Get all available personalities with their voice mappings
 */
export function getAllPersonalityVoices(): PersonalityVoiceMapping {
  return { ...PERSONALITY_VOICE_MAP };
}
