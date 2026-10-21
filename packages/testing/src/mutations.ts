import { http, type HttpHandler, HttpResponse } from "msw"

import { fixtureText } from "./fixtures"
import { type MutationScenario, scenarioState } from "./scenario"

// Scripted answers for the gated operator actions, shaped like the owning servers' (keiro-ops-http
// Application.hs; shibuya-metrics Control.hs, both in their repositories). Each handler answers
// only while its scenario is set and otherwise falls through to the recorded fixtures.

const DRIFT = ["keiro_timers: column attempts has type integer, expected bigint"]

const keiroRefusal = (status: number, code: string, message: string, details?: unknown) =>
  HttpResponse.json({ error: { code, message, ...(details ? { details } : {}) } }, { status })

const REFUSALS: Record<string, [number, string]> = {
  mutation_outcome_unknown: [504, "the mutation deadline passed; the outcome is not known"],
  command_failed: [422, "TimerStoreError: could not update keiro_timers"],
  inspection_busy: [503, "all inspection slots are in use; retry later"],
  origin_not_allowed: [403, "origin http://localhost:5174 is not allowed"],
}

/** The gate refusals every keiro mutation shares; null when the gate lets it through. */
function gate(m: MutationScenario) {
  if (m.keiro === "disabled")
    return keiroRefusal(403, "mutations_disabled", "this surface was mounted without mutations")
  if (m.keiro === "drift")
    return keiroRefusal(409, "schema_drift", "the live schema drifts from the binary", {
      drift: DRIFT,
    })
  return null
}

function pendingTimer(id: string): unknown {
  const page = JSON.parse(fixtureText("keiro/timers-pending.json")) as {
    items: { timer_id: string }[]
  }
  return page.items.find((t) => t.timer_id === id) ?? null
}

async function isExecute(request: Request): Promise<boolean> {
  const text = await request.text()
  return text.trim() !== ""
}

export const mutationHandlers: HttpHandler[] = [
  http.get("*/keiro/health", () => {
    const m = scenarioState.mutations
    if (!m.keiro) return undefined
    if (m.keiro === "drift")
      return HttpResponse.json(
        { status: "schema_drift", schema_drift: DRIFT, mutations_enabled: true },
        { status: 503 },
      )
    return HttpResponse.json({
      status: "ok",
      schema_drift: [],
      mutations_enabled: m.keiro === "enabled",
    })
  }),
  http.post("*/keiro/timer/:verb/:id", async ({ request, params }) => {
    const m = scenarioState.mutations
    if (!m.keiro) return undefined
    const refused = gate(m)
    if (refused) return refused
    const verb = String(params.verb)
    const id = String(params.id)
    const timer = pendingTimer(id)
    if (!(await isExecute(request))) {
      if (m.previewRefusal === "schema_drift")
        return keiroRefusal(409, "schema_drift", "the live schema drifts from the binary", {
          drift: DRIFT,
        })
      if (m.previewRefusal) {
        const [status, message] = REFUSALS[m.previewRefusal]!
        return keiroRefusal(status, m.previewRefusal, message)
      }
      const disposition = m.timerDisposition ?? (timer ? `would_${verb}` : "not_found")
      return HttpResponse.json({
        outcome: "preview",
        result: {
          preview: true,
          operation: verb,
          disposition,
          timer: disposition === "not_found" ? null : timer,
        },
        cli_reinvocation: `'keiro-ops' 'timer' '${verb}' '${id}' '--json' '--force'`,
      })
    }
    if (m.executeRefusal) {
      const [status, message] = REFUSALS[m.executeRefusal]!
      return keiroRefusal(status, m.executeRefusal, message)
    }
    const changed = timer && {
      ...(timer as object),
      status: verb === "requeue" ? "scheduled" : "cancelled",
    }
    return HttpResponse.json({
      outcome: "executed",
      result: {
        operation: verb,
        outcome: timer ? "transitioned" : "not_transitioned",
        transitioned: Boolean(timer),
        timer: changed,
      },
    })
  }),
  http.post("*/keiro/pgmq/dlq/redrive", async ({ request }) => {
    const m = scenarioState.mutations
    if (!m.keiro) return undefined
    const refused = gate(m)
    if (refused) return refused
    const url = new URL(request.url)
    const queue = url.searchParams.get("queue") ?? ""
    const limit = Number(url.searchParams.get("limit") ?? "100")
    const available = 1
    if (!(await isExecute(request)))
      return HttpResponse.json({
        outcome: "preview",
        result: {
          preview: true,
          operation: "redrive",
          queue,
          available,
          would_affect_at_most: Math.min(limit, available),
        },
        cli_reinvocation: `'keiro-ops' 'pgmq' 'dlq' 'redrive' '--queue' '${queue}' '--limit' '${limit}' '--json' '--force'`,
      })
    if (m.executeRefusal) {
      const [status, message] = REFUSALS[m.executeRefusal]!
      return keiroRefusal(status, m.executeRefusal, message)
    }
    return HttpResponse.json({
      outcome: "executed",
      result: { operation: "redrive", queue, affected: Math.min(limit, available) },
      exit_code: 0,
    })
  }),
  http.get("*/shibuya/control", () => {
    const control = scenarioState.mutations.shibuyaControl
    if (!control) return undefined
    return HttpResponse.json({ enabled: control !== "disabled", operations: ["pause", "resume"] })
  }),
  http.post("*/shibuya/control/processors/:id/:op", ({ params }) => {
    const control = scenarioState.mutations.shibuyaControl
    if (!control) return undefined
    if (control === "disabled")
      return HttpResponse.json(
        { error: "Control operations are disabled", code: "control_disabled" },
        { status: 403 },
      )
    if (control === "origin_not_allowed")
      return HttpResponse.json(
        { error: "Origin not allowed", code: "origin_not_allowed" },
        { status: 403 },
      )
    const id = String(params.id)
    return params.op === "pause"
      ? HttpResponse.json({ processor: id, state: "paused", pausedAt: "2026-10-21T12:00:00Z" })
      : HttpResponse.json({ processor: id, state: "running" })
  }),
]
