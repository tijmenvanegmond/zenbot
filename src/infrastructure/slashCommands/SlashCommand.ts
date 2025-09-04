import {
  CommandInteraction,
  ChatInputApplicationCommandData,
  Client,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
} from "discord.js";
import { ZenbotOrchestrator } from "../../application/ZenbotOrchestrator";

export abstract class SlashCommand {
  protected data: {
    name: string;
    description: string;
    options: any;
  } = { name: "", description: "", options: [] };
  
  constructor(protected client: Client, protected orchestrator: ZenbotOrchestrator) {}
  
  abstract execute(interaction: CommandInteraction): Promise<void>;
}
