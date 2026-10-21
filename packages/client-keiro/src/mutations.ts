import { ApiError, isApiError } from "@keiro-ui/client-core"
import { z } from "zod"

import type { KeiroClient } from "./client"
import { commandRoute, type Flags } from "./route"
import { TimerItem } from "./schemas"

// The mutation protocol (docs/guides/serve-keiro-ops-over-http.md in mori://shinzui/keiro):
// POST with no body previews; POST with exactly {"confirm":"execute"} executes. Mutations are
// 403 `mutations_disabled` unless the host enables them. Exported from
// "@keiro-ui/client-keiro/mutations" only, so a screen opts in explicitly (plan 19).

class Refusal extends Error {
  override readonly cause: ApiError
  constructor(name: string, cause: ApiError, message = cause.message) {
    super(message)
    this.name = name
    this.cause = cause
  }
}

export class MutationsDisabled extends Refusal {
  constructor(cause: ApiError) {
    super("MutationsDisabled", cause)
  }
}
export class SchemaDrift extends Refusal {
  readonly drift: unknown
  constructor(cause: ApiError) {
    super("SchemaDrift", cause)
    this.drift = (cause.details as { drift?: unknown } | undefined)?.drift
  }
}
export class InvalidConfirmation extends Refusal {
  constructor(cause: ApiError) {
    super("InvalidConfirmation", cause)
  }
}
export class MutationOutcomeUnknown extends Refusal {
  constructor(cause: ApiError) {
    super(
      "MutationOutcomeUnknown",
      cause,
      `${cause.message} — re-read the current state before retrying`,
    )
  }
}
export class OriginNotAllowed extends Refusal {
  constructor(cause: ApiError) {
    super("OriginNotAllowed", cause)
  }
}
export class UnsupportedMediaType extends Refusal {
  constructor(cause: ApiError) {
    super("UnsupportedMediaType", cause)
  }
}

function refusal(error: unknown): unknown {
  if (!isApiError(error)) return error
  switch (error.code) {
    case "mutations_disabled":
      return new MutationsDisabled(error)
    case "schema_drift":
      return new SchemaDrift(error)
    case "invalid_confirmation":
      return new InvalidConfirmation(error)
    case "mutation_outcome_unknown":
      return new MutationOutcomeUnknown(error)
    case "origin_not_allowed":
      return new OriginNotAllowed(error)
    case "unsupported_media_type":
      return new UnsupportedMediaType(error)
    default:
      return error
  }
}

const PreviewEnvelope = z
  .object({
    outcome: z.literal("preview"),
    result: z.unknown(),
    cli_reinvocation: z.unknown().optional(),
  })
  .passthrough()
const ExecutedEnvelope = z
  .object({ outcome: z.literal("executed"), result: z.unknown(), exit_code: z.number().optional() })
  .passthrough()

export interface Preview<R> {
  outcome: "preview"
  result: R
  cli_reinvocation?: unknown
}
export interface Executed<R> {
  outcome: "executed"
  result: R
  exit_code?: number
}

async function post(
  client: KeiroClient,
  words: string[],
  positionals: string[],
  flags: Flags,
  body?: unknown,
): Promise<unknown> {
  const route = commandRoute(words, positionals, flags)
  try {
    return await client.http.post(route.path, { query: route.query, body })
  } catch (error) {
    throw refusal(error)
  }
}

/** POST with no body: what the mutation would do, changing nothing. */
export async function preview<R>(
  client: KeiroClient,
  words: string[],
  positionals: string[],
  flags: Flags,
  result: z.ZodType<R>,
): Promise<Preview<R>> {
  const envelope = PreviewEnvelope.parse(await post(client, words, positionals, flags))
  return { ...envelope, outcome: "preview", result: result.parse(envelope.result) }
}

/** POST with exactly {"confirm":"execute"}. */
export async function execute<R>(
  client: KeiroClient,
  words: string[],
  positionals: string[],
  flags: Flags,
  result: z.ZodType<R>,
): Promise<Executed<R>> {
  const envelope = ExecutedEnvelope.parse(
    await post(client, words, positionals, flags, { confirm: "execute" }),
  )
  return { ...envelope, outcome: "executed", result: result.parse(envelope.result) }
}

export const TimerMutationPreview = z
  .object({
    preview: z.literal(true),
    operation: z.string(),
    disposition: z.enum([
      "not_found",
      "not_firing",
      "already_terminal",
      "would_requeue",
      "would_cancel",
    ]),
    timer: TimerItem.nullable(),
  })
  .passthrough()
export type TimerMutationPreview = z.output<typeof TimerMutationPreview>

export const TimerMutationResult = z
  .object({
    operation: z.string(),
    outcome: z.enum(["transitioned", "not_transitioned"]),
    transitioned: z.boolean(),
    timer: TimerItem.nullable(),
  })
  .passthrough()
export type TimerMutationResult = z.output<typeof TimerMutationResult>

export const DlqRedrivePreview = z
  .object({
    preview: z.literal(true),
    operation: z.string(),
    queue: z.string(),
    available: z.number(),
    would_affect_at_most: z.number(),
  })
  .passthrough()
export type DlqRedrivePreview = z.output<typeof DlqRedrivePreview>

export const DlqRedriveResult = z
  .object({ operation: z.string(), queue: z.string(), affected: z.number() })
  .passthrough()
export type DlqRedriveResult = z.output<typeof DlqRedriveResult>

export interface MutationHandle<P, R> {
  preview(): Promise<Preview<P>>
  execute(): Promise<Executed<R>>
}

/** The three gated actions, bound to a client. */
export function keiroMutations(client: KeiroClient) {
  const timerAction = (
    verb: "requeue" | "cancel",
    timerId: string,
  ): MutationHandle<TimerMutationPreview, TimerMutationResult> => ({
    preview: () => preview(client, ["timer", verb], [timerId], {}, TimerMutationPreview),
    execute: () => execute(client, ["timer", verb], [timerId], {}, TimerMutationResult),
  })
  return {
    timers: {
      requeue: (timerId: string) => timerAction("requeue", timerId),
      cancel: (timerId: string) => timerAction("cancel", timerId),
    },
    pgmq: {
      /**
       * `queue` is the logical job queue name: keiro derives `<queue>_dlq` itself and rejects a
       * name already ending in `_dlq`, so passing the physical dead-letter queue is refused here.
       */
      dlqRedrive: ({
        queue,
        limit,
      }: {
        queue: string
        limit?: number
      }): MutationHandle<DlqRedrivePreview, DlqRedriveResult> => {
        if (queue.endsWith("_dlq"))
          throw new RangeError(`pass the logical queue name, not the dead-letter queue "${queue}"`)
        const flags = { queue, limit }
        return {
          preview: () => preview(client, ["pgmq", "dlq", "redrive"], [], flags, DlqRedrivePreview),
          execute: () => execute(client, ["pgmq", "dlq", "redrive"], [], flags, DlqRedriveResult),
        }
      },
    },
  }
}
