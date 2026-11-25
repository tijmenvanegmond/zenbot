import {
  ZenAction,
  ActionContext,
  ActionParameters,
  ActionResult,
} from "../actionTypes";
import { TextChannel } from "discord.js";
import {
  findQuoteChannel,
  getRandomQuote,
} from "../../services/quoteService";
import { ZenbotService } from "../../services/zenbotService";
import { UnifiedVoiceService } from "../../services/voice/UnifiedVoiceService";
import { formatQuoteForDisplay } from "../../utils/quoteFormat";
import { CHANNEL_TYPES } from "../../config";
import { findMemberByName, namesFor } from "../../services/people";
import { logger } from "../../utils/logger";

// Zenbot's default voice
const QUOTE_VOICE_PROFILE = "piper-zen";

export class ChannelQuoteAction implements ZenAction {
  name = "read_channel_quote";
  description =
    "Read a random quote from a Discord channel with intelligent parsing";
  category = "information" as const;

  permissions = {
    allowedSources: ["command", "api", "ai"],
  };

  schema = {
    name: "read_channel_quote",
    description:
      "Read a random quote from a specified Discord channel with enhanced parsing",
    parameters: {
      type: "object" as const,
      properties: {
        channel_id: {
          type: "string" as const,
          description:
            "The ID of the text channel to read quotes from (optional, will find default quotes channel if not provided)",
        },
        user_id: {
          type: "string" as const,
          description: "Filter quotes from or about a specific user ID",
        },
        username: {
          type: "string" as const,
          description:
            "Filter quotes from or about someone, by any name they go by",
        },
        use_voice: {
          type: "boolean" as const,
          description:
            "Whether to play the quote as TTS if user is in voice channel",
        },
      },
      required: [],
    },
  };

  async execute(
    context: ActionContext,
    parameters: ActionParameters,
  ): Promise<ActionResult> {
    try {
      const { channel_id, user_id, username, use_voice = true } = parameters;

      if (!context.guild || !context.interaction) {
        return {
          success: false,
          error: "This action requires a guild and interaction context",
          shouldRespond: true,
          responseText: "This command must be used within a server.",
        };
      }

      let quoteChannel: TextChannel | undefined;

      // Get the channel to read quotes from
      if (channel_id) {
        const channel =
          context.interaction.guild!.channels.cache.get(channel_id);
        if (!channel || channel.type !== CHANNEL_TYPES.GUILD_TEXT) {
          return {
            success: false,
            error: `Invalid text channel: ${channel_id}`,
            shouldRespond: true,
            responseText: "Please provide a valid text channel.",
          };
        }
        quoteChannel = channel as TextChannel;
      } else {
        quoteChannel = findQuoteChannel(context.interaction.guild!);

        if (!quoteChannel) {
          return {
            success: false,
            error: "No quotes channel found",
            shouldRespond: true,
            responseText:
              'No quotes channel found. Please specify a channel or create a channel with "quotes" in the name.',
          };
        }
      }

      // Get random quote with filtering
      // Quotes name people however they were known at the time ("osha",
      // "Oshy"): match every name the person goes by
      const guild = context.interaction.guild!;
      const person = user_id
        ? await guild.members.fetch(user_id).catch(() => null)
        : username
          ? await findMemberByName(
              guild,
              username,
              context.voiceChannel?.members.values(),
            )
          : null;
      const randomQuote = await getRandomQuote(quoteChannel, {
        userId: user_id ?? person?.id,
        username: username,
        names: person ? namesFor(person) : [],
      });

      if (!randomQuote) {
        const userFilter =
          username || user_id ? ` from or about ${username || user_id}` : "";
        return {
          success: false,
          error: `No quotes found${userFilter}`,
          shouldRespond: true,
          responseText: `No quotes found${userFilter} in #${quoteChannel.name}.`,
        };
      }

      // Intro + formatted quote, ready for TTS
      const enhancedText =
        await ZenbotService.getInstance().createEnhancedQuote(
          context.interaction,
          randomQuote,
        );

      const responseContent = formatQuoteForDisplay(
        randomQuote,
        quoteChannel.name,
      );

      // Speak it ourselves for commands/API. When the AI calls this as a
      // function, it gets enhancedText back and decides what to say.
      let spoken = false;
      if (use_voice && context.source !== "ai" && context.voiceChannel) {
        await UnifiedVoiceService.getInstance().speak({
          text: enhancedText,
          profile: QUOTE_VOICE_PROFILE,
          voiceChannel: context.voiceChannel,
          activityType: "quote-tts",
        });
        spoken = true;
      }

      logger.info(
        `🎭 Channel quote action: "${enhancedText.substring(0, 120)}" from #${quoteChannel.name}${spoken ? " (spoken)" : ""}`,
      );

      return {
        success: true,
        message: `Quote retrieved from #${quoteChannel.name}`,
        data: {
          quote: randomQuote,
          channel: quoteChannel.name,
          enhancedText,
          responseContent,
        },
        shouldRespond: true,
        responseText: responseContent,
        useVoice: false, // already spoken above (or left to the AI)
      };
    } catch (error) {
      logger.error("🎭 Channel quote action failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        shouldRespond: true,
        responseText: "An error occurred while trying to retrieve the quote.",
      };
    }
  }

  validate(parameters: ActionParameters): boolean {
    // Basic validation - channel_id should be a string if provided
    return !parameters.channel_id || typeof parameters.channel_id === "string";
  }
}
