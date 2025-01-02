import { Command } from "./command";
import { Advice } from "./advice";
import { Rename } from "./rename";
import { TTS } from "./tts";
import { Listen } from "./listen";
import { Remark } from "./remark";


export const CommandCollection: Command[] = [Advice, Rename,TTS, Listen, Remark]; 