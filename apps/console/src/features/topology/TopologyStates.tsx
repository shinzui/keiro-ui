import { TOPOLOGY_SCHEMA_IDS } from "@keiro-ui/client-keiro"
import { Button } from "@keiro-ui/ui/components/button"
import { Link } from "@tanstack/react-router"

import { EmptyState } from "@/components/empty-state"
import { links } from "@/lib/links"

import { describeFailure, type ServiceTopologyState } from "./queries"

const code = (text: string) => <code className="font-mono text-xs">{text}</code>

function Retry({ refetch }: { refetch?: () => void }) {
  if (!refetch) return null
  return (
    <Button size="sm" variant="outline" onPress={refetch}>
      Retry
    </Button>
  )
}

/**
 * Every way the topology is not there to show (ADR-13: a missing capability is named, a
 * refusal is shown as the server states it, and none of them reads as an empty service).
 */
export function TopologyStateView({
  state,
  refetch,
}: {
  state: Exclude<ServiceTopologyState, { status: "ready" }>
  refetch?: () => void
}) {
  switch (state.status) {
    case "loading":
      return (
        <p className="p-6 text-sm text-muted-foreground" data-testid="topology-loading">
          Reading the service topology…
        </p>
      )
    case "not-configured":
      return (
        <div data-testid="topology-not-configured">
          <EmptyState
            title="Keiro inspection is not configured for this deployment"
            description="The service topology is served by a keiro host, and this deployment has no keiro surface. No request was sent."
            action={
              <Link
                {...links.settingsConnections()}
                className="text-sm underline-offset-2 hover:underline"
              >
                Settings → Connections
              </Link>
            }
          />
        </div>
      )
    case "not-served":
      return (
        <div data-testid="topology-not-served">
          <EmptyState
            title="This keiro host serves no service topology"
            description={
              <>
                A host serves a topology only when the application mounts a committed document, with{" "}
                {code("--topology FILE")} or in code. Hosts older than the keiro release that added
                the route answer the same way, so the console cannot tell which applies. It probed{" "}
                {code("/keiro/topology/summary")} and the host refused the command. The rest of the
                console is unaffected.
              </>
            }
          />
        </div>
      )
    case "unsupported-schema":
      return (
        <div data-testid="topology-unsupported-schema">
          <EmptyState
            title="This console does not understand the mounted topology's schema"
            description={
              <>
                The host serves a document with schema id {code(state.schemaId)}. This console
                understands {code(TOPOLOGY_SCHEMA_IDS[0])} and {code(TOPOLOGY_SCHEMA_IDS[1])}. It
                did not fetch the document and shows nothing from one it cannot fully read. A newer
                console is needed.
              </>
            }
          />
        </div>
      )
    case "invalid":
      return (
        <div data-testid="topology-invalid">
          <EmptyState
            title="The mounted topology was rejected"
            description={
              <>
                The document was rejected whole and nothing from it is shown: {code(state.reason)}.
                A document is used only when every node kind and relation is known to its schema id,
                no declaration repeats, and every relation joins two declarations.
              </>
            }
            action={<Retry refetch={refetch} />}
          />
        </div>
      )
    case "too-large":
      return (
        <div data-testid="topology-too-large">
          <EmptyState
            title="The host refused to send the topology: the result is too large"
            description={
              <>
                The mounted document, or its summary, exceeds the host's response limit. The host's
                operator can raise {code("inspectionLimits.maxResponseBytes")}. This read has no
                parameters to narrow.
              </>
            }
            action={<Retry refetch={refetch} />}
          />
        </div>
      )
    case "changing":
      return (
        <div data-testid="topology-changing">
          <EmptyState
            title="The mounted topology is changing"
            description="Twice in a row, the document the host returned was not the one its summary described. The deployment is probably rolling out. Nothing is shown until a summary and a document agree."
            action={<Retry refetch={refetch} />}
          />
        </div>
      )
    case "failed": {
      const failure = describeFailure(state.error)
      return (
        <div data-testid="topology-failed">
          <EmptyState
            title="The service topology could not be read"
            description={
              <>
                {failure.code && <>{code(failure.code)} </>}
                {failure.message}
              </>
            }
            action={<Retry refetch={refetch} />}
          />
        </div>
      )
    }
  }
}

/** Shown above a document kept from an earlier read after a later read failed. */
export function StaleNotice({ error, refetch }: { error: unknown; refetch: () => void }) {
  const failure = describeFailure(error)
  return (
    <div
      role="status"
      data-testid="topology-stale"
      className="flex flex-wrap items-center gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm"
    >
      <span>
        The latest read failed, so this is the document verified earlier and may be out of date.{" "}
        {failure.code && <>{code(failure.code)} </>}
        {failure.message}
      </span>
      <Retry refetch={refetch} />
    </div>
  )
}
