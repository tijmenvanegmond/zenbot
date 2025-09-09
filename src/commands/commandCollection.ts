import { Command } from "./command";
import { Rename } from "./rename";
import { TTS } from "./tts";
import { Listen } from "./listen";
import { Remark } from "./remark";
import { Quote } from "./quote";
import { Advice } from "./advice";

export const CommandCollection: Command[] = [
  // Original commands (unchanged)
  Advice,
  Rename,
  TTS,
  Listen,
  Remark,
  Quote,
];
