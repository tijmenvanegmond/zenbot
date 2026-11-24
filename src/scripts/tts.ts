/**
 * Voice testing CLI: render text with a voice profile to a WAV file, using
 * exactly the settings the bot sends to Piper.
 *
 *   npm run tts -- "Experience tranquility." [profile] [out.wav]
 *   npm run tts -- --list
 *
 * Profile defaults to Zenbot's voice (piper-zen); mood names like
 * "zenbot-default:calm" work too. Needs the Piper container
 * (PIPER_URL, default http://localhost:8080).
 */
import "dotenv/config";
import { writeFileSync } from "fs";
import { ProfileManager } from "../services/voice/ProfileManager";
import { PiperProvider } from "../services/voice/providers/PiperProvider";

const main = async (): Promise<void> => {
  const [text, profile = "piper-zen", out = "tts-output.wav"] =
    process.argv.slice(2);
  const profiles = ProfileManager.getInstance();

  if (!text || text === "--help") {
    console.log('Usage: npm run tts -- "text" [profile] [out.wav]');
    console.log("       npm run tts -- --list");
    return;
  }
  if (text === "--list") {
    for (const [name, info] of Object.entries(profiles.getProfileSummary())) {
      console.log(`${name.padEnd(22)} ${(info as any).description}`);
    }
    return;
  }

  const config = profiles.getConfig(profile);
  if (config.provider !== "piper" || !config.piper) {
    throw new Error(`Profile "${profile}" isn't a Piper profile`);
  }

  const started = Date.now();
  const wav = await new PiperProvider().generateTTS(text, config.piper);
  writeFileSync(out, wav);
  console.log(
    `Wrote ${out} (${wav.length} bytes, ${Date.now() - started}ms) with ${profile}: ${JSON.stringify(config.piper)}`,
  );
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
