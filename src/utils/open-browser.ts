import { logger } from "./logger.js";

export async function openBrowser(url: string): Promise<void> {
  try {
    const open = (await import("open")).default;
    await open(url);
  } catch (err) {
    logger.warn("Could not open browser automatically:", err);
    logger.info(`Please open this URL manually: ${url}`);
  }
}
