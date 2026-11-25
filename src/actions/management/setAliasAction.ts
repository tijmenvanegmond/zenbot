import { GuildMember } from "discord.js";
import {
  ZenAction,
  ActionContext,
  ActionParameters,
  ActionResult,
} from "../actionTypes";
import {
  addAlias,
  findMemberByName,
  namesFor,
  removeAlias,
} from "../../services/people";
import { logger } from "../../utils/logger";

/**
 * "Zenbot, call me Nem" / "Osha also goes by Oshy". Only Zenbot's memory -
 * the Discord nickname doesn't change (that's rename_user).
 */
export class SetAliasAction implements ZenAction {
  name = "set_alias";
  description = "Remember another name someone goes by";
  category = "utility" as const;

  permissions = {
    allowedSources: ["ai"],
  };

  schema = {
    name: "set_alias",
    description:
      'Remember a name someone goes by, for you to use and recognise ("call me Nem", "Osha also goes by Oshy"). The newest becomes the name you call them. Doesn\'t change their Discord nickname - that\'s rename_user.',
    parameters: {
      type: "object" as const,
      properties: {
        alias: {
          type: "string" as const,
          description: "The name they go by (max 32 characters)",
        },
        person: {
          type: "string" as const,
          description:
            'Who it\'s for: "me" (default) or their name. Only the person asking or someone in voice with them',
        },
        remove: {
          type: "boolean" as const,
          description: "Forget this name instead of adding it",
        },
      },
      required: ["alias"],
    },
  };

  async execute(
    context: ActionContext,
    parameters: ActionParameters,
  ): Promise<ActionResult> {
    const guild = context.interaction?.guild;
    const alias = String(parameters.alias ?? "").trim();
    const person = String(parameters.person ?? "me").trim();
    if (!guild || !alias) {
      return {
        success: false,
        error: "Need a server and a name - nothing saved",
        shouldRespond: true,
        responseText: "Which name?",
      };
    }

    const member: GuildMember | null = /^(me|myself|i)$/i.test(person)
      ? await guild.members.fetch(context.user.id).catch(() => null)
      : await findMemberByName(
          guild,
          person,
          context.voiceChannel?.members.values(),
        );
    if (!member) {
      return {
        success: false,
        error: `Nobody called "${person}" found - nothing saved`,
        shouldRespond: true,
        responseText: `I don't know who "${person}" is.`,
      };
    }

    const inTheirVoice =
      !!context.voiceChannel &&
      member.voice?.channelId === context.voiceChannel.id;
    if (member.id !== context.user.id && !inTheirVoice) {
      return {
        success: false,
        error: `${member.displayName} is not the requester or in voice with them - nothing saved`,
        shouldRespond: true,
        responseText: `Only ${member.displayName} or someone in voice with them can name them.`,
      };
    }

    if (parameters.remove) {
      const removed = await removeAlias(guild.id, member.id, alias);
      return removed
        ? {
            success: true,
            message: "Alias removed",
            shouldRespond: true,
            responseText: `Forgot that ${member.displayName} goes by ${alias}`,
          }
        : {
            success: false,
            error: `${member.displayName} has no saved name "${alias}"`,
            shouldRespond: true,
            responseText: `${member.displayName} doesn't go by ${alias}.`,
          };
    }

    if (!(await addAlias(guild.id, member.id, alias))) {
      return {
        success: false,
        error: "Name is empty or longer than 32 characters - nothing saved",
        shouldRespond: true,
        responseText: "That name doesn't work.",
      };
    }

    logger.info(
      `👥 ${context.user.username}: ${member.displayName} now goes by "${alias}"`,
    );
    return {
      success: true,
      message: "Alias saved",
      data: { names: namesFor(member) },
      shouldRespond: true,
      responseText: `${member.displayName} now goes by ${alias} (all names: ${namesFor(member).join(", ")})`,
    };
  }
}
