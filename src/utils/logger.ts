const PREFIX = "[gateway]";

export const logger = {
  info: (...args: unknown[]) => console.log(PREFIX, ...args),
  warn: (...args: unknown[]) => console.warn(PREFIX, "WARN", ...args),
  error: (...args: unknown[]) => console.error(PREFIX, "ERROR", ...args),
  audit: (action: string, details: Record<string, unknown>) =>
    console.log(PREFIX, "AUDIT", action, JSON.stringify(details)),
};
