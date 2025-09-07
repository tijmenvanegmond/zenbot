import { Command } from "./command";
import { Advice } from "./advice";
import { Rename } from "./rename";
import { TTS } from "./tts";
import { Listen } from "./listen";
import { Remark } from "./remark";
import { Quote } from "./quote";

// New AI Assistant commands
import { AdviceAssistant } from "./advice_assistant";

export const CommandCollectionWithAssistant: Command[] = [
  // Original commands (unchanged)
  Advice,
  Rename,
  TTS,
  Listen,
  Remark,
  Quote,

  // AI Assistant commands
  AdviceAssistant,
];
