import { promises as fs, readFileSync } from "fs";
import path from "path";
import { logger } from "../utils/logger";

/**
 * A small JSON file under data/ (ZENBOT_DATA_DIR), loaded once and kept in
 * memory. docker-compose mounts ./data, so these survive rebuilds.
 */
export interface JsonStore<T> {
  load(): T;
  save(): Promise<void>;
  /** For tests */
  reset(data?: T): void;
}

export const jsonStore = <T>(
  fileName: string,
  empty: () => T,
): JsonStore<T> => {
  let data: T | null = null;
  const dir = () =>
    process.env.ZENBOT_DATA_DIR || path.join(process.cwd(), "data");

  const load = (): T => {
    if (data) return data;
    try {
      data = JSON.parse(readFileSync(path.join(dir(), fileName), "utf8")) as T;
    } catch {
      data = empty();
    }
    return data;
  };

  return {
    load,
    save: async () => {
      try {
        await fs.mkdir(dir(), { recursive: true });
        await fs.writeFile(
          path.join(dir(), fileName),
          JSON.stringify(load(), null, 2),
        );
      } catch (error) {
        logger.error(`💾 Failed to save ${fileName}:`, error);
      }
    },
    reset: (next = empty()) => {
      data = next;
    },
  };
};
