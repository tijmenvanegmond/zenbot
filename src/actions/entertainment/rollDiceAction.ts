import {
  ZenAction,
  ActionContext,
  ActionParameters,
  ActionResult,
} from "../actionTypes";
import { logger } from "../../utils/logger";

const MAX_DICE = 20;
const MAX_SIDES = 1000;

/**
 * Dice rolls and coin flips - lets the AI settle arguments with real
 * randomness instead of pretending to roll
 */
export class RollDiceAction implements ZenAction {
  name = "roll_dice";
  description = "Roll dice or flip a coin";
  category = "entertainment" as const;

  permissions = {
    allowedSources: ["command", "api", "ai"],
  };

  schema = {
    name: "roll_dice",
    description:
      "Roll dice or flip a coin with real randomness. Use it whenever someone wants a random decision, a coin flip, a dice roll, or to settle an argument. Never make up a result yourself.",
    parameters: {
      type: "object" as const,
      properties: {
        kind: {
          type: "string" as const,
          enum: ["dice", "coin"],
          description: "dice (default) or coin",
        },
        count: {
          type: "number" as const,
          description: `Number of dice, 1-${MAX_DICE} (default 1)`,
        },
        sides: {
          type: "number" as const,
          description: `Sides per die, 2-${MAX_SIDES} (default 6)`,
        },
        reason: {
          type: "string" as const,
          description: "What the roll decides (optional)",
        },
      },
      required: [],
    },
  };

  async execute(
    _context: ActionContext,
    parameters: ActionParameters,
  ): Promise<ActionResult> {
    const { kind = "dice", reason } = parameters;
    const forWhat = reason ? ` for "${reason}"` : "";

    if (kind === "coin") {
      const side = Math.random() < 0.5 ? "heads" : "tails";
      logger.info(`🎲 Coin flip${forWhat}: ${side}`);
      return {
        success: true,
        message: `Coin flip: ${side}`,
        data: { kind, result: side, reason },
        shouldRespond: true,
        responseText: `🪙 Coin flip${forWhat}: **${side}**`,
      };
    }

    const count = clamp(Math.round(Number(parameters.count) || 1), 1, MAX_DICE);
    const sides = clamp(
      Math.round(Number(parameters.sides) || 6),
      2,
      MAX_SIDES,
    );
    const rolls = Array.from(
      { length: count },
      () => 1 + Math.floor(Math.random() * sides),
    );
    const total = rolls.reduce((sum, roll) => sum + roll, 0);
    const detail = count > 1 ? `${rolls.join(" + ")} = ${total}` : `${total}`;

    logger.info(`🎲 Rolled ${count}d${sides}${forWhat}: ${detail}`);
    return {
      success: true,
      message: `Rolled ${count}d${sides}: ${detail}`,
      data: { kind, count, sides, rolls, total, reason },
      shouldRespond: true,
      responseText: `🎲 ${count}d${sides}${forWhat}: **${detail}**`,
    };
  }
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
