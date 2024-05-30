import { Client, CommandInteraction, CommandInteractionOptionResolver, GuildMember, SlashCommandBuilder } from "discord.js";
import { Command } from "./command";

export const Rename: Command = {

    data: new SlashCommandBuilder()
        .setName("rename")
        .setDescription("Allows you to change the name of someone")
        .addMentionableOption((option =>
            option.setName('user_to_rename')
                .setDescription('The user which name to change'))
        )
        .addStringOption(option =>
            option.setName('new_nickname')
                .setDescription('The new name for said user')),

    execute: async (client: Client, interaction: CommandInteraction) => {
        let options = interaction.options as CommandInteractionOptionResolver
        let member = options.getMember('user_to_rename') as GuildMember;
        const newNickname = options.getString('new_nickname');
        const oldNickname = member.nickname;


        console.log(`Changing user:${oldNickname}'s nickname to:"${newNickname}"`);

        try {
            await member.setNickname(newNickname);
            await interaction.followUp({
                ephemeral: true,
                content: `Changed user:${oldNickname}'s nickname to:"${newNickname}"`
            });
        } catch (error) {
            let message = `Failed to change user:${member.nickname}'s nickname to:"${newNickname}"!`
            console.error(message);
            console.error(error);
            
            await interaction.followUp({
                ephemeral: true,
                content: message
            });
        }
    }
}; 