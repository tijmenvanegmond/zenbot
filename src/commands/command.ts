import {
  CommandInteraction,
  ChatInputApplicationCommandData,
  Client,
} from "discord.js";
import { Zenbot } from "src/domain/session/Zenbot";

export interface Command {
  data: {
    name: string;
    description: string;
    options: any;
  };
  execute: (client: Client, zenbot: Zenbot, interaction: CommandInteraction) => void;
}
