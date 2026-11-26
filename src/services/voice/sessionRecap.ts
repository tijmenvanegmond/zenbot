import { ZenbotService } from "../zenbotService";
import { SERVER, ZENBOT, addMemory } from "../memories";
import { takeSessionHistory } from "./voiceRoomLog";
import { logger } from "../../utils/logger";

/**
 * When Zenbot leaves a voice session it was listening to, it may write one
 * diary note about it ("Nem lost three dice rolls and blamed the dice") - but
 * only if something noteworthy happened. One Gemini request per session, and
 * only when people actually talked.
 */

/** Fewer human lines than this isn't a session worth reviewing */
const MIN_HUMAN_LINES = 6;

export const recapVoiceSession = async (guildId: string): Promise<void> => {
  const lines = takeSessionHistory(guildId);
  const humanLines = lines.filter((line) => line.speakerId !== ZENBOT).length;
  if (humanLines < MIN_HUMAN_LINES) return;

  const zenbot = ZenbotService.getInstance();
  if (!zenbot.isAIEnabled()) return;

  const transcript = lines
    .map((line) => `${line.speaker}: ${line.text}`)
    .join("\n");
  try {
    const note = await zenbot.writeSessionNote(transcript);
    if (!note) {
      logger.info(
        `🧠 Voice session (${lines.length} lines): nothing noteworthy`,
      );
      return;
    }
    await addMemory(guildId, {
      about: SERVER,
      text: note,
      by: "Zenbot",
      byId: ZENBOT,
      overheard: true,
    });
    logger.info(`🧠 Voice session diary: "${note}"`);
  } catch (error) {
    logger.warn("🧠 Voice session recap failed:", error);
  }
};
