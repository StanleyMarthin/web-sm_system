interface CacheEntry<T> {
  expiresAt: number;
  value?: T;
  pending?: Promise<T>;
}

export class TtlCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  constructor(private readonly ttlMs: number) {}

  async getOrCreate(key: string, factory: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const current = this.entries.get(key);

    if (current?.value !== undefined && current.expiresAt > now) {
      return current.value;
    }

    if (current?.pending) {
      return current.pending;
    }

    const pending = factory()
      .then((value) => {
        this.entries.set(key, {
          value,
          expiresAt: Date.now() + this.ttlMs,
        });
        return value;
      })
      .catch((error) => {
        const latest = this.entries.get(key);
        if (latest?.pending === pending) {
          this.entries.delete(key);
        }
        throw error;
      });

    this.entries.set(key, {
      expiresAt: current?.expiresAt ?? 0,
      value: current?.value,
      pending,
    });

    return pending;
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  deletePrefix(prefix: string): void {
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) {
        this.entries.delete(key);
      }
    }
  }

  clear(): void {
    this.entries.clear();
  }
}
