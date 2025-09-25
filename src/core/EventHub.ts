type Listener<TPayload> = (payload: TPayload) => void;

export class EventHub<TEvents extends Record<string, unknown>> {
  private readonly listeners = new Map<keyof TEvents, Set<Listener<unknown>>>();

  on<TKey extends keyof TEvents>(event: TKey, listener: Listener<TEvents[TKey]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const bucket = this.listeners.get(event) as Set<Listener<TEvents[TKey]>>;
    bucket.add(listener);
    return () => {
      bucket.delete(listener);
      if (bucket.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  once<TKey extends keyof TEvents>(event: TKey, listener: Listener<TEvents[TKey]>): () => void {
    const wrapped: Listener<TEvents[TKey]> = (payload) => {
      this.off(event, wrapped);
      listener(payload);
    };
    return this.on(event, wrapped);
  }

  off<TKey extends keyof TEvents>(event: TKey, listener: Listener<TEvents[TKey]>): void {
    const bucket = this.listeners.get(event) as Set<Listener<TEvents[TKey]>> | undefined;
    if (!bucket) return;
    bucket.delete(listener);
    if (bucket.size === 0) {
      this.listeners.delete(event);
    }
  }

  emit<TKey extends keyof TEvents>(event: TKey, payload: TEvents[TKey]): void {
    const bucket = this.listeners.get(event) as Set<Listener<TEvents[TKey]>> | undefined;
    bucket?.forEach((listener) => listener(payload));
  }
}
