import {
  ZenAction,
  ActionContext,
  ActionParameters,
  ActionResult,
} from "../actionTypes";
import { logger } from "../../utils/logger";

/**
 * "Zenbot, leave" from chat or /listen. The action only marks the guild:
 * the chat path speaks the goodbye first and then leaves (leaving here would
 * have the goodbye re-join the channel to be spoken).
 */
const pendingLeaves = new Set<string>();

/** Returns and clears whether the AI asked to leave this guild's voice */
export const takePendingLeave = (guildId: string): boolean =>
  pendingLeaves.delete(guildId);

export class LeaveVoiceAction implements ZenAction {
  name = "leave_voice";
  description = "Leave the voice channel after this reply";
  category = "voice" as const;

  permissions = {
    allowedSources: ["ai"],
  };

  schema = {
    name: "leave_voice",
    description:
      "Leave the voice channel (and stop listening) right after your reply. Use it when someone tells you to leave, go away, disconnect or stop listening. Say goodbye in your reply.",
    parameters: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  };

  async execute(
    context: ActionContext,
    _parameters: ActionParameters,
  ): Promise<ActionResult> {
    const guildId = context.guild?.id;
    const inVoice = !!context.interaction?.guild?.members.me?.voice.channelId;
    if (!guildId || !inVoice) {
      return {
        success: false,
        error: "Not in a voice channel - nothing to leave",
        shouldRespond: true,
        responseText: "I'm not in a voice channel.",
      };
    }

    pendingLeaves.add(guildId);
    logger.info(`👋 ${context.user.username} asked Zenbot to leave voice`);
    return {
      success: true,
      message: "Leaving after this reply",
      shouldRespond: true,
      responseText: "Leaving the voice channel right after this reply",
    };
  }
}
