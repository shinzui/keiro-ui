import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest"

import { createKeiroClient } from "../src"
import {
  InvalidConfirmation,
  keiroMutations,
  MutationOutcomeUnknown,
  MutationsDisabled,
  OriginNotAllowed,
  SchemaDrift,
  UnsupportedMediaType,
} from "../src/mutations"

const seen: { url: string; body: string; contentType: string | null }[] = []
let next: () => Response = () => HttpResponse.json({})
const server = setupServer(
  http.post("http://keiro.test/keiro/*", async ({ request }) => {
    seen.push({
      url: request.url.replace("http://keiro.test", ""),
      body: await request.text(),
      contentType: request.headers.get("content-type"),
    })
    return next()
  }),
)
beforeAll(() => server.listen({ onUnhandledFrame: "error" }))
afterEach(() => {
  seen.length = 0
})
afterAll(() => server.close())

const client = createKeiroClient({ baseUrl: "http://keiro.test/keiro" })
const mutations = keiroMutations(client)
const timer = {
  timer_id: "t-1",
  process_manager_name: "pm",
  correlation_id: "c",
  fire_at: "2026-10-21T00:00:00Z",
  payload: null,
  status: "firing",
  attempts: 3,
  fired_event_id: null,
  last_error: null,
}
const error = (status: number, code: string, details?: unknown) => () =>
  HttpResponse.json({ error: { code, message: code, details } }, { status })

test('preview sends no body; execute sends exactly {"confirm":"execute"}', async () => {
  next = () =>
    HttpResponse.json({
      outcome: "preview",
      result: { preview: true, operation: "requeue", disposition: "would_requeue", timer },
      cli_reinvocation: ["timer", "requeue", "t-1"],
    })
  const preview = await mutations.timers.requeue("t-1").preview()
  expect(preview.result.disposition).toBe("would_requeue")
  expect(seen[0]).toEqual({ url: "/keiro/timer/requeue/t-1", body: "", contentType: null })

  next = () =>
    HttpResponse.json({
      outcome: "executed",
      result: { operation: "requeue", outcome: "transitioned", transitioned: true, timer },
    })
  const executed = await mutations.timers.requeue("t-1").execute()
  expect(executed.result.outcome).toBe("transitioned")
  expect(seen[1]).toEqual({
    url: "/keiro/timer/requeue/t-1",
    body: '{"confirm":"execute"}',
    contentType: "application/json",
  })
})

describe("timer dispositions and outcomes decode", () => {
  test.each(["not_found", "not_firing", "already_terminal", "would_requeue", "would_cancel"])(
    "%s",
    async (disposition) => {
      next = () =>
        HttpResponse.json({
          outcome: "preview",
          result: {
            preview: true,
            operation: "cancel",
            disposition,
            timer: disposition === "not_found" ? null : timer,
          },
        })
      expect((await mutations.timers.cancel("t-1").preview()).result.disposition).toBe(disposition)
    },
  )

  test("not_transitioned", async () => {
    next = () =>
      HttpResponse.json({
        outcome: "executed",
        result: {
          operation: "cancel",
          outcome: "not_transitioned",
          transitioned: false,
          timer: null,
        },
      })
    expect((await mutations.timers.cancel("t-1").execute()).result.transitioned).toBe(false)
  })
})

describe("refusals are typed", () => {
  test.each([
    [error(403, "mutations_disabled"), MutationsDisabled],
    [error(409, "schema_drift", { drift: ["index x"] }), SchemaDrift],
    [error(400, "invalid_confirmation"), InvalidConfirmation],
    [error(504, "mutation_outcome_unknown"), MutationOutcomeUnknown],
    [error(403, "origin_not_allowed"), OriginNotAllowed],
    [error(415, "unsupported_media_type"), UnsupportedMediaType],
  ])("%#", async (respond, refusal) => {
    next = respond
    const thrown = await mutations.timers
      .requeue("t-1")
      .preview()
      .catch((e: unknown) => e)
    expect(thrown).toBeInstanceOf(refusal)
  })

  test("SchemaDrift carries the drift; MutationOutcomeUnknown says to re-read", async () => {
    next = error(409, "schema_drift", { drift: ["index x"] })
    expect(
      (
        (await mutations.timers
          .requeue("t")
          .execute()
          .catch((e: unknown) => e)) as SchemaDrift
      ).drift,
    ).toEqual(["index x"])
    next = error(504, "mutation_outcome_unknown")
    expect(
      (
        (await mutations.timers
          .requeue("t")
          .execute()
          .catch((e: unknown) => e)) as Error
      ).message,
    ).toMatch(/re-read/)
  })
})

test("dlqRedrive takes the logical queue name and refuses a _dlq name before any request", async () => {
  next = () =>
    HttpResponse.json({
      outcome: "preview",
      result: {
        preview: true,
        operation: "redrive",
        queue: "orders",
        available: 3,
        would_affect_at_most: 3,
      },
    })
  const preview = await mutations.pgmq.dlqRedrive({ queue: "orders", limit: 10 }).preview()
  expect(preview.result.would_affect_at_most).toBe(3)
  expect(seen[0]!.url).toBe("/keiro/pgmq/dlq/redrive?queue=orders&limit=10")
  expect(() => mutations.pgmq.dlqRedrive({ queue: "orders_dlq" })).toThrow(RangeError)
  expect(seen).toHaveLength(1)
})

// Bodies captured from keiro-ops-http 0.21.0.0 (--enable-mutations, jitsurei database) on
// 2026-10-21; the last from the default host (mutations disabled).
describe("contract: responses captured from keiro-ops-http", () => {
  const unknownTimer = "00000000-0000-4000-8000-000000000000"
  const captured = {
    preview: `{"cli_reinvocation":"'keiro-ops' 'timer' 'requeue' '${unknownTimer}' '--json' '--force'","outcome":"preview","result":{"disposition":"not_found","operation":"requeue","preview":true,"timer":null}}`,
    executed: `{"outcome":"executed","result":{"operation":"requeue","outcome":"not_transitioned","timer":null,"transitioned":false}}`,
    invalidConfirmation: `{"error":{"code":"invalid_confirmation","message":"expected an empty body or exactly {\\"confirm\\":\\"execute\\"}"}}`,
    disabled: `{"error":{"code":"mutations_disabled","message":"this surface was mounted without mutations"}}`,
  }
  const raw =
    (body: string, status = 200) =>
    () =>
      new HttpResponse(body, { status, headers: { "content-type": "application/json" } })

  test("an unknown timer previews as not_found and executes as not_transitioned", async () => {
    next = raw(captured.preview)
    const preview = await mutations.timers.requeue(unknownTimer).preview()
    expect(preview.result.disposition).toBe("not_found")
    expect(preview.cli_reinvocation).toContain("--force")
    next = raw(captured.executed)
    const executed = await mutations.timers.requeue(unknownTimer).execute()
    expect(executed.result).toMatchObject({ outcome: "not_transitioned", transitioned: false })
    expect(executed.exit_code).toBeUndefined()
  })

  test("the captured refusals become the typed refusals", async () => {
    next = raw(captured.invalidConfirmation, 400)
    await expect(mutations.timers.cancel(unknownTimer).execute()).rejects.toBeInstanceOf(
      InvalidConfirmation,
    )
    next = raw(captured.disabled, 403)
    await expect(mutations.timers.cancel(unknownTimer).preview()).rejects.toBeInstanceOf(
      MutationsDisabled,
    )
  })
})
