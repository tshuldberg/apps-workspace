const PREFIX = "[system-monitor]";

export const logger = {
  info: (...args: unknown[]) => console.error(PREFIX, "INFO", ...args),
  warn: (...args: unknown[]) => console.error(PREFIX, "WARN", ...args),
  error: (...args: unknown[]) => console.error(PREFIX, "ERROR", ...args),
  debug: (...args: unknown[]) => {
    if (process.env.DEBUG) {
      console.error(PREFIX, "DEBUG", ...args);
    }
  },
};
