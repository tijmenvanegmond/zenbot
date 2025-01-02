import { getInsult } from "./voice/remark";
import { turnTextIntoSpeechBuffer } from "./voice/tts";

(async () => {
  const insult = await getInsult();
  console.log(insult);
  await turnTextIntoSpeechBuffer(insult);
})();