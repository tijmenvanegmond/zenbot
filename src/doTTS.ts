import { getInsult } from "./voice/remark";
import { turnTextIntoSpeechBuffer } from "./voice/tts";
import { logger } from "./utils/logger";

(async () => {
  const insult = await getInsult();
  logger.info("Generated remark:", insult);
  await turnTextIntoSpeechBuffer(insult);
})();
