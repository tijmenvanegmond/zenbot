import { getInsult } from "./infrastructure/voice/remark";
import { turnTextIntoSpeechBuffer } from "./infrastructure/voice/tts";
import { logger } from "./utils/logger";

(async () => {
  const insult = await getInsult();
  logger.info("Generated remark:", insult);
  await turnTextIntoSpeechBuffer(insult);
})();
