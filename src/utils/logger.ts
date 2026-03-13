const PREFIX = "[gateway]";

function timestamp(): string {
  return new Date().toISOString();
}

export const logger = {
  info: (...args: unknown[]) => console.log(timestamp(), PREFIX, ...args),
  warn: (...args: unknown[]) => console.warn(timestamp(), PREFIX, "WARN", ...args),
  error: (...args: unknown[]) => console.error(timestamp(), PREFIX, "ERROR", ...args),
  debug: (...args: unknown[]) => {
    if (process.env.GATEWAY_DEBUG) {
      console.log(timestamp(), PREFIX, "DEBUG", ...args);
    }
  },
  audit: (action: string, details: Record<string, unknown>) =>
    console.log(timestamp(), PREFIX, "AUDIT", action, JSON.stringify(details)),
};
