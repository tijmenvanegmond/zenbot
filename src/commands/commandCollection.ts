import { Command } from "./command";
import { Rename } from "./rename";
import { TTS } from "./tts";
import { Listen } from "./listen";
import { Remark } from "./remark";
import { Quote } from "./quote";
import { Advice } from "./advice";
import { conferenceCommand } from "./conference";

export const CommandCollection: Command[] = [
  Advice,
  Rename,
  TTS,
  Listen,
  Remark,
  Quote,
  conferenceCommand,
];
