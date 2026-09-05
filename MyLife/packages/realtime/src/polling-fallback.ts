export interface PollingConfig {
  intervalMs: number;
  fetchFn: () => Promise<unknown>;
  onData: (data: unknown) => void;
  onError?: (error: Error) => void;
}

export interface PollingHandle {
  start(): void;
  stop(): void;
  isRunning(): boolean;
}

export function createPollingFallback(config: PollingConfig): PollingHandle {
  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;

  async function poll() {
    try {
      const data = await config.fetchFn();
      config.onData(data);
    } catch (error) {
      config.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  function start() {
    if (running) return;
    running = true;
    poll();
    timer = setInterval(poll, config.intervalMs);
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    running = false;
  }

  function isRunning() {
    return running;
  }

  return { start, stop, isRunning };
}
