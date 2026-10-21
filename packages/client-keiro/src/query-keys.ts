import { type QueryKeyPart, surfaceKey } from "@keiro-ui/client-core"

const k = (...parts: QueryKeyPart[]) => surfaceKey("keiro", ...parts)
type Filters = Record<string, unknown>

/** keiro's key factory: screens and feed hooks address the same cache entries through it. */
export const keiroKeys = {
  all: () => k(),
  health: () => k("health"),
  workflows: {
    all: () => k("workflows"),
    list: (filters: Filters = {}) => k("workflows", "list", filters),
    header: (name: string, id: string) => k("workflows", "header", name, id),
    journal: (name: string, id: string, query: Filters = {}) =>
      k("workflows", "journal", name, id, query),
    steps: (name: string, id: string, query: Filters = {}) =>
      k("workflows", "steps", name, id, query),
    children: (name: string, id: string, query: Filters = {}) =>
      k("workflows", "children", name, id, query),
    awakeables: (name: string, id: string, query: Filters = {}) =>
      k("workflows", "awakeables", name, id, query),
  },
  timers: {
    all: () => k("timers"),
    pending: (filters: Filters = {}) => k("timers", "pending", filters),
    stuck: (filters: Filters = {}) => k("timers", "stuck", filters),
  },
  projections: {
    all: () => k("projections"),
    status: (query: Filters = {}) => k("projections", "status", query),
    position: (subscription: string) => k("projections", "position", subscription),
  },
  shards: {
    list: () => k("shards", "list"),
    status: (subscription: string) => k("shards", "status", subscription),
  },
  streams: {
    show: (stream: string, query: Filters = {}) => k("streams", "show", stream, query),
    subscriptions: () => k("streams", "subscriptions"),
  },
  outbox: { backlog: () => k("outbox", "backlog") },
  inbox: { backlog: () => k("inbox", "backlog") },
  aggregates: {
    types: () => k("aggregates", "types"),
    list: (name: string, query: Filters = {}) => k("aggregates", "list", name, query),
    show: (name: string, id: string) => k("aggregates", "show", name, id),
    snapshot: (name: string, id: string) => k("aggregates", "snapshot", name, id),
  },
  processManagers: {
    list: (name: string, query: Filters = {}) => k("process-managers", "list", name, query),
    show: (name: string, correlation: string) => k("process-managers", "show", name, correlation),
  },
}
