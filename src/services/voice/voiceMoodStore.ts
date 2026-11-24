/**
 * Mood the AI picked (via set_voice_mood) for the reply it is about to give.
 * The chat handler takes it when speaking that reply. Entries expire so a
 * stale mood never leaks into a later reply.
 */
export const VOICE_MOODS = ["calm", "wise", "playful", "intense"] as const;
export type VoiceMood = (typeof VOICE_MOODS)[number];

const TTL_MS = 2 * 60 * 1000;
const moods = new Map<string, { mood: VoiceMood; at: number }>();

export const setVoiceMood = (userId: string, mood: VoiceMood): void => {
  moods.set(userId, { mood, at: Date.now() });
};

/** Returns and clears the pending mood for this user, if any */
export const takeVoiceMood = (userId: string): VoiceMood | undefined => {
  const entry = moods.get(userId);
  moods.delete(userId);
  return entry && Date.now() - entry.at < TTL_MS ? entry.mood : undefined;
};
