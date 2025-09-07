import {
  Channel,
  Client,
  Events,
  GuildMember,
  VoiceBasedChannel,
  VoiceChannel,
  VoiceState,
} from "discord.js";
import { logger } from "../utils/logger";
import { EXCLUDED_VOICE_CHANNELS } from "../config";
import { ActionService } from "../services/actionService";
import { ActionContext } from "../actions/actionTypes";

export default (client: Client): void => {
  client.on(
    Events.VoiceStateUpdate,
    (oldState: VoiceState, newState: VoiceState) => {
      const member = newState.member;
      const botUser = member?.user.bot;
      let channel: Channel | null = null;

      if (oldState.channelId === newState.channelId) {
        return; //ignore if no change (it happens)
      }

      logger.info(
        `User ${member?.displayName} moved from ${oldState.channel?.name} to ${newState.channel?.name}`,
      );

      channel = newState.channel ?? oldState.channel;

      if (!channel) {
        logger.debug(`Ignoring channel change: channel not found`);
        return;
      }

      if (botUser) {
        logger.debug(
          `Ignoring channel change: user ${member?.displayName} is a bot`,
        );
        return;
      }

      if (
        (EXCLUDED_VOICE_CHANNELS as readonly string[]).includes(channel.id!)
      ) {
        logger.debug(`Ignoring channel ${channel.id} - excluded channel`);
        return;
      }

      updateChannel(channel, newState.member!);
    },
  );
};

async function updateChannel(channel: VoiceBasedChannel, member: GuildMember) {
  try {
    logger.info(
      `🏷️ Auto-renaming channel ${channel.id} after voice state change`,
    );

    // Create action context for the channel management action
    // We need to create a mock interaction-like object to provide guild access
    const mockContext: ActionContext = {
      guild: {
        id: channel.guild.id,
        name: channel.guild.name,
      },
      user: {
        id: member.user.id,
        username: member.user.username,
      },
      voiceChannel: channel.type === 2 ? (channel as VoiceChannel) : undefined,
      isVoiceInteraction: true,
      source: "voice",
      // Provide access to the full guild through a mock interaction
      interaction: {
        guild: channel.guild,
        user: member.user,
      } as any,
    };

    // Use the Channel Management Action to rename the channel
    const actionService = ActionService.getInstance();
    const result = await actionService
      .getRegistry()
      .execute("channel_management", mockContext, {
        action: "rename",
        channel_id: channel.id,
        name_style: "creative", // Use creative style for auto-renaming
        force_update: false,
      });

    if (result.success) {
      logger.info(
        `🏷️ Channel auto-renamed successfully: ${result.data?.new_name}`,
      );
    } else {
      logger.warn(`🏷️ Channel auto-rename failed: ${result.error}`);
    }
  } catch (error) {
    logger.error(`🏷️ Failed to auto-rename channel via action`, error);
  }
}
