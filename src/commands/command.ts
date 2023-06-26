import { CommandInteraction, ChatInputApplicationCommandData, Client } from "discord.js";

export interface Command {
    data: {
        name: string,
        description: string,
        options: any
    },
    execute: (client: Client, interaction: CommandInteraction) => void;
} 