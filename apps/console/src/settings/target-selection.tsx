import { useRouter, useRouterState } from "@tanstack/react-router"
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

import { SelectedConnectionContext } from "./connection-context"
import {
  builtinTarget,
  connectionTargetSchema,
  loadLocalTargets,
  migrateV1,
  selectConnection,
  storedTargetsSchema,
  TARGET_STORAGE_KEY,
  type ConnectionTarget,
  type SelectedConnection,
  type StoredTargets,
  type TargetSource,
} from "./connection-targets"
import { useRuntimeCatalog } from "./runtime-config-provider"

interface TargetEntry {
  target: ConnectionTarget
  source: TargetSource
}
interface TargetSelection {
  entries: TargetEntry[]
  selected?: SelectedConnection
  error?: string
  storageError?: string
  stored?: StoredTargets
  chooseTarget(id: string): void
  chooseWorker(id: string): void
  save(target: ConnectionTarget): void
  remove(id: string): void
  importJson(json: string): void
  reset(): void
}
const TargetContext = createContext<TargetSelection | null>(null)
export function useTargetSelection() {
  return useContext(TargetContext)
}

export function inferTarget(
  entries: TargetEntry[],
  explicit: string | undefined,
  last: string | undefined,
  managedDefault: string | undefined,
  hasCatalog: boolean,
) {
  if (explicit !== undefined) return entries.find((e) => e.target.id === explicit)
  return (
    entries.find((e) => e.target.id === last) ??
    entries.find((e) => e.target.id === managedDefault) ??
    (!hasCatalog ? entries.find((e) => e.source === "builtin") : undefined)
  )
}

export function TargetSelectionProvider({ children }: { children: ReactNode }) {
  const catalog = useRuntimeCatalog()
  const router = useRouter()
  const location = useRouterState({ select: (state) => state.location })
  const search = location.search as { target?: string; worker?: string }
  const [local, setLocal] = useState<{ stored?: StoredTargets; error?: string }>(() => {
    try {
      return { stored: loadLocalTargets(window.localStorage) }
    } catch (error) {
      return { error: `Local connections could not be loaded: ${String(error)}` }
    }
  })
  useEffect(() => {
    const listener = (event: StorageEvent) => {
      if (event.key !== TARGET_STORAGE_KEY) return
      try {
        setLocal({ stored: loadLocalTargets(window.localStorage) })
      } catch (error) {
        setLocal({ error: String(error) })
      }
    }
    window.addEventListener("storage", listener)
    return () => window.removeEventListener("storage", listener)
  }, [])
  const entries = useMemo<TargetEntry[]>(() => {
    const managed = catalog?.targets.map((target) => ({ target, source: "managed" as const })) ?? []
    return [
      ...managed,
      ...(catalog ? [] : [{ target: builtinTarget, source: "builtin" as const }]),
      ...(local.stored?.targets ?? [])
        .filter((t) => !managed.some((m) => m.target.id === t.id))
        .map((target) => ({ target, source: "local" as const })),
    ]
  }, [catalog, local.stored])
  const entry = local.error
    ? undefined
    : inferTarget(
        entries,
        search.target,
        local.stored?.activeId,
        catalog?.defaultTargetId,
        catalog !== undefined,
      )
  const workerId =
    search.worker ??
    entry?.target.defaultWorkerId ??
    (entry?.target.workers?.length === 1 ? entry.target.workers[0]?.id : undefined)
  let selected: SelectedConnection | undefined
  let error: string | undefined = local.error
  if (entry) {
    try {
      selected = selectConnection(entry.target, entry.source, workerId, window.location.origin)
    } catch (cause) {
      error = String(cause)
    }
  } else if (!error)
    error =
      search.target !== undefined
        ? `Application unavailable: ${search.target}`
        : "Select an application. Configure console-config.json or add a local connection in Settings."
  const canonical =
    !!selected &&
    search.target === selected.target.id &&
    (workerId === undefined || workerId === search.worker)
  useEffect(() => {
    if (!selected || canonical) return
    void router.navigate({
      to: location.pathname,
      search: { ...search, target: selected.target.id, worker: workerId },
      replace: true,
    } as never)
  }, [selected, workerId, canonical, router, location.pathname, search])
  const persist = (next: StoredTargets) => {
    const valid = storedTargetsSchema.parse(next)
    window.localStorage.setItem(TARGET_STORAGE_KEY, JSON.stringify(valid))
    setLocal({ stored: valid })
  }
  const value: TargetSelection = {
    entries,
    selected,
    error,
    storageError: local.error,
    stored: local.stored,
    chooseTarget(id) {
      if (local.stored) persist({ ...local.stored, activeId: id })
      void router.navigate({ to: "/", search: { target: id, worker: undefined } } as never)
    },
    chooseWorker(id) {
      void router.navigate({
        to: "/processors",
        search: { target: selected?.target.id, worker: id },
      } as never)
    },
    save(target) {
      if (entries.some((e) => e.target.id === target.id && e.source !== "local"))
        throw new Error("Managed and built-in connections cannot be overwritten")
      if (!local.stored) throw new Error("Export or reset invalid local connections before editing")
      const valid = connectionTargetSchema.parse(target)
      // Validate HTTPS compatibility before persisting, too.
      selectConnection(valid, "local", valid.defaultWorkerId, window.location.origin)
      persist({
        ...local.stored,
        targets: [...local.stored.targets.filter((t) => t.id !== valid.id), valid],
      })
    },
    remove(id) {
      if (local.stored)
        persist({ ...local.stored, targets: local.stored.targets.filter((t) => t.id !== id) })
    },
    importJson(json) {
      const raw = JSON.parse(json)
      const imported = raw.version === 1 ? migrateV1(raw) : storedTargetsSchema.parse(raw)
      if (
        imported.targets.some((t) =>
          entries.some((e) => e.target.id === t.id && e.source !== "local"),
        )
      )
        throw new Error("Import conflicts with a managed connection")
      const byId = new Map((local.stored?.targets ?? []).map((t) => [t.id, t]))
      for (const target of imported.targets) {
        selectConnection(target, "local", target.defaultWorkerId, window.location.origin)
        byId.set(target.id, target)
      }
      persist({ version: 2, activeId: local.stored?.activeId, targets: [...byId.values()] })
    },
    reset() {
      persist({ version: 2, targets: [] })
    },
  }
  return (
    <TargetContext.Provider value={value}>
      <SelectedConnectionContext.Provider value={selected ?? null}>
        {canonical ? (
          children
        ) : selected ? (
          <p role="status">Selecting application…</p>
        ) : (
          <TargetRecovery />
        )}
      </SelectedConnectionContext.Provider>
    </TargetContext.Provider>
  )
}

export function TargetSelectors() {
  const selection = useTargetSelection()
  if (!selection) return null
  const { entries, selected, chooseTarget, chooseWorker } = selection
  return (
    <div className="flex items-center gap-2">
      <label>
        Application{" "}
        <select
          aria-label="Application"
          value={selected?.target.id ?? ""}
          onChange={(e) => chooseTarget(e.target.value)}
        >
          <option value="" disabled>
            Select an application
          </option>
          {[...new Set(entries.map((e) => e.target.environment))].map((environment) => (
            <optgroup key={environment} label={environment}>
              {entries
                .filter((e) => e.target.environment === environment)
                .map(({ target }) => (
                  <option key={target.id} value={target.id}>
                    {target.label} · {target.app} · {target.environment}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      {!!selected?.target.workers?.length && (
        <label>
          Worker{" "}
          <select
            aria-label="Worker"
            value={selected.worker?.id ?? ""}
            onChange={(e) => chooseWorker(e.target.value)}
          >
            <option value="" disabled>
              Select a worker
            </option>
            {selected.target.workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label} · {w.id}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}

function TargetRecovery() {
  const selection = useTargetSelection()!
  return (
    <main className="flex flex-col gap-4 p-8">
      <h2>Connection settings</h2>
      <p role="alert">{selection.error}</p>
      <TargetSelectors />
      <LocalTargetSettings />
    </main>
  )
}

export function LocalTargetSettings() {
  const selection = useTargetSelection()!
  const [text, setText] = useState("")
  const [message, setMessage] = useState("")
  const run = (action: () => void) => {
    try {
      action()
      setMessage("Saved")
    } catch (error) {
      setMessage(String(error))
    }
  }
  return (
    <section className="flex max-w-3xl flex-col gap-3 p-4">
      <h1>Application connections</h1>
      <p>
        Managed connections are read-only. Local targets are stored in this browser. Export before
        resetting invalid storage. Legacy recent and pinned items have no application identity;
        recreate them by revisiting and pinning within a selected app.
      </p>
      <ul>
        {selection.entries.map(({ target, source }) => (
          <li key={target.id} className="mb-3">
            <strong>{target.label}</strong> · {target.app} · {target.environment} · {source}
            <pre>{JSON.stringify(target, null, 2)}</pre>
            {source === "local" && (
              <>
                <button onClick={() => setText(JSON.stringify(target, null, 2))}>
                  Edit {target.label}
                </button>
                <button onClick={() => run(() => selection.remove(target.id))}>
                  Delete {target.label}
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <label>
        Local target or exported connections JSON
        <textarea
          className="h-56 w-full border font-mono"
          aria-label="Connections JSON"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <div className="flex gap-3">
        <button
          onClick={() =>
            setText(
              JSON.stringify(
                {
                  id: `local-${crypto.randomUUID()}`,
                  label: "Local application",
                  app: "app",
                  environment: "local",
                  surfaces: { keiro: "http://127.0.0.1:9093" },
                },
                null,
                2,
              ),
            )
          }
        >
          New local target
        </button>
        <button
          onClick={() => run(() => selection.save(connectionTargetSchema.parse(JSON.parse(text))))}
        >
          Save target
        </button>
        <button onClick={() => run(() => selection.importJson(text))}>Import</button>
        <button onClick={() => setText(window.localStorage.getItem(TARGET_STORAGE_KEY) ?? "")}>
          Export
        </button>
        {selection.storageError && (
          <button onClick={() => run(selection.reset)}>Reset local connections</button>
        )}
      </div>
      <p role="status">{message}</p>
    </section>
  )
}
