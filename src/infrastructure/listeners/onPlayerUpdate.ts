import { Client, Events } from "discord.js";
import { Zenbot } from "src/domain/session/Zenbot";

export default (client: Client, zenbot: Zenbot): void => {
  client.on(Events.PresenceUpdate, (oldPresence, newPresence) => {
    zenbot.handlePresenceUpdate(oldPresence, newPresence);
  });
};
