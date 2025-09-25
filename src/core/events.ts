export type EventListener<TPayload> = (payload: TPayload) => void;

/**
 * Strongly typed event hub used by the Aurora runtime to orchestrate cross-module
 * messaging. Provides minimal subscribe/emit primitives while keeping listeners
 * encapsulated inside the core runtime boundary.
 */
export class EventHub<TEvents extends Record<string, unknown>> {
  private readonly listeners = new Map<keyof TEvents, Set<EventListener<unknown>>>();

  on<TKey extends keyof TEvents>(event: TKey, listener: EventListener<TEvents[TKey]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const bucket = this.listeners.get(event) as Set<EventListener<TEvents[TKey]>>;
    bucket.add(listener);
    return () => this.off(event, listener);
  }

  once<TKey extends keyof TEvents>(event: TKey, listener: EventListener<TEvents[TKey]>): () => void {
    const wrapped: EventListener<TEvents[TKey]> = (payload) => {
      this.off(event, wrapped);
      listener(payload);
    };
    return this.on(event, wrapped);
  }

  off<TKey extends keyof TEvents>(event: TKey, listener: EventListener<TEvents[TKey]>): void {
    const bucket = this.listeners.get(event) as Set<EventListener<TEvents[TKey]>> | undefined;
    if (!bucket) return;
    bucket.delete(listener);
    if (bucket.size === 0) {
      this.listeners.delete(event);
    }
  }

  emit<TKey extends keyof TEvents>(event: TKey, payload: TEvents[TKey]): void {
    const bucket = this.listeners.get(event) as Set<EventListener<TEvents[TKey]>> | undefined;
    bucket?.forEach((listener) => listener(payload));
  }
}
