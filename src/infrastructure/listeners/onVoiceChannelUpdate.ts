import {
  Channel,
  Client,
  Events,
  GuildMember,
  VoiceBasedChannel,
  VoiceState,
} from "discord.js";
import { logger } from "../../utils/logger";
import { EXCLUDED_VOICE_CHANNELS } from "../../config";
import { Zenbot } from "src/domain/session/Zenbot";

export default (client: Client, zenbot: Zenbot): void => {
  client.on(
    Events.VoiceStateUpdate,
    (oldState: VoiceState, newState: VoiceState) => {
      
      const member = newState.member;
      const botUser = member?.user.bot;
      let channel: Channel | null = null;

      if (oldState.channelId === newState.channelId) {
        return; //ignore if no change (it happens)
      }

      logger.info(`User ${member?.displayName} moved from ${oldState.channel?.name} to ${newState.channel?.name}`);

      channel = newState.channel ?? oldState.channel;

      if (!channel) {
        logger.debug(`Ignoring channel change: channel not found`);
        return;
      }

      if (botUser) {
        logger.debug(`Ignoring channel change: user ${member?.displayName} is a bot`);
        return;
      }

      if ((EXCLUDED_VOICE_CHANNELS as readonly string[]).includes(channel.id!)) {
        logger.debug(`Ignoring channel ${channel.id} - excluded channel`);
        return;
      }

      const name = zenbot.generateChannelName(channel as VoiceBasedChannel);
      updateChannel(channel, name);
    },
  );
};

async function updateChannel(
  channel: VoiceBasedChannel,
  name: string,
) {

  if (channel.name == name) {
    logger.debug("Channel name unchanged");
    return;
  }

  try {
    logger.info(`Updating channel ${channel.id} name to "${name}"`);
    await channel.setName(name);
  } catch (error) {
    logger.error(`Failed to update channel name`, error);
  }
}


