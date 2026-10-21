import { ApiError, isApiError } from "@keiro-ui/client-core"
import { Badge } from "@keiro-ui/ui/components/badge"
import type { ReactNode } from "react"

import { MUTATIONS_DISABLED_REASON } from "./gate"

const DEPLOYMENT = "docs/user/deployment.md"

/** The ApiError behind a client's typed refusal (its `cause`), or the error itself. */
export function apiErrorOf(error: unknown): ApiError | undefined {
  for (let e: unknown = error; e instanceof Error; e = e.cause) if (isApiError(e)) return e
  return undefined
}

function explain(error: ApiError): ReactNode {
  switch (error.code) {
    case "mutations_disabled":
      return MUTATIONS_DISABLED_REASON
    case "mutation_outcome_unknown":
      return "The outcome is unknown. The target is being re-read; check its state before retrying."
    case "origin_not_allowed":
      return error.surface === "shibuya"
        ? `The shibuya host must list this console's origin in corsAllowedOrigins (${DEPLOYMENT}).`
        : `The keiro host must allow-list this console's origin, or the proxy must preserve Host (${DEPLOYMENT}).`
    case "control_disabled":
      return "Control operations are disabled on the server (enableControl = False)."
    default:
      return null
  }
}

/**
 * A server refusal as the server said it: the message verbatim, the code as a badge, the
 * context the envelope carried (shibuya's `processor`, keiro's drift list), and what it means.
 */
export function RefusalView({ error }: { error: unknown }) {
  const api = apiErrorOf(error)
  if (!api)
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : String(error)}
      </p>
    )
  const details = (api.details ?? {}) as { drift?: unknown; processor?: unknown }
  const drift = Array.isArray(details.drift) ? details.drift : undefined
  const meaning = explain(api)
  return (
    <div
      role="alert"
      className="flex flex-col gap-1.5 rounded-md bg-destructive/5 p-2 text-sm"
      data-refusal={api.code}
    >
      <span className="flex flex-wrap items-center gap-2">
        <Badge variant="destructive">{api.code}</Badge>
        <span className="text-xs text-muted-foreground">HTTP {api.status}</span>
        {typeof details.processor === "string" && (
          <span className="font-mono text-xs">processor {details.processor}</span>
        )}
      </span>
      <span className="text-destructive">{api.message}</span>
      {drift && drift.length > 0 && (
        <ul aria-label="Schema drift" className="list-inside list-disc text-xs">
          {drift.map((d) => (
            <li key={typeof d === "string" ? d : JSON.stringify(d)}>
              {typeof d === "string" ? d : JSON.stringify(d)}
            </li>
          ))}
        </ul>
      )}
      {meaning && <span className="text-xs text-muted-foreground">{meaning}</span>}
    </div>
  )
}
