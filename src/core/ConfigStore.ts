import type { AuroraConfig } from './types';

type Listener<TConfig> = (config: TConfig, changes: Partial<TConfig>) => void;

type KeyOf<T> = T extends object ? keyof T : never;

export class ConfigStore<TConfig extends object> {
  private readonly proxy: TConfig;
  private readonly base: TConfig;
  private readonly listeners = new Set<Listener<TConfig>>();
  private batching = false;
  private pending: Partial<TConfig> | null = null;

  constructor(base: TConfig) {
    this.base = base;
    this.proxy = new Proxy(base, {
      set: (target, property, value) => {
        const key = property as KeyOf<TConfig>;
        const previous = (target as Record<KeyOf<TConfig>, unknown>)[key];
        if (previous === value) {
          return true;
        }
        (target as Record<KeyOf<TConfig>, unknown>)[key] = value;
        this.queueChange(key, value as TConfig[KeyOf<TConfig>]);
        return true;
      },
    });
  }

  get state(): TConfig {
    return this.proxy;
  }

  get raw(): TConfig {
    return this.base;
  }

  subscribe(listener: Listener<TConfig>): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  patch(changes: Partial<TConfig>): void {
    this.batch(() => {
      Object.entries(changes).forEach(([key, value]) => {
        (this.proxy as Record<string, unknown>)[key] = value;
      });
    });
  }

  batch(run: () => void): void {
    if (this.batching) {
      run();
      return;
    }
    this.batching = true;
    try {
      run();
    } finally {
      this.batching = false;
      if (this.pending) {
        this.emit(this.pending);
        this.pending = null;
      }
    }
  }

  private queueChange(key: KeyOf<TConfig>, value: TConfig[KeyOf<TConfig>]): void {
    if (!this.pending) {
      this.pending = {} as Partial<TConfig>;
    }
    (this.pending as Record<KeyOf<TConfig>, unknown>)[key] = value;
    if (!this.batching) {
      const flush = this.pending;
      this.pending = null;
      this.emit(flush);
    }
  }

  private emit(changes: Partial<TConfig>): void {
    if (!changes || Object.keys(changes).length === 0) {
      return;
    }
    const snapshot = this.proxy;
    this.listeners.forEach((listener) => {
      listener(snapshot, changes);
    });
  }
}

export type AuroraConfigStore = ConfigStore<AuroraConfig>;

export function createConfigStore(base: AuroraConfig): AuroraConfigStore {
  return new ConfigStore(base);
}
