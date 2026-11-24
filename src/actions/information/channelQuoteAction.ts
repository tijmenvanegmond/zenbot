import {
  ZenAction,
  ActionContext,
  ActionParameters,
  ActionResult,
} from "../actionTypes";
import { TextChannel } from "discord.js";
import { getRandomQuote } from "../../services/quoteService";
import { ZenbotService } from "../../services/zenbotService";
import { UnifiedVoiceService } from "../../services/voice/UnifiedVoiceService";
import { formatQuoteForDisplay } from "../../utils/quoteFormat";
import { CHANNEL_TYPES, QUOTE_CHANNEL_NAMES } from "../../config";
import { logger } from "../../utils/logger";

// Same voice the AI picked for quotes before (omnic robot, lighter tone)
const QUOTE_VOICE_PROFILE = "piper-omnic-playful";

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
          description: "Filter quotes from or about a specific username",
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
        // Find default quotes channel
        const guild = context.interaction.guild!;
        for (const name of QUOTE_CHANNEL_NAMES) {
          const foundChannel = guild.channels.cache.find(
            (channel) =>
              channel.name.toLowerCase().includes(name.toLowerCase()) &&
              channel.type === CHANNEL_TYPES.GUILD_TEXT,
          );
          if (foundChannel) {
            quoteChannel = foundChannel as TextChannel;
            break;
          }
        }

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
      const randomQuote = await getRandomQuote(quoteChannel, {
        userId: user_id,
        username: username,
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
