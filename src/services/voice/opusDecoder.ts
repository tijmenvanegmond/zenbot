import { logger } from "../../utils/logger";

/**
 * Decodes Discord Opus packets (48kHz stereo, 20ms frames) to 16-bit PCM one
 * packet at a time, so a bad packet is skipped instead of ending the stream.
 *
 * Prefers the native @discordjs/opus. opusscript (WebAssembly) is the
 * fallback: it crashed with "memory access out of bounds" on packets that
 * were still DAVE-encrypted, and a crashed instance can't be trusted again,
 * so it is recreated after any failure.
 */

const RATE = 48000;
const CHANNELS = 2;
const FRAME_SIZE = 960;

interface Codec {
  decode(packet: Buffer): Buffer;
}

type CodecFactory = () => Codec;

const loadCodecFactory = (): { name: string; create: CodecFactory } => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { OpusEncoder } = require("@discordjs/opus");
    return {
      name: "@discordjs/opus",
      create: () => new OpusEncoder(RATE, CHANNELS),
    };
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const OpusScript = require("opusscript");
    return {
      name: "opusscript",
      create: () => {
        const codec = new OpusScript(
          RATE,
          CHANNELS,
          OpusScript.Application.AUDIO,
        );
        return {
          decode: (packet: Buffer) =>
            Buffer.from(codec.decode(packet, FRAME_SIZE)),
        };
      },
    };
  }
};

let factory: { name: string; create: CodecFactory } | null = null;

export class OpusDecoder {
  private codec: Codec;
  private decoded = 0;
  private failed = 0;
  private lastError = "";

  constructor() {
    if (!factory) {
      factory = loadCodecFactory();
      logger.info(`🎤 Opus decoder: ${factory.name}`);
    }
    this.codec = factory.create();
  }

  /** PCM for this packet, or null if it couldn't be decoded */
  decode(packet: Buffer): Buffer | null {
    try {
      const pcm = this.codec.decode(packet);
      this.decoded++;
      return pcm;
    } catch (error) {
      this.failed++;
      this.lastError = error instanceof Error ? error.message : String(error);
      this.codec = factory!.create(); // don't reuse a codec that just failed
      return null;
    }
  }

  logSummary(userId: string): void {
    if (this.failed === 0) return;
    logger.warn(
      `🎤 Opus: skipped ${this.failed} of ${this.decoded + this.failed} packets from ${userId} (last error: ${this.lastError})`,
    );
  }
}
