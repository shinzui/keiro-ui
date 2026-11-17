import { isApiError, useSurfaceAvailable, useSurfaceQuery } from "@keiro-ui/client-core"
import {
  isRouteUnavailable,
  isTooLarge,
  isTopologyChanging,
  isTopologyDocumentInvalid,
  isUnsupportedTopologySchema,
  keiroKeys,
  type LoadedTopology,
  useKeiroClient,
} from "@keiro-ui/client-keiro"

// The only way a screen obtains the service topology. The client verifies the document's
// bytes against the host's digest, validates it whole (ADR-16) and keeps it per digest, so a
// poll costs one summary request and /topology/show is read once per digest.

/** The document changes only when the host redeploys, so a slow poll is enough to notice. */
export const TOPOLOGY_POLL_MS = 60_000

export type ServiceTopologyState =
  /** The selected deployment has no keiro surface; no request is sent. */
  | { status: "not-configured" }
  | { status: "loading" }
  /**
   * `stale` is true when the latest read failed without a definite answer (network, 5xx, busy,
   * a changing deployment): the document shown is the last one verified, and `staleError` is
   * that failure.
   */
  | { status: "ready"; topology: LoadedTopology; stale: boolean; staleError?: unknown }
  /** The host mounts no document, or is too old to know the route; the two look the same. */
  | { status: "not-served" }
  | { status: "unsupported-schema"; schemaId: string }
  | { status: "invalid"; reason: string }
  | { status: "too-large" }
  | { status: "changing" }
  | { status: "failed"; error: unknown }

/**
 * A definite answer about what the host serves now. It replaces a document loaded earlier,
 * because showing the old one would describe a host that no longer serves it.
 */
function definiteState(error: unknown): ServiceTopologyState | undefined {
  if (isRouteUnavailable(error)) return { status: "not-served" }
  if (isUnsupportedTopologySchema(error))
    return { status: "unsupported-schema", schemaId: error.schemaId }
  if (isTopologyDocumentInvalid(error)) return { status: "invalid", reason: error.reason }
  if (isTooLarge(error)) return { status: "too-large" }
  // A response that fails the summary's schema is as definite as an invalid document.
  if (error instanceof Error && error.name === "ZodError")
    return { status: "invalid", reason: "the topology summary is not shaped as the contract says" }
  return undefined
}

export function topologyStateOf(input: {
  available: boolean
  data: LoadedTopology | undefined
  error: unknown
  isError: boolean
}): ServiceTopologyState {
  if (!input.available) return { status: "not-configured" }
  if (input.isError) {
    const definite = definiteState(input.error)
    if (definite) return definite
    if (input.data)
      return { status: "ready", topology: input.data, stale: true, staleError: input.error }
    if (isTopologyChanging(input.error)) return { status: "changing" }
    return { status: "failed", error: input.error }
  }
  if (input.data) return { status: "ready", topology: input.data, stale: false }
  return { status: "loading" }
}

export function useServiceTopology(): ServiceTopologyState & { refetch(): void } {
  const available = useSurfaceAvailable("keiro")
  const keiro = useKeiroClient()
  const query = useSurfaceQuery<LoadedTopology, unknown>({
    surface: "keiro",
    queryKey: keiroKeys.topology.loaded(),
    queryFn: ({ signal }) => keiro.topology.load(signal),
    poll: TOPOLOGY_POLL_MS,
  })
  const state = topologyStateOf({
    available,
    data: query.data,
    error: query.error,
    isError: query.isError,
  })
  return { ...state, refetch: () => void query.refetch() }
}

/** The server's own code and message for a failure, or the error's message. */
export function describeFailure(error: unknown): { code?: string; message: string } {
  for (let e: unknown = error; e instanceof Error; e = e.cause) {
    if (isApiError(e))
      return { code: e.status ? `${e.status} ${e.code}` : e.code, message: e.message }
  }
  return { message: error instanceof Error ? error.message : String(error) }
}
