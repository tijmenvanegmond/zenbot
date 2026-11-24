import {
  ZenAction,
  ActionContext,
  ActionParameters,
  ActionResult,
} from "../actionTypes";
import {
  VOICE_MOODS,
  VoiceMood,
  setVoiceMood,
} from "../../services/voice/voiceMoodStore";
import { logger } from "../../utils/logger";

/**
 * Lets the AI choose how its next spoken reply sounds. Only applies to
 * replies the chat handler speaks (@Zenbot mentions).
 */
export class SetVoiceMoodAction implements ZenAction {
  name = "set_voice_mood";
  description = "Choose the voice mood for your next spoken reply";
  category = "voice" as const;

  permissions = {
    allowedSources: ["ai"],
  };

  schema = {
    name: "set_voice_mood",
    description:
      "Choose how your reply will sound when read aloud: calm (slow, soothing), wise (very slow, grave), playful (lighter, quicker) or intense (fast, urgent). Use it when a different delivery would make the reply land better. Call it at most once per reply.",
    parameters: {
      type: "object" as const,
      properties: {
        mood: {
          type: "string" as const,
          enum: [...VOICE_MOODS],
          description: "The delivery for your next reply",
        },
      },
      required: ["mood"],
    },
  };

  async execute(
    context: ActionContext,
    parameters: ActionParameters,
  ): Promise<ActionResult> {
    const mood = parameters.mood as VoiceMood;
    if (!VOICE_MOODS.includes(mood)) {
      return {
        success: false,
        error: `Unknown mood "${mood}". Use one of: ${VOICE_MOODS.join(", ")}`,
        shouldRespond: false,
      };
    }

    setVoiceMood(context.user.id, mood);
    logger.info(`🎭 Voice mood for ${context.user.username}'s reply: ${mood}`);
    return {
      success: true,
      message: `Voice mood set to ${mood}`,
      shouldRespond: false,
      responseText: `Your next reply will be spoken in a ${mood} voice.`,
    };
  }
}
