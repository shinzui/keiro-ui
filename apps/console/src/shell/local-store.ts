/**
 * A tiny localStorage-backed external store for `useSyncExternalStore`. Every persisted key
 * is prefixed `keiro-ui.` and versioned `.v1`; a malformed or unreadable value yields the
 * fallback rather than throwing, so clearing site data is the universal reset.
 */
export interface LocalStore<T> {
  get(): T
  set(value: T): void
  subscribe(listener: () => void): () => void
}

export function createLocalStore<T>(
  key: string,
  fallback: T,
  parse: (raw: unknown) => T | undefined,
): LocalStore<T> {
  let cached: { value: T } | undefined
  const listeners = new Set<() => void>()

  function read(): T {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw === null) return fallback
      return parse(JSON.parse(raw)) ?? fallback
    } catch {
      return fallback
    }
  }

  return {
    get() {
      cached ??= { value: read() }
      return cached.value
    },
    set(value) {
      cached = { value }
      try {
        window.localStorage.setItem(key, JSON.stringify(value))
      } catch {
        // Persistence is a convenience; the in-memory value still applies.
      }
      for (const listener of listeners) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      const onStorage = (event: StorageEvent) => {
        if (event.key !== key) return
        cached = undefined
        listener()
      }
      window.addEventListener("storage", onStorage)
      return () => {
        listeners.delete(listener)
        window.removeEventListener("storage", onStorage)
      }
    },
  }
}
