import {
  ZenAction,
  ActionContext,
  ActionParameters,
  ActionResult,
} from "../actionTypes";
import { findMemberByName, preferredName } from "../../services/people";
import {
  SERVER,
  ZENBOT,
  addMemory,
  forgetMemories,
} from "../../services/memories";
import { logger } from "../../utils/logger";

/**
 * "Zenbot, remember Osha hates pineapple pizza" / "forget that". Zenbot also
 * calls remember on its own when it hears something memorable (overheard).
 * The notes show up in later chats - see describeMemories.
 */

interface Subject {
  /** User ID, SERVER or ZENBOT */
  about: string;
  /** How to refer to them in the reply */
  label: string;
}

const resolveSubject = async (
  context: ActionContext,
  who: string,
): Promise<Subject | null> => {
  const guild = context.interaction?.guild;
  if (!guild) return null;
  const target = who.trim();

  if (/^(server|everyone|us|we|the group|this server)$/i.test(target)) {
    return { about: SERVER, label: "the server" };
  }
  if (/^(you|yourself|zenbot)$/i.test(target)) {
    return { about: ZENBOT, label: "me" };
  }
  const member = /^(me|myself|i)$/i.test(target)
    ? await guild.members.fetch(context.user.id).catch(() => null)
    : await findMemberByName(
        guild,
        target,
        context.voiceChannel?.members.values(),
      );
  if (!member) return null;
  if (member.id === guild.members.me?.id) return { about: ZENBOT, label: "me" };
  return { about: member.id, label: preferredName(member) };
};

const WHO = {
  type: "string" as const,
  description:
    'Who it\'s about: "me" (the person talking to you, default), their name, "server" for the group or an event, or "you" for yourself',
};

export class RememberAction implements ZenAction {
  name = "remember";
  description = "Remember a fact about someone, the server, or an event";
  category = "information" as const;

  permissions = {
    allowedSources: ["ai"],
  };

  schema = {
    name: "remember",
    description:
      'Save a short note to remember later: a fact about someone ("Osha hates pineapple pizza"), something that happened ("game night ended in a dice feud"), or about you. Use when asked ("remember that..."), or on your own, rarely, when something genuinely memorable is said - set overheard then. Not for small talk.',
    parameters: {
      type: "object" as const,
      properties: {
        note: {
          type: "string" as const,
          description:
            'The note, short and specific, max 200 characters (e.g. "hates pineapple pizza", "lost three dice rolls in a row and blamed the dice")',
        },
        about: WHO,
        overheard: {
          type: "boolean" as const,
          description:
            "true when you decided to note this yourself - nobody asked you to remember it",
        },
      },
      required: ["note"],
    },
  };

  async execute(
    context: ActionContext,
    parameters: ActionParameters,
  ): Promise<ActionResult> {
    const guildId = context.guild?.id;
    const note = String(parameters.note ?? "").trim();
    if (!guildId || !note) {
      return {
        success: false,
        error: "Need a server and a note - nothing saved",
        shouldRespond: true,
        responseText: "Remember what?",
      };
    }

    const subject = await resolveSubject(
      context,
      String(parameters.about ?? "me"),
    );
    if (!subject) {
      return {
        success: false,
        error: `Nobody called "${parameters.about}" found - nothing saved`,
        shouldRespond: true,
        responseText: `I don't know who "${parameters.about}" is.`,
      };
    }

    const overheard = parameters.overheard === true;
    const saved = await addMemory(guildId, {
      about: subject.about,
      text: note,
      by: context.user.displayName || context.user.username,
      byId: context.user.id,
      overheard,
    });
    if (!saved) {
      return {
        success: false,
        error: "Note is empty or over 200 characters - nothing saved",
        shouldRespond: true,
        responseText: "That's too long to remember. Shorter.",
      };
    }

    logger.info(
      `🧠 ${overheard ? "Overheard" : context.user.username}: noted about ${subject.label}: "${saved.text}"`,
    );
    return {
      success: true,
      message: "Note saved",
      data: { about: subject.label, note: saved.text },
      shouldRespond: true,
      responseText: `Noted about ${subject.label}: ${saved.text}`,
    };
  }
}

export class ForgetAction implements ZenAction {
  name = "forget";
  description = "Forget notes about someone or the server";
  category = "information" as const;

  permissions = {
    allowedSources: ["ai"],
  };

  schema = {
    name: "forget",
    description:
      "Delete notes you saved with remember, when asked to forget something. Anyone can wipe notes about themselves, the server or you; notes about someone else only by whoever taught them.",
    parameters: {
      type: "object" as const,
      properties: {
        about: WHO,
        note: {
          type: "string" as const,
          description:
            'A few words from the note to delete (e.g. "pizza"). Leave out to forget everything about them',
        },
      },
      required: [] as string[],
    },
  };

  async execute(
    context: ActionContext,
    parameters: ActionParameters,
  ): Promise<ActionResult> {
    const guildId = context.guild?.id;
    const subject = await resolveSubject(
      context,
      String(parameters.about ?? "me"),
    );
    if (!guildId || !subject) {
      return {
        success: false,
        error: `Nobody called "${parameters.about}" found - nothing forgotten`,
        shouldRespond: true,
        responseText: `I don't know who "${parameters.about}" is.`,
      };
    }

    const { removed, notAllowed } = await forgetMemories(
      guildId,
      subject.about,
      context.user.id,
      parameters.note ? String(parameters.note) : undefined,
    );
    const refused =
      notAllowed > 0
        ? ` ${notAllowed} note${notAllowed === 1 ? "" : "s"} kept: only ${subject.label} or whoever taught them can delete those.`
        : "";

    if (removed.length === 0) {
      return {
        success: false,
        error: `Nothing forgotten about ${subject.label}.${refused || " No matching notes."}`,
        shouldRespond: true,
        responseText: refused
          ? `Not yours to erase.${refused}`
          : `I had nothing like that about ${subject.label}.`,
      };
    }

    logger.info(
      `🧠 ${context.user.username}: forgot ${removed.length} note(s) about ${subject.label}`,
    );
    return {
      success: true,
      message: "Notes deleted",
      data: { about: subject.label, forgotten: removed.map((m) => m.text) },
      shouldRespond: true,
      responseText: `Forgot about ${subject.label}: ${removed.map((m) => m.text).join("; ")}.${refused}`,
    };
  }
}
