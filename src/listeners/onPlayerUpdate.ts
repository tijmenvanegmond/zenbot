import {
  Client,
  Events,
} from "discord.js";


export default (client: Client): void => {
  client.on(Events.PresenceUpdate, (oldPresence, newPresence) => {
    `user ${newPresence.member?.displayName} updated their presence from ${oldPresence?.status} to ${newPresence.status}`
  });
};
