import {
  ZenAction,
  ActionContext,
  ActionParameters,
  ActionResult,
} from "../actionTypes";
import { logger } from "../../utils/logger";
import {
  VoiceChannel,
  VoiceBasedChannel,
  PermissionFlagsBits,
} from "discord.js";

/**
 * Channel Management Action - handles voice channel operations like renaming, creating, and management
 * Extracts channel naming logic into a reusable action
 */
export class ChannelManagementAction implements ZenAction {
  name = "channel_management";
  description = "Manage voice channels with creative naming and operations";
  category = "utility" as const;
  aiEnabled = true;

  permissions = {
    requiresVoiceChannel: false,
    allowedSources: ["command", "voice", "api", "ai"],
  };

  schema = {
    name: "channel_management",
    description: "Manage voice channels with zen-inspired creativity",
    parameters: {
      type: "object" as const,
      properties: {
        action: {
          type: "string" as const,
          description: "The channel management action to perform",
          enum: ["rename", "create", "analyze", "suggest_name"],
        },
        channel_id: {
          type: "string" as const,
          description: "Target channel ID (required for rename/analyze)",
        },
        name_style: {
          type: "string" as const,
          description: "Style of name generation",
          enum: ["creative", "descriptive", "zen", "playful", "epic"],
        },
        custom_name: {
          type: "string" as const,
          description: "Custom name to set (overrides generated name)",
        },
        force_update: {
          type: "boolean" as const,
          description: "Force update even if channel was recently renamed",
        },
      },
      required: ["action"],
    },
  };

  async execute(
    context: ActionContext,
    parameters: ActionParameters,
  ): Promise<ActionResult> {
    try {
      const {
        action,
        channel_id,
        name_style = "creative",
        custom_name,
        force_update = false,
      } = parameters;

      logger.info(
        `🏷️ Channel Management Action: ${action} (style: ${name_style})`,
      );

      switch (action) {
        case "rename": {
          if (!channel_id) {
            return {
              success: false,
              error: "Channel ID required for rename action",
              shouldRespond: true,
              responseText: "I need to know which channel to rename",
            };
          }

          if (!context.interaction?.guild) {
            return {
              success: false,
              error: "Guild context required for channel management",
              shouldRespond: true,
              responseText: "I can only manage channels within a server",
            };
          }
          // Attempt to resolve channel first by ID; if that fails, try by name (case-insensitive)
          let channel =
            context.interaction.guild.channels.cache.get(channel_id);
          if (!channel) {
            channel = context.interaction.guild.channels.cache.find(
              (c: any) =>
                c.isVoiceBased?.() &&
                typeof c.name === "string" &&
                c.name.toLowerCase() === channel_id.toLowerCase(),
            ) as any;
          }

          if (!channel || !channel.isVoiceBased?.()) {
            return {
              success: false,
              error: "Channel not found or not a voice channel",
              shouldRespond: true,
              responseText:
                "Could not find a matching voice channel by that ID or name",
            };
          }

          const oldName = channel.name;
          const newName =
            custom_name || this.generateChannelName(channel, name_style);

          // Check permissions
          const botMember = context.interaction.guild.members.me;
          if (!botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return {
              success: false,
              error: "Missing manage channels permission",
              shouldRespond: true,
              responseText:
                'I lack the harmony needed to manage channels. Please grant me the "Manage Channels" permission.',
            };
          }

          // Rename the channel
          await channel.setName(newName);

          logger.info(
            `🏷️ Renamed channel ${channel.id} (${oldName}) to "${newName}"`,
          );

          return {
            success: true,
            message: "Channel renamed successfully",
            data: {
              old_name: oldName,
              new_name: newName,
              channel_id: channel.id,
              style: name_style,
              member_count: channel.members.size,
            },
            shouldRespond: true,
            responseText: `Channel enlightened with new name: "${newName}"`,
          };
        }

        case "suggest_name": {
          const targetChannel = channel_id
            ? context.interaction?.guild?.channels.cache.get(channel_id)
            : context.voiceChannel;

          if (!targetChannel || !targetChannel.isVoiceBased()) {
            return {
              success: false,
              error: "No valid voice channel found",
              shouldRespond: true,
              responseText: "I need a voice channel to suggest names for",
            };
          }

          const suggestions = this.generateMultipleNames(
            targetChannel,
            name_style,
            3,
          );

          return {
            success: true,
            message: "Name suggestions generated",
            data: {
              suggestions,
              style: name_style,
              channel_id: targetChannel.id,
              current_name: targetChannel.name,
              member_count: targetChannel.members.size,
            },
            shouldRespond: true,
            responseText: `Channel name suggestions (${name_style} style):\n${suggestions.map((name, i) => `${i + 1}. ${name}`).join("\n")}`,
          };
        }

        case "analyze": {
          const targetChannel = channel_id
            ? context.interaction?.guild?.channels.cache.get(channel_id)
            : context.voiceChannel;

          if (!targetChannel || !targetChannel.isVoiceBased()) {
            return {
              success: false,
              error: "No valid voice channel found",
              shouldRespond: true,
              responseText: "I need a voice channel to analyze",
            };
          }

          const analysis = this.analyzeChannel(targetChannel);

          return {
            success: true,
            message: "Channel analysis completed",
            data: analysis,
            shouldRespond: true,
            responseText: `Channel Analysis:\n• Name: "${analysis.name}"\n• Members: ${analysis.member_count}\n• Activity: ${analysis.activity_level}\n• Suggested refresh: ${analysis.name_needs_refresh ? "Yes" : "No"}`,
          };
        }

        case "create": {
          // Note: This would require additional permissions and guild context
          return {
            success: false,
            error: "Channel creation not yet implemented",
            shouldRespond: true,
            responseText:
              "Channel creation flows through deeper harmonies - this feature seeks enlightenment.",
          };
        }

        default:
          return {
            success: false,
            error: `Unknown action: ${action}`,
            shouldRespond: true,
            responseText: "That action is not in harmony with my understanding",
          };
      }
    } catch (error) {
      logger.error("🏷️ Channel Management Action failed:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown channel management error",
        shouldRespond: true,
        responseText:
          "I experienced discord while managing the channel. Harmony will return.",
      };
    }
  }

  /**
   * Generate a creative channel name based on members and style
   */
  private generateChannelName(
    channel: VoiceBasedChannel,
    style: string,
  ): string {
    const memberNames = channel.members
      .filter((member) => !member.user.bot)
      .map((member) => member.displayName)
      .sort(); // Simple alphabetical sort

    const numMembers = memberNames.length;
    let possibleNames: string[] = [];

    // Check for special users (like Timbo)
    if (channel.members.some((m) => m.user.id === "299595170767306752")) {
      possibleNames.push("Discord Jerkoff Session");
    }

    // Style-specific wildcards
    switch (style) {
      case "zen":
        possibleNames.push(
          "Tranquil Sanctuary",
          "Harmony Chamber",
          "Inner Peace Lounge",
        );
        break;
      case "epic":
        possibleNames.push(
          "Legendary Assembly",
          "Epic Convergence",
          "Champions' Hall",
        );
        break;
      case "playful":
        possibleNames.push("Shenanigan Station", "Chaos Café", "Fun Factory");
        break;
      case "descriptive":
        // Will be filled with descriptive names below
        break;
      case "creative":
      default:
        possibleNames.push("Pixel Purgatory", "Rage Quit Retreat");
        break;
    }

    // Member count based names
    switch (numMembers) {
      case 0:
        possibleNames.push(...this.getEmptyChannelNames(style));
        break;
      case 1:
        possibleNames.push(...this.getSingleMemberNames(memberNames[0], style));
        break;
      case 2:
        possibleNames.push(...this.getDualMemberNames(memberNames, style));
        break;
      case 3:
        possibleNames.push(...this.getTrioNames(style));
        break;
      case 4:
        possibleNames.push(...this.getQuadNames(style));
        break;
      case 5:
        possibleNames.push(...this.getQuintNames(style));
        break;
      case 6:
        possibleNames.push(...this.getSextNames(style));
        break;
      default:
        possibleNames.push(...this.getOvercrowdedNames(style));
        break;
    }

    return (
      possibleNames[Math.floor(Math.random() * possibleNames.length)] ||
      "Harmony Lounge"
    );
  }

  /**
   * Generate multiple name suggestions
   */
  private generateMultipleNames(
    channel: VoiceBasedChannel,
    style: string,
    count: number,
  ): string[] {
    const suggestions: string[] = [];
    for (let i = 0; i < count; i++) {
      suggestions.push(this.generateChannelName(channel, style));
    }
    // Remove duplicates and ensure we have unique suggestions
    return [...new Set(suggestions)];
  }

  /**
   * Analyze channel for useful information
   */
  private analyzeChannel(channel: VoiceBasedChannel) {
    const memberCount = channel.members.filter((m) => !m.user.bot).size;
    const botCount = channel.members.filter((m) => m.user.bot).size;

    return {
      name: channel.name,
      id: channel.id,
      member_count: memberCount,
      bot_count: botCount,
      total_members: channel.members.size,
      activity_level: this.getActivityLevel(memberCount),
      name_needs_refresh: this.shouldRefreshName(channel.name, memberCount),
      created_at: channel.createdAt,
      member_names: channel.members
        .filter((m) => !m.user.bot)
        .map((m) => m.displayName),
    };
  }

  private getActivityLevel(memberCount: number): string {
    if (memberCount === 0) return "empty";
    if (memberCount === 1) return "solo";
    if (memberCount <= 3) return "intimate";
    if (memberCount <= 6) return "active";
    return "crowded";
  }

  private shouldRefreshName(currentName: string, memberCount: number): boolean {
    const genericNames = [
      "General",
      "Lounge",
      "Voice Channel",
      "PLACEHOLDER_NAME",
    ];
    return (
      genericNames.some((name) => currentName.includes(name)) ||
      currentName.includes(memberCount.toString())
    );
  }

  // Style-specific name generators
  private getEmptyChannelNames(style: string): string[] {
    switch (style) {
      case "zen":
        return ["Empty Meditation", "Void of Tranquility", "Silent Sanctuary"];
      case "epic":
        return ["Abandoned Fortress", "Desolate Realm", "Empty Throne Room"];
      case "playful":
        return ["Ghost Town", "Tumbleweed Territory", "Where Everyone Go?"];
      case "descriptive":
        return [
          "No Members Present",
          "Empty Voice Channel",
          "Awaiting Participants",
        ];
      default:
        return ["Empty Lounge", "The Void", "404 Lounge", "Server Cost"];
    }
  }

  private getSingleMemberNames(memberName: string, style: string): string[] {
    switch (style) {
      case "zen":
        return [
          `${memberName}'s Meditation`,
          "Solo Enlightenment",
          "Individual Journey",
        ];
      case "epic":
        return [`${memberName} the Lone Wolf`, "Solo Warrior", "Army of One"];
      case "playful":
        return [`${memberName}'s Hideout`, "👉👈", "Only 1?, Lamesauce"];
      case "descriptive":
        return [`${memberName} - Solo`, "Single Occupant", "One Member"];
      default:
        return [`${memberName}'s Lounge`, "Solo Lounge", "Lone Lounge"];
    }
  }

  private getDualMemberNames(memberNames: string[], style: string): string[] {
    const [name1, name2] = memberNames;
    switch (style) {
      case "zen":
        return [
          "Dual Harmony",
          "Paired Meditation",
          `${name1} & ${name2}'s Balance`,
        ];
      case "epic":
        return ["Dynamic Duo", "Twin Titans", "Legendary Pair"];
      case "playful":
        return ["Double Trouble", "Dynamic Dorks", "Pair of Legends"];
      case "descriptive":
        return [`${name1} and ${name2}`, "Two Members", "Dual Occupancy"];
      default:
        return ["Power Pair", "Dual Warriors", `${name1} & ${name2}`];
    }
  }

  private getTrioNames(style: string): string[] {
    switch (style) {
      case "zen":
        return ["Trinity of Peace", "Threefold Harmony", "Triad Meditation"];
      case "epic":
        return ["Triforce Warriors", "Triumphant Triad", "Three Legends"];
      case "playful":
        return ["Trio of Trolls", "Triple Trouble", "Three Amigos"];
      case "descriptive":
        return ["Three Members", "Trio Present", "Triple Occupancy"];
      default:
        return ["Triple Threat", "Three Musketeers", "Tactical Trinity"];
    }
  }

  private getQuadNames(style: string): string[] {
    switch (style) {
      case "zen":
        return ["Four Pillars", "Quadrant Harmony", "Sacred Square"];
      case "epic":
        return ["The Four Horsemen", "Fantastic Four", "Quad Legends"];
      case "playful":
        return ["Quartet of Chaos", "Fab Four", "Squad Goals"];
      case "descriptive":
        return ["Four Members", "Quartet", "Quad Occupancy"];
      default:
        return ["Quad Squad", "Elite Ensemble", "The Fabulous Four"];
    }
  }

  private getQuintNames(style: string): string[] {
    switch (style) {
      case "zen":
        return ["Pentagon of Peace", "Quintessential Harmony", "Five Elements"];
      case "epic":
        return ["Quintessential Warriors", "Elite Five", "Legendary Quintet"];
      case "playful":
        return ["Fivesome Fun", "High Five Club", "Quintet Quirks"];
      case "descriptive":
        return ["Five Members", "Quintet", "Penta Occupancy"];
      default:
        return ["Pentaforce", "Fivefold Fury", "The Fabulous Five"];
    }
  }

  private getSextNames(style: string): string[] {
    switch (style) {
      case "zen":
        return ["Hexagonal Harmony", "Six-Point Balance", "Sacred Hexagon"];
      case "epic":
        return ["The Savage Six", "Hexagon Heroes", "Elite Ensemble"];
      case "playful":
        return ["Six-Pack Power", "Hex Squad", "Party of Six"];
      case "descriptive":
        return ["Six Members", "Sextet", "Full Team"];
      default:
        return ["Team Hexagon", "Epic Gamer Lounge", "The Six"];
    }
  }

  private getOvercrowdedNames(style: string): string[] {
    switch (style) {
      case "zen":
        return ["Mass Meditation", "Crowded Consciousness", "Many Voices"];
      case "epic":
        return ["The Grand Assembly", "Massive Battalion", "Legendary Crowd"];
      case "playful":
        return ["Chaotic Convention", "Madhouse", "Too Many Cooks"];
      case "descriptive":
        return ["Large Group", "Many Members", "Crowded Channel"];
      default:
        return ["Overcrowded", "Discord Overflow", "The Grand Assembly"];
    }
  }

  validate(parameters: ActionParameters): boolean {
    logger.debug("🏷️ Validating Channel Management Action parameters", {
      parameters,
    });
    const validActions = ["rename", "create", "analyze", "suggest_name"];
    if (!parameters.action || !validActions.includes(parameters.action)) {
      return false;
    }

    const validStyles = ["creative", "descriptive", "zen", "playful", "epic"];
    if (parameters.name_style && !validStyles.includes(parameters.name_style)) {
      return false;
    }

    // Rename action requires channel_id
    if (parameters.action === "rename" && !parameters.channel_id) {
      return false;
    }

    return true;
  }
}
